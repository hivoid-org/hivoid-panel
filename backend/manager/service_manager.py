import os
from pathlib import Path
from typing import Dict, Optional
from .process_manager import ProcessManager
from .updater import CoreUpdater
from .config_manager import ConfigManager
from .utils import setup_logger, ensure_dir

logger = setup_logger("service_manager")

class HiVoidManager:
    # Standard paths for production deployment
    DEFAULT_BINARY = Path("/usr/local/bin/hivoid-server")
    DEFAULT_CONFIG = Path("/opt/hivoid-panel/data/server.json")
    DEFAULT_DB = Path("/opt/hivoid-panel/backend/data/hivoid_panel.db")
    DEFAULT_PID = Path("/tmp/hivoid-server.pid")
    DEFAULT_BACKUP = Path("/opt/hivoid-panel/backups")

    def __init__(self, binary_path: Optional[Path] = None):
        self.binary_path = binary_path or self.DEFAULT_BINARY
        self.config_path = self.DEFAULT_CONFIG
        self.db_path = self.DEFAULT_DB
        self.pid_path = self.DEFAULT_PID
        self.backup_dir = self.DEFAULT_BACKUP
        
        # Ensure backup dir exists
        ensure_dir(self.backup_dir)

        # Initialize sub-managers
        self.proc = ProcessManager(self.binary_path, self.config_path, self.pid_path)
        self.updater = CoreUpdater(self.binary_path, self.backup_dir)
        self.config_mgr = ConfigManager(self.config_path, self.db_path)

    def start_service(self) -> bool:
        """Start core if not running."""
        return self.proc.start()

    def stop_service(self) -> bool:
        """Stop core if running."""
        return self.proc.stop()

    def restart_service(self) -> bool:
        """Restart core."""
        return self.proc.restart()

    def get_status(self) -> Dict:
        """Fetch running status and PID."""
        running, pid = self.proc.is_running()
        return {
            "status": "running" if running else "stopped",
            "pid": pid,
            "version": "unknown"  # Potentially read from binary -v
        }

    def reset_admin_password(self, new_password: str) -> bool:
        """Change the administrator password."""
        return self.config_mgr.reset_admin_password(new_password)

    def change_panel_port(self, new_port: int) -> bool:
        """Update the web panel listening port in .env and systemd."""
        env_file = Path("/opt/hivoid-panel/backend/.env")
        if not env_file.exists():
            logger.error(".env file not found for port update")
            return False

        try:
            # 1. Update .env file
            lines = env_file.read_text().splitlines()
            new_lines = []
            updated = False
            for line in lines:
                if line.startswith("PANEL_PORT="):
                    new_lines.append(f"PANEL_PORT={new_port}")
                    updated = True
                else:
                    new_lines.append(line)
            
            if not updated:
                new_lines.append(f"PANEL_PORT={new_port}")
            
            env_file.write_text("\n".join(new_lines))

            # 2. Update Systemd service if on Linux
            service_path = Path(f"/etc/systemd/system/hivoid-panel-backend.service")
            if service_path.exists():
                content = service_path.read_text()
                # Find the uvicorn command and replace the port
                import re
                new_content = re.sub(r'--port \d+', f'--port {new_port}', content)
                service_path.write_text(new_content)
                os.system("systemctl daemon-reload")
            
            logger.info(f"Panel port migrated to {new_port}. Restarting...")
            return self.restart_panel()
        except Exception as e:
            logger.error(f"Failed to change port: {e}")
            return False

    def restart_panel(self) -> bool:
        """Restart the backend panel service via systemctl."""
        return os.system("systemctl restart hivoid-panel-backend") == 0

    def delete_service(self) -> bool:
        """Remove binary and config. This is destructive."""
        self.stop_service()
        return self.config_mgr.delete_service(self.binary_path)

    def update_core(self) -> bool:
        """
        Check GitHub, download, verify and replace core binary.
        Restarts service automatically after success.
        """
        # 1. Update the binary
        success = self.updater.update()
        
        # 2. If update was successful, restart to use new version
        if success:
            logger.info("Core updated, restarting service...")
            return self.restart_service()
        
        return False

# Usage Example:
# manager = HiVoidManager()
# manager.update_core()
