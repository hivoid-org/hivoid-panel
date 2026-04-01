import os
from pathlib import Path
from typing import Dict, Optional
from .process_manager import ProcessManager
from .updater import CoreUpdater, PanelUpdater
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
    DEFAULT_PANEL_ROOT = Path("/opt/hivoid-panel")
    DEFAULT_BACKEND_DIR = Path("/opt/hivoid-panel/backend")
    DEFAULT_CLI_PATH = Path("/usr/local/bin/hivoid")

    def __init__(self, binary_path: Optional[Path] = None):
        self.binary_path = binary_path or self.DEFAULT_BINARY
        self.config_path = self.DEFAULT_CONFIG
        self.db_path = self.DEFAULT_DB
        self.pid_path = self.DEFAULT_PID
        self.backup_dir = self.DEFAULT_BACKUP
        self.panel_root = self.DEFAULT_PANEL_ROOT
        self.backend_dir = self.DEFAULT_BACKEND_DIR
        self.cli_path = self.DEFAULT_CLI_PATH
        
        # Ensure backup dir exists
        ensure_dir(self.backup_dir)

        # Initialize sub-managers
        self.proc = ProcessManager(self.binary_path, self.config_path, self.pid_path)
        self.core_updater = CoreUpdater(self.binary_path, self.backup_dir)
        self.panel_updater = PanelUpdater(self.panel_root)
        self.config_mgr = ConfigManager(self.config_path, self.db_path)

    def refresh_cli_wrapper(self) -> bool:
        """Recreate /usr/local/bin/hivoid wrapper so CLI tracks latest backend code."""
        wrapper = (
            "#!/bin/bash\n"
            f'export DATABASE_URL="sqlite:///{self.db_path}"\n'
            f"cd {self.backend_dir}\n"
            './venv/bin/python3 -m manager.cli "$@"\n'
        )
        try:
            tmp_path = self.cli_path.with_suffix(".tmp")
            tmp_path.write_text(wrapper)
            os.chmod(tmp_path, 0o755)
            tmp_path.replace(self.cli_path)
            logger.info(f"CLI wrapper refreshed at {self.cli_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to refresh CLI wrapper: {e}")
            return False

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

    def uninstall_service(self) -> bool:
        """Fully remove HiVoid Core, Panel, Services, and CLI. This is a total purge."""
        logger.warning("Initiating full system removal...")
        
        # 1. Stop and disable services
        services = ["hivoid-panel-backend", "hivoid-server"]
        for svc in services:
            logger.info(f"Terminating and removing service: {svc}")
            os.system(f"systemctl stop {svc} > /dev/null 2>&1")
            os.system(f"systemctl disable {svc} > /dev/null 2>&1")
            # Kill any orphaned processes
            os.system(f"pkill -9 -f {svc} > /dev/null 2>&1")
            
            svc_file = Path(f"/etc/systemd/system/{svc}.service")
            if svc_file.exists():
                svc_file.unlink()
        
        os.system("systemctl daemon-reload")

        # 2. Remove Global Binaries / CLI hooks
        logger.info("Removing management CLI and core binaries...")
        binaries = [
            Path("/usr/local/bin/hivoid-server"),
            Path("/usr/local/bin/hivoid")
        ]
        for b in binaries:
            if b.exists():
                try:
                    b.unlink()
                except Exception as e:
                    logger.error(f"Failed to delete {b}: {e}")

        # 3. Wipe the entire project directory
        target_dir = Path("/opt/hivoid-panel")
        if target_dir.exists():
            logger.info(f"Wiping {target_dir} completely...")
            try:
                # Use shell rm -rf for the directory to handle permission issues more robustly in Linux
                os.system(f"rm -rf {target_dir}")
            except Exception as e:
                logger.error(f"Failed to wipe /opt/hivoid-panel: {e}")

        logger.info("HiVoid Ecosystem has been totally purged from this system.")
        return True

    def update_core(self) -> bool:
        """
        Check GitHub, download, verify and replace core binary.
        Restarts service automatically after success.
        """
        # 1. Update the binary
        success = self.core_updater.update()
        
        # 2. If update was successful, restart to use new version
        if success:
            logger.info("Core updated, restarting engine and panel...")
            self.restart_service()
            return self.restart_panel()
        
        return False

    def update_panel(self) -> bool:
        """
        Check GitHub, download panel ZIP and apply to /opt/hivoid-panel/.
        Restarts the panel service automatically.
        """
        # 1. Update panel source code
        success = self.panel_updater.update()
        
        # 2. Refresh CLI wrapper so `hivoid` always points to updated backend manager code
        if success:
            self.refresh_cli_wrapper()
            return self.restart_panel()
        return False

    def view_logs(self, service: str = "core") -> None:
        """Stream live logs from systemd journal."""
        svc_name = "hivoid-server" if service == "core" else "hivoid-panel-backend"
        print(f"\n\033[1;36mStreaming logs for {svc_name} (CTRL+C to exit)...\033[0m")
        os.system(f"journalctl -u {svc_name} -f -n 50")

    def create_backup(self) -> str:
        """Create a timestamped backup of config and database."""
        from datetime import datetime
        import zipfile
        import shutil

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ensure_dir(self.backup_dir)
        backup_path = self.backup_dir / f"hivoid_backup_{timestamp}.zip"
        
        try:
            with zipfile.ZipFile(str(backup_path), 'w') as zipf:
                if self.config_path.exists():
                    zipf.write(str(self.config_path), arcname="server.json")
                if self.db_path.exists():
                    zipf.write(str(self.db_path), arcname="hivoid_panel.db")
            return str(backup_path)
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return ""

    def restore_backup(self, backup_file: str) -> bool:
        """Restore config and database from a backup zip."""
        import zipfile
        import shutil

        path = Path(backup_file)
        if not path.exists():
            return False

        try:
            with zipfile.ZipFile(str(path), 'r') as zipf:
                tmp_extract = Path("/tmp/hivoid_restore")
                ensure_dir(tmp_extract)
                zipf.extractall(str(tmp_extract))
                
                if (tmp_extract / "server.json").exists():
                    shutil.copy(str(tmp_extract / "server.json"), str(self.config_path))
                if (tmp_extract / "hivoid_panel.db").exists():
                    shutil.copy(str(tmp_extract / "hivoid_panel.db"), str(self.db_path))
                    
                shutil.rmtree(str(tmp_extract))
            
            self.restart_service()
            self.restart_panel()
            return True
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False

    def toggle_autostart(self, enable: bool = True) -> bool:
        """Enable or disable services from starting on boot."""
        action = "enable" if enable else "disable"
        services = ["hivoid-panel-backend", "hivoid-server"]
        for svc in services:
            os.system(f"systemctl {action} {svc} > /dev/null 2>&1")
        return True

    def get_system_stats(self) -> Dict:
        """Fetch system-wide CPU and RAM stats."""
        import psutil
        return {
            "cpu_percent": psutil.cpu_percent(),
            "ram_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }


# Usage Example:
# manager = HiVoidManager()
# manager.update_core()
