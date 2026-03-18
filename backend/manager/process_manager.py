import os
import subprocess
import time
from pathlib import Path
from typing import Optional, Tuple
import psutil
from .utils import setup_logger

logger = setup_logger("process_manager")

class ProcessManager:
    def __init__(self, binary_path: Path, config_path: Path, pid_file: Path):
        self.binary_path = binary_path
        self.config_path = config_path
        self.pid_file = pid_file

    def _read_pid(self) -> Optional[int]:
        """Read current PID from file and verify it belongs to a running process."""
        try:
            if not self.pid_file.exists():
                return None
            
            pid = int(self.pid_file.read_text().strip())
            if psutil.pid_exists(pid):
                proc = psutil.Process(pid)
                if proc.is_running() and proc.status() != psutil.STATUS_ZOMBIE:
                    return pid
            return None
        except Exception:
            return None

    def is_running(self) -> Tuple[bool, Optional[int]]:
        """Check if the core is currently running."""
        pid = self._read_pid()
        return pid is not None, pid

    def start(self, env_vars: Optional[dict] = None) -> bool:
        """Start the core binary as a detached background process."""
        running, pid = self.is_running()
        if running:
            logger.warning(f"Core already running with PID: {pid}")
            return True

        if not self.binary_path.exists():
            logger.error(f"Binary not found: {self.binary_path}")
            return False

        if not self.config_path.exists():
            logger.error(f"Config not found: {self.config_path}")
            return False

        try:
            # Command structure: /path/to/binary start --config /path/to/config
            cmd = [str(self.binary_path), "start", "--config", str(self.config_path)]
            
            # Start process in background
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                env={**os.environ, **(env_vars or {})},
                start_new_session=True  # Ensure it doesn't die with our process
            )
            
            # Brief wait to see if it crashes immediately
            time.sleep(1.5)
            if process.poll() is not None:
                err = process.stderr.read().decode().strip()
                logger.error(f"Core process exited immediately: {err}")
                return False

            # Write PID to file
            self.pid_file.write_text(str(process.pid))
            logger.info(f"Core started successfully (PID: {process.pid})")
            return True
            
        except Exception as e:
            logger.exception(f"Exception during start: {e}")
            return False

    def stop(self, timeout: int = 10) -> bool:
        """Gracefully stop the core using SIGTERM, then SIGKILL if it persists."""
        running, pid = self.is_running()
        if not running or not pid:
            logger.info("Core is not running.")
            return True

        try:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)
            
            # Terminate parent
            parent.terminate()
            
            # Wait for all processes to finish
            _, alive = psutil.wait_procs(children + [parent], timeout=timeout)
            
            # Force kill any survivors
            for p in alive:
                logger.warning(f"Process {p.pid} did not exit, killing...")
                p.kill()
            
            # Remove PID file
            if self.pid_file.exists():
                self.pid_file.unlink()
                
            logger.info("Core stopped successfully.")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop core: {e}")
            return False

    def restart(self) -> bool:
        """Sequential stop and start."""
        if self.stop():
            return self.start()
        return False
