"""
Protocol control routes: start, stop, restart, status.
Controls the hivoid-server binary via subprocess / PID management.
"""
import json
import logging
import os
import signal
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Admin, User
from app.schemas import ProtocolStatusResponse, MessageResponse
from app.auth import get_current_admin

router = APIRouter(prefix="/api/protocol", tags=["Protocol"])
logger = logging.getLogger("hivoid.protocol")


def _pid_path() -> Path:
    return Path(settings.HIVOID_PID_PATH)


def _read_pid() -> int | None:
    """Read the HiVoid server PID from its PID file."""
    try:
        content = _pid_path().read_text().strip()
        pid = int(content)
        # Verify the process is alive
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError, OSError):
        return None


def _is_running() -> tuple[bool, int | None]:
    """Check if the HiVoid server is running."""
    pid = _read_pid()
    return (pid is not None, pid)


def sync_server_config(db: Session) -> bool:
    """
    Generate the server.json from the database users and settings,
    then write it to disk.  Raises HTTPException on failure.
    """
    config_path = Path(settings.HIVOID_CONFIG_PATH)

    try:
        config_path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        raise HTTPException(
            status_code=500,
            detail=f"Permission denied creating directory {config_path.parent}. "
                   f"Run: sudo mkdir -p {config_path.parent} && sudo chmod 755 {config_path.parent}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot create config directory {config_path.parent}: {e}",
        )

    # Collect enabled user UUIDs
    try:
        enabled_users = db.query(User).filter(User.enabled == True).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")

    # Load usage mapping from core's usage file
    usage_map = {}
    usage_path = config_path.with_suffix(".usage.json")
    if usage_path.exists():
        try:
            usage_data = json.loads(usage_path.read_text())
            for u_usage in usage_data.get("users", []):
                usage_map[u_usage["uuid"]] = {
                    "bytes_in": u_usage.get("bytes_in", 0),
                    "bytes_out": u_usage.get("bytes_out", 0)
                }
        except Exception:
            pass

    # Transform users to the new structured format
    user_list = []
    for u in enabled_users:
        # Use usage from file if exists, otherwise fallback to DB
        live_usage = usage_map.get(u.uuid, {})
        u_bytes_in = live_usage.get("bytes_in", u.bytes_in)
        u_bytes_out = live_usage.get("bytes_out", u.bytes_out)

        user_list.append({
            "uuid": u.uuid,
            "email": u.email or "",
            "enabled": u.enabled,
            "max_connections": u.max_connections,
            "bandwidth_limit": u.bandwidth_limit,
            "expire_at": u.expire_at or "",
            "bytes_in": u_bytes_in,
            "bytes_out": u_bytes_out,
            "mode": u.mode or "performance",
            "obfs": u.obfs or "none"
        })

    # Load existing config for persistence
    existing = {}
    if config_path.exists():
        try:
            existing = json.loads(config_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass

    # Safely extract existing values (handle both Flat and Nested legacy formats)
    old_server_block = existing.get("server", {}) if isinstance(existing.get("server"), dict) else {}
    old_security_block = existing.get("security", {}) if isinstance(existing.get("security"), dict) else {}

    listen = old_server_block.get("listen") or f":{existing.get('port', 4433)}"
    mode = old_server_block.get("mode") or existing.get("mode") or "performance"
    log_level = old_server_block.get("log_level") or "info"
    
    cert_file = old_security_block.get("cert_file") or existing.get("cert") or settings.CERT_FILE
    key_file = old_security_block.get("key_file") or existing.get("key") or settings.KEY_FILE

    # Core 1.1 structured format
    config = {
        "server": {
            "listen": listen,
            "mode": mode.lower(),
            "log_level": log_level
        },
        "security": {
            "cert_file": cert_file,
            "key_file": key_file
        },
        "features": {
            "hot_reload": True,
            "connection_tracking": True,
            "disconnect_expired": True
        },
        "users": user_list,
        "max_conns": int(existing.get("max_conns", 0)),
        "allowed_hosts": existing.get("allowed_hosts", []),
        "blocked_hosts": existing.get("blocked_hosts", [])
    }

    try:
        config_path.write_text(json.dumps(config, indent=2))
    except PermissionError:
        raise HTTPException(
            status_code=500,
            detail=f"Permission denied writing {config_path}. "
                   f"Run: sudo touch {config_path} && sudo chmod 666 {config_path}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write config to {config_path}: {e}",
        )

    return str(config_path)


def _check_binary() -> Path:
    """Verify the hivoid-server binary exists and return its Path."""
    binary = Path(settings.HIVOID_BINARY_PATH)
    if not binary.exists():
        raise HTTPException(
            status_code=400,
            detail=f"HiVoid binary not found at {binary}. "
                   f"Please install the hivoid-server binary or update "
                   f"HIVOID_BINARY_PATH in your .env file.",
        )
    if not os.access(str(binary), os.X_OK):
        raise HTTPException(
            status_code=400,
            detail=f"HiVoid binary at {binary} is not executable. "
                   f"Run: chmod +x {binary}",
        )
    return binary


def _stop_process(pid: int):
    """Gracefully stop a process by PID, force-kill if needed."""
    try:
        os.kill(pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        return

    for _ in range(10):
        time.sleep(0.5)
        try:
            os.kill(pid, 0)
        except (ProcessLookupError, PermissionError, OSError):
            return

    # Force kill
    try:
        os.kill(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        pass


@router.get("/status", response_model=ProtocolStatusResponse)
def protocol_status(admin: Admin = Depends(get_current_admin)):
    """Get the current status of the HiVoid server process."""
    running, pid = _is_running()
    uptime_str = None

    if running and pid:
        try:
            import psutil
            proc = psutil.Process(pid)
            elapsed = time.time() - proc.create_time()
            days, rem = divmod(int(elapsed), 86400)
            hours, rem = divmod(rem, 3600)
            minutes, secs = divmod(rem, 60)
            parts = []
            if days:
                parts.append(f"{days}d")
            if hours:
                parts.append(f"{hours}h")
            if minutes:
                parts.append(f"{minutes}m")
            parts.append(f"{secs}s")
            uptime_str = " ".join(parts)
        except Exception:
            uptime_str = "unknown"

    return ProtocolStatusResponse(running=running, pid=pid, uptime=uptime_str)


@router.post("/start", response_model=MessageResponse)
def protocol_start(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Start the HiVoid server process."""
    running, _ = _is_running()
    if running:
        raise HTTPException(status_code=400, detail="Protocol is already running")

    binary = _check_binary()
    config_path = sync_server_config(db)

    try:
        proc = subprocess.Popen(
            [str(binary), "start", "--config", config_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        # Wait briefly to check it did not crash immediately
        time.sleep(1.5)
        if proc.poll() is not None:
            stderr_output = ""
            try:
                stderr_output = proc.stderr.read().decode(errors="replace")[:500]
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail=f"HiVoid server exited immediately. {stderr_output}".strip(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start process: {e}")

    return MessageResponse(message="HiVoid server started successfully")


@router.post("/stop", response_model=MessageResponse)
def protocol_stop(admin: Admin = Depends(get_current_admin)):
    """Stop the HiVoid server process."""
    running, pid = _is_running()
    if not running or pid is None:
        raise HTTPException(status_code=400, detail="Protocol is not running")

    try:
        _stop_process(pid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop: {e}")

    # Clean up PID file
    try:
        _pid_path().unlink(missing_ok=True)
    except Exception:
        pass

    return MessageResponse(message="HiVoid server stopped successfully")


@router.post("/restart", response_model=MessageResponse)
def protocol_restart(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Restart the HiVoid server process (stop + start)."""
    running, pid = _is_running()

    # Stop if running
    if running and pid:
        try:
            _stop_process(pid)
        except Exception:
            pass
        try:
            _pid_path().unlink(missing_ok=True)
        except Exception:
            pass
        time.sleep(1)

    # Start
    binary = _check_binary()
    config_path = sync_server_config(db)

    try:
        proc = subprocess.Popen(
            [str(binary), "start", "--config", config_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        time.sleep(1.5)
        if proc.poll() is not None:
            stderr_output = ""
            try:
                stderr_output = proc.stderr.read().decode(errors="replace")[:500]
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail=f"HiVoid server exited immediately after restart. {stderr_output}".strip(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restart: {e}")

    return MessageResponse(message="HiVoid server restarted successfully")


@router.post("/sync-config", response_model=MessageResponse)
def sync_config(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Re-write server.json from the database without restarting.
    Useful for updating allowed_uuids dynamically.
    """
    config_path = sync_server_config(db)
    return MessageResponse(message=f"Configuration synced to {config_path}")
