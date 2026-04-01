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
import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Admin, User, PanelSettings
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
    usage_path = Path(str(config_path) + ".usage.json")
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
            "enabled": True, # Only enabled users are in this list
            "max_connections": u.max_connections or 0,
            "max_ips": u.max_ips or 0,
            "bind_ip": u.bind_ip or "",
            "bandwidth_limit": u.bandwidth_limit or 0,
            "data_limit": u.data_limit_gb * 1073741824 if u.data_limit_gb else 0,
            "expire_at": u.expire_at or "",
            "bytes_in": u_bytes_in,
            "bytes_out": u_bytes_out,
            "mode": u.mode or "performance",
            "obfs": u.obfs or "none",
            "blocked_hosts": [h.strip() for h in u.blocked_hosts.split(",") if h.strip()] if u.blocked_hosts else [],
            "blocked_tags": [t.strip() for t in u.blocked_tags.split(",") if t.strip()] if u.blocked_tags else []
        })

    # Load panel settings for global config defaults
    s = db.query(PanelSettings).first()
    panel_config = {}
    if s and s.hivoid_config:
        try:
            panel_config = json.loads(s.hivoid_config)
            if not isinstance(panel_config, dict):
                panel_config = {}
        except Exception:
            panel_config = {}

    config = {
        "server": {
            "listen": panel_config.get("listen") or f":{panel_config.get('port', 4433)}",
            "mode": (panel_config.get("mode") or "performance").lower(),
            "log_level": panel_config.get("log_level") or "info"
        },
        "name": panel_config.get("name") or "HiVoid-Node",
        "security": {
            "cert_file": panel_config.get("cert_file") or str(Path(settings.CERT_FILE).resolve()),
            "key_file": panel_config.get("key_file") or str(Path(settings.KEY_FILE).resolve())
        },
        "features": {
            "hot_reload": bool(panel_config.get("hot_reload", True)),
            "connection_tracking": bool(panel_config.get("connection_tracking", True)),
            "disconnect_expired": bool(panel_config.get("disconnect_expired", True))
        },
        "max_conns": int(panel_config.get("max_conns", 1000)),
        "anti_probe": bool(panel_config.get("anti_probe", True)),
        "fallback_addr": panel_config.get("fallback_addr", "127.0.0.1:80"),
        "geoip_path": panel_config.get("geoip_path") or "/opt/hivoid-panel/backend/data/geoip.dat",
        "geosite_path": panel_config.get("geosite_path") or "/opt/hivoid-panel/backend/data/geosite.dat",
        "allowed_hosts": panel_config.get("allowed_hosts") if isinstance(panel_config.get("allowed_hosts"), list) else [],
        "blocked_hosts": panel_config.get("blocked_hosts") if isinstance(panel_config.get("blocked_hosts"), list) else [],
        "blocked_tags": panel_config.get("blocked_tags") if isinstance(panel_config.get("blocked_tags"), list) else [],
        "users": user_list
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
def protocol_status(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)):
    """Get the current status of the HiVoid server process."""
    running, pid = _is_running()
    uptime_str = None
    version_str = "unknown"

    try:
        binary = Path(settings.HIVOID_BINARY_PATH)
        if binary.exists():
            res = subprocess.run([str(binary), "version"], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                v = res.stdout.strip().split("\n")[0]
                while "vv" in v.lower():
                    v = v.replace("vv", "v").replace("VV", "V")
                version_str = v
    except Exception:
        pass

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

    # Check if Anti-Probe is enabled in config
    anti_probe = True # Default
    ps = db.query(PanelSettings).first()
    if ps and ps.hivoid_config:
        try:
            cfg = json.loads(ps.hivoid_config)
            anti_probe = cfg.get("anti_probe", True)
        except:
            pass

    cert_pin = None
    cert_pinning = False
    try:
        cert_path = Path(settings.CERT_FILE)
        if cert_path.exists():
            res = subprocess.run(
                ["openssl", "x509", "-in", str(cert_path), "-outform", "DER"],
                capture_output=True,
                check=True
            )
            der_content = res.stdout
            m = hashlib.sha256()
            m.update(der_content)
            cert_pin = m.hexdigest()
            cert_pinning = True
    except Exception as e:
        logger.error(f"Cert Pin calculation failed: {e}")

    # Check geodata
    geodata_installed = False
    try:
        paths = [Path("geoip.dat"), Path("geosite.dat"), Path("data/geoip.dat"), Path("data/geosite.dat")]
        geosite_ok = any(p.name == "geosite.dat" and p.exists() for p in paths)
        geoip_ok = any(p.name == "geoip.dat" and p.exists() for p in paths)
        geodata_installed = geosite_ok and geoip_ok
    except: pass

    return ProtocolStatusResponse(
        running=running, 
        pid=pid, 
        uptime=uptime_str, 
        version=version_str, 
        cert_pin=cert_pin,
        anti_probe=anti_probe, # Reflects setting
        cert_pinning=cert_pinning,
        geodata_installed=geodata_installed
    )


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


@router.post("/generate-cert", response_model=MessageResponse)
def generate_cert(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Generate new TLS self-signed certificates for the proxy.
    """
    cert_path = Path(settings.CERT_FILE)
    key_path = Path(settings.KEY_FILE)
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    
    import subprocess
    cmd = [
        "openssl", "req", "-new", "-newkey", "rsa:2048", "-days", "3650",
        "-nodes", "-x509", "-subj", "/C=US/ST=State/L=City/O=HiVoid/CN=hivoid.proxy",
        "-keyout", str(key_path), "-out", str(cert_path)
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(res.stderr)
        running, pid = _is_running()
        if running:
             import threading
             from app.routes.protocol import _stop_process, _check_binary
             def do_restart():
                 _stop_process(pid)
                 time.sleep(1)
                 subprocess.Popen(
                     [str(_check_binary()), "start", "--config", str(settings.HIVOID_CONFIG_PATH)],
                     stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, start_new_session=True
                 )
             threading.Thread(target=do_restart).start()
        
        return MessageResponse(message="Certificates successfully regenerated.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSSL failed: {e}")

@router.post("/download-geodata", response_model=MessageResponse)
def download_geodata(
    admin: Admin = Depends(get_current_admin),
):
    """
    Download latest geoip.dat and geosite.dat from official v2fly sources.
    """
    import urllib.request
    try:
        urllib.request.urlretrieve("https://github.com/v2fly/geoip/releases/latest/download/geoip.dat", "geoip.dat")
        urllib.request.urlretrieve("https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat", "geosite.dat")
        return MessageResponse(message="Routing dat files successfully fetched and updated.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch GeoData: {e}")

@router.post("/shock", response_model=MessageResponse)
def protocol_shock(admin: Admin = Depends(get_current_admin)):
    """Force Reconnect (Shock) the HiVoid server."""
    binary = _check_binary()
    try:
        subprocess.run([str(binary), "shock"], check=True)
        return MessageResponse(message="Shock command issued successfully.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shock failed: {e}")


@router.get("/active-sessions")
def list_active_sessions(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """List active HiVoid sessions using the core engine's JSON output with DB labels."""
    def fmt_bytes(b):
        if not b: return "0 B"
        if b < 1024: return f"{b} B"
        for unit in ['KB', 'MB', 'GB', 'TB']:
            b /= 1024
            if b < 1024: return f"{b:.1f} {unit}"
        return f"{b:.1f} PB"

    binary = _check_binary()
    try:
        res = subprocess.run([str(binary), "list", "--json"], capture_output=True, text=True, timeout=5)
        if res.returncode != 0:
            return []
        
        try:
            raw_sessions = json.loads(res.stdout)
        except:
            return []

        # Fetch all users to map UUID -> Name/Email
        users_map = {u.uuid: (u.name, u.email) for u in db.query(User).all()}

        sessions = []
        for s in raw_sessions:
            uid = s.get("uuid") or ""
            db_name, db_email = users_map.get(uid, ("Offline/Unknown", s.get("email") or "Anonymous"))
            
            sessions.append({
                "email": db_email,
                "db_name": db_name,
                "node": s.get("config_name") or "Main",
                "uuid": uid,
                "ip": s.get("remote_addr") or "",
                "uptime": s.get("duration") or "0s",
                "bytes_in": fmt_bytes(s.get("traffic_in", 0)),
                "bytes_out": fmt_bytes(s.get("traffic_out", 0)),
                "total_bytes": fmt_bytes(s.get("traffic_in", 0) + s.get("traffic_out", 0))
            })
        
        return sessions
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        return []
