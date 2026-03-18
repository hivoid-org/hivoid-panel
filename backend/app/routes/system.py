"""
System monitoring routes: CPU, RAM, uptime.
"""
import time
import psutil
from fastapi import APIRouter, Depends

from app.models import Admin
from app.schemas import SystemStatsResponse
from app.auth import get_current_admin

router = APIRouter(prefix="/api/system", tags=["System"])

# Boot time is constant per-process
_BOOT_TIME = psutil.boot_time()


def _human_uptime(seconds: float) -> str:
    """Convert seconds to a human-readable string."""
    days, rem = divmod(int(seconds), 86400)
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
    return " ".join(parts)


@router.get("/stats", response_model=SystemStatsResponse)
def system_stats(admin: Admin = Depends(get_current_admin)):
    """Return live system stats."""
    cpu = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count(logical=True)
    mem = psutil.virtual_memory()
    uptime = time.time() - _BOOT_TIME

    return SystemStatsResponse(
        cpu_percent=cpu,
        cpu_count=cpu_count,
        ram_total_gb=round(mem.total / (1024 ** 3), 2),
        ram_used_gb=round(mem.used / (1024 ** 3), 2),
        ram_percent=mem.percent,
        uptime_seconds=round(uptime, 1),
        uptime_human=_human_uptime(uptime),
    )


@router.get("/stats/history")
def system_stats_history(admin: Admin = Depends(get_current_admin)):
    """Return CPU usage per-core as a quick snapshot for graphs."""
    per_cpu = psutil.cpu_percent(interval=0.3, percpu=True)
    mem = psutil.virtual_memory()
    return {
        "cpu_per_core": per_cpu,
        "cpu_overall": sum(per_cpu) / len(per_cpu) if per_cpu else 0,
        "ram_percent": mem.percent,
        "timestamp": time.time(),
    }
