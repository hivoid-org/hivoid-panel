import platform
import hashlib
import logging
import sys
from pathlib import Path

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        # Colored and neat log format with date and time
        class ColoredFormatter(logging.Formatter):
            COLORS = {
                'DEBUG': '\033[36m',    # Cyan
                'INFO': '\033[32m',     # Green
                'WARNING': '\033[33m',  # Yellow
                'ERROR': '\033[31m',    # Red
                'CRITICAL': '\033[41m', # Red background
            }
            RESET = '\033[0m'
            def format(self, record):
                levelname = record.levelname
                color = self.COLORS.get(levelname, '')
                msg = f"{color}[{levelname}] {record.name}: {record.getMessage()}{self.RESET}"
                return msg
        formatter = ColoredFormatter()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger

def get_os_arch() -> tuple[str, str]:
    """Detect and normalize OS and Architecture strings."""
    os_name = platform.system().lower()
    if os_name == "darwin":
        os_name = "mac"
    
    arch = platform.machine().lower()
    if arch in ["x86_64", "amd64"]:
        arch = "amd64"
    elif arch in ["arm64", "aarch64"]:
        arch = "arm64"
    
    return os_name, arch

def calculate_sha256(file_path: Path) -> str:
    """Calculate SHA256 checksum of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def ensure_dir(path: Path):
    """Ensure directory exists with proper permissions."""
    path.mkdir(parents=True, exist_ok=True)
