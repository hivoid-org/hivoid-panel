import os
import shutil
import zipfile
import requests
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Optional, Tuple
from .utils import get_os_arch, setup_logger, calculate_sha256

logger = setup_logger("updater")

class CoreUpdater:
    GITHUB_API_URL = "https://api.github.com/repos/hivoid-org/hivoid-core/releases/latest"
    
    def __init__(self, binary_path: Path, backup_dir: Path):
        self.binary_path = binary_path
        self.backup_dir = backup_dir
        self.os_type, self.arch_type = get_os_arch()

    def _get_latest_release_info(self) -> dict:
        """Fetch JSON data from GitHub API."""
        response = requests.get(self.GITHUB_API_URL, timeout=15)
        response.raise_for_status()
        return response.json()

    def _find_matching_asset(self, assets: list) -> Optional[dict]:
        """
        Match OS + ARCH + 'Server' version in asset names.
        Pattern example: hivoid-core-linux-amd64-Server-v1.0.0.zip
        """
        for asset in assets:
            name = asset['name'].lower()
            if self.os_type in name and self.arch_type in name and "server" in name and name.endswith(".zip"):
                return asset
        return None

    def update(self) -> bool:
        """Execute the full update lifecycle."""
        try:
            logger.info("Starting HiVoid Core update check...")
            data = self._get_latest_release_info()
            version = data.get('tag_name')
            assets = data.get('assets', [])
            
            target_asset = self._find_matching_asset(assets)
            if not target_asset:
                logger.error(f"No matching asset found for {self.os_type}-{self.arch_type} 'Server'")
                return False

            logger.info(f"Targeting version {version}: {target_asset['name']}")
            
            with TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                download_path = tmp_path / "latest.zip"
                
                # Download
                self._download_file(target_asset['browser_download_url'], download_path)
                
                # Extraction
                extract_path = tmp_path / "extracted"
                with zipfile.ZipFile(download_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_path)
                
                # Locate binary in extracted files
                # Assumes binary name is same as repo or similar
                new_binary = None
                for f in extract_path.rglob("*"):
                    if f.is_file() and ("hivoid-core" in f.name.lower()):
                        new_binary = f
                        break
                
                if not new_binary:
                    logger.error("Could not find binary in extracted package.")
                    return False
                
                # Apply update safely
                return self._apply_binary_update(new_binary)
                
        except Exception as e:
            logger.exception(f"Critical error during update: {e}")
            return False

    def _download_file(self, url: str, dest: Path):
        """Download with streaming for large files."""
        with requests.get(url, stream=True, timeout=30) as r:
            r.raise_for_status()
            with open(dest, 'wb') as f:
                shutil.copyfileobj(r.raw, f)

    def _apply_binary_update(self, new_binary_path: Path) -> bool:
        """Safe replacement logic with backup and rollback."""
        backup_path = self.backup_dir / f"hivoid_core_backup_{int(time.time())}"
        
        try:
            # 1. Backup old binary if it exists
            if self.binary_path.exists():
                logger.debug(f"Backing up current binary to {backup_path}")
                shutil.copy2(self.binary_path, backup_path)
            
            # 2. Replace with new binary
            logger.info(f"Replacing binary: {self.binary_path}")
            shutil.copy2(new_binary_path, self.binary_path)
            
            # 3. Set executable permissions (important for Linux/Mac)
            if self.os_type != "windows":
                os.chmod(self.binary_path, 0o755)
            
            logger.info("Binary update applied successfully.")
            return True
            
        except Exception as e:
            logger.error(f"Failed to replace binary: {e}")
            # Rollback Attempt
            if backup_path.exists():
                logger.warning("Attempting rollback from backup...")
                shutil.copy2(backup_path, self.binary_path)
            return False
        finally:
            # Clean up old backups if necessary (retention policy)
            # Implemented elsewhere if needed
            pass
