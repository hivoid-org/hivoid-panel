import json
import sqlite3
import os
import bcrypt
from pathlib import Path
from typing import Optional, Dict
from .utils import setup_logger

logger = setup_logger("config_manager")

class ConfigManager:
    def __init__(self, config_file: Path, db_file: Path):
        self.config_file = config_file
        self.db_file = db_file

    def get_config(self) -> Optional[Dict]:
        """Read and parse the server.json file."""
        try:
            if not self.config_file.exists():
                return None
            return json.loads(self.config_file.read_text())
        except Exception as e:
            logger.error(f"Failed to read config: {e}")
            return None

    def update_config(self, new_data: Dict) -> bool:
        """Overwrite the config file atomically and safely."""
        try:
            # Write to a temporary file first
            tmp_file = self.config_file.with_suffix(".tmp")
            with open(tmp_file, "w") as f:
                json.dump(new_data, f, indent=4)
            
            # Atomic rename (POSIX only, Windows has issues with replacement)
            if os.name == "nt":
                if self.config_file.exists():
                    self.config_file.unlink()
                tmp_file.replace(self.config_file)
            else:
                tmp_file.rename(self.config_file)
                
            logger.info("Configuration file updated successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to write config: {e}")
            return False

    def reset_admin_password(self, new_password: str) -> bool:
        """
        Directly access the SQLite database to reset admin password.
        No dependency on external API, purely local.
        """
        if not self.db_file.exists():
            logger.error(f"Database not found at {self.db_file}")
            return False

        try:
            # Hash password using bcrypt (standard HiVoid panel backend methodology)
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(new_password.encode(), salt).decode()
            
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            # Attempt update
            cursor.execute("UPDATE admins SET hashed_password = ? WHERE username = 'admin'", (hashed,))
            
            # Check if updated (maybe username is not 'admin'?)
            if cursor.rowcount == 0:
                logger.warning("No user 'admin' found, trying first user ID 1")
                cursor.execute("UPDATE admins SET hashed_password = ? WHERE id = 1", (hashed,))
            
            conn.commit()
            conn.close()
            
            logger.info("Admin password reset successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to reset password: {e}")
            return False

    def delete_service(self, binary_path: Path):
        """Safely remove the binary and configuration files."""
        try:
            if binary_path.exists():
                binary_path.unlink()
            if self.config_file.exists():
                self.config_file.unlink()
            logger.warning("HiVoid service files removed from system.")
            return True
        except Exception as e:
            logger.error(f"Failed to delete service: {e}")
            return False
