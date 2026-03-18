import os
import shutil
import zipfile
import requests
import time
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


class PanelUpdater:
    GITHUB_API_URL = "https://api.github.com/repos/hivoid-org/hivoid-panel/releases/latest"
    
    def __init__(self, panel_root: Path):
        self.panel_root = panel_root
        self.backend_dir = panel_root / "backend"
        self.frontend_dir = panel_root / "frontend"

    def update(self) -> bool:
        """Fetch and apply the latest panel release over the current installation."""
        try:
            logger.info("Checking for HiVoid Panel updates...")
            response = requests.get(self.GITHUB_API_URL, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            tag = data.get('tag_name')
            assets = data.get('assets', [])
            
            # Find the ZIP asset (the one containing both backend/ and frontend/)
            zip_asset = None
            for asset in assets:
                if asset['name'].endswith(".zip") and "panel" in asset['name'].lower():
                    zip_asset = asset
                    break
            
            if not zip_asset:
                # Fallback: take the first ZIP if no name matches "panel" specifically
                for asset in assets:
                    if asset['name'].endswith(".zip"):
                        zip_asset = asset
                        break

            if not zip_asset:
                logger.error("No deployment ZIP found in the latest panel release.")
                return False

            logger.info(f"Downloading Panel update {tag}: {zip_asset['name']}...")
            
            with TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                zip_path = tmp_path / "panel_update.zip"
                
                # 1. Download
                with requests.get(zip_asset['browser_download_url'], stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(zip_path, 'wb') as f:
                        shutil.copyfileobj(r.raw, f)
                
                # 2. Extract
                extract_path = tmp_path / "extracted"
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_path)
                
                # Determine source directory (handle nested folders in ZIP)
                src = extract_path
                if (extract_path / "hivoid-panel").is_dir():
                    src = extract_path / "hivoid-panel"
                
                # 3. Apply Update (Backup and Move)
                logger.info("Applying panel update...")
                
                # Backend Update
                if (src / "backend").is_dir():
                    # Preserve .env and venv!
                    logger.debug("Syncing backend files...")
                    self._sync_folder(src / "backend", self.backend_dir, exclude=[".env", "venv", "__pycache__"])
                
                # Frontend Update
                if (src / "frontend").is_dir():
                    logger.debug("Updating frontend assets...")
                    # Usually we only care about 'dist' if it was pre-built, or the whole folder
                    self._sync_folder(src / "frontend", self.frontend_dir, exclude=["node_modules"])
                
                logger.info(f"HiVoid Panel updated to {tag} successfully.")
                return True

        except Exception as e:
            logger.exception(f"Panel update failed: {e}")
            return False

    def _sync_folder(self, src: Path, dst: Path, exclude=None):
        """Copies files from src to dst, overwriting existing but preserving excluded items."""
        if exclude is None:
            exclude = []
        
        if not dst.exists():
            dst.mkdir(parents=True, exist_ok=True)
            
        for item in src.iterdir():
            if item.name in exclude:
                continue
                
            target = dst / item.name
            if item.is_dir():
                self._sync_folder(item, target, exclude=exclude)
            else:
                shutil.copy2(item, target)
