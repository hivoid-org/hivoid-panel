import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import User, PanelSettings
from app.config import settings
from app.hub_store import active_node_sessions, node_telemetry, connected_sockets

router = APIRouter(prefix="/api/v1", tags=["Hub"])
logger = logging.getLogger("hivoid.hub")

def get_node_token() -> str:
    """Load authorized node token from settings database override or default."""
    db = SessionLocal()
    try:
        s = db.query(PanelSettings).first()
        if s and s.hivoid_config:
            try:
                cfg = json.loads(s.hivoid_config)
                if isinstance(cfg, dict) and "node_token" in cfg:
                    return str(cfg["node_token"])
            except Exception:
                pass
        # Fallback
        return getattr(settings, "SECRET_KEY", "hivoid_secret_token")
    finally:
        db.close()

def build_sync_payload(db: Session) -> Dict:
    """Build list of users and rules for SYNC command."""
    enabled_users = db.query(User).filter(User.enabled == True).all()
    user_list = []
    for u in enabled_users:
        expire_unix = 0
        if u.expire_at:
            try:
                # ISO datetime to unix timestamp
                expire_unix = int(datetime.fromisoformat(u.expire_at.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass

        user_list.append({
            "uuid": u.uuid,
            "email": u.email or "",
            "enabled": True,
            "is_active": True,
            "max_connections": u.max_connections or 0,
            "max_ips": u.max_ips or 0,
            "bind_ip": u.bind_ip or "",
            "bandwidth_limit": u.bandwidth_limit or 0,
            "data_limit": u.data_limit_gb * 1073741824 if u.data_limit_gb else 0,
            "expire_at": u.expire_at or "",
            "expire_at_unix": expire_unix,
            "bytes_in": u.bytes_in,
            "bytes_out": u.bytes_out,
            "mode": u.mode or "performance",
            "obfs": u.obfs or "none"
        })
    return {"users": user_list}

async def send_downstream_command(node_id: str, kind: str, payload: Dict):
    """Utility to send command down to a specific active node websocket."""
    ws = connected_sockets.get(node_id)
    if ws:
        msg = {
            "kind": kind,
            "payload": payload
        }
        await ws.send_text(json.dumps(msg))

async def handle_ws(websocket: WebSocket, client_token: str, node_id: str):
    # Verify auth token
    auth_token = get_node_token()
    if client_token != auth_token:
        logger.warning(f"Unauthorized connection attempt from node={node_id}")
        await websocket.close(code=4003, reason="Unauthorized token")
        return

    await websocket.accept()
    logger.info(f"Node connected: {node_id}")
    connected_sockets[node_id] = websocket

    db = SessionLocal()
    try:
        # Immediately push SYNC on connect
        sync_data = build_sync_payload(db)
        await websocket.send_text(json.dumps({
            "kind": "SYNC",
            "payload": sync_data
        }))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                logger.error("Failed to parse JSON message from node")
                continue

            kind = msg.get("kind") or msg.get("type")
            payload = msg.get("payload") or {}

            if kind == "USAGE":
                rep_users = payload.get("users", [])
                pool = payload.get("request_pool", 1)

                for u_rep in rep_users:
                    uuid_str = u_rep.get("uuid")
                    if not uuid_str:
                        continue
                    
                    # Update DB Usage
                    u_db = db.query(User).filter(User.uuid == uuid_str).first()
                    if u_db:
                        rep_in = u_rep.get("bytes_in", 0)
                        rep_out = u_rep.get("bytes_out", 0)
                        if rep_in > u_db.bytes_in:
                            u_db.bytes_in = rep_in
                        if rep_out > u_db.bytes_out:
                            u_db.bytes_out = rep_out
                        db.commit()

                    # Presence / Telemetry tracking
                    if pool > 0:
                        active_node_sessions[(node_id, uuid_str)] = {
                            "uuid": uuid_str,
                            "email": u_rep.get("email") or "",
                            "node": node_id,
                            "ip": u_rep.get("src_ip") or "",
                            "uptime": u_rep.get("connected_at") or "",
                            "bytes_in": u_rep.get("bytes_in", 0),
                            "bytes_out": u_rep.get("bytes_out", 0)
                        }
                    else:
                        active_node_sessions.pop((node_id, uuid_str), None)

                # If no users reported but request_pool is 0, clean up node's sessions
                if not rep_users or pool == 0:
                    for key in list(active_node_sessions.keys()):
                        if key[0] == node_id:
                            active_node_sessions.pop(key, None)

            elif kind == "REPORT":
                node_telemetry[node_id] = {
                    "cpu_usage": payload.get("cpu_usage", 0.0),
                    "ram_usage": payload.get("ram_usage", 0.0),
                    "process_cpu_usage": payload.get("process_cpu_usage", 0.0),
                    "process_ram_usage_mb": payload.get("process_ram_usage_mb", 0.0),
                    "uptime_seconds": payload.get("uptime_seconds", 0),
                    "active_connections": payload.get("active_connections", 0),
                    "timestamp": time.time()
                }

            elif kind in ("COMMAND_ACK", "COMMAND_RESULT", "INSTALL_RESULT"):
                logger.info(f"Node acknowledgment received [{kind}] from {node_id}: {payload}")

    except WebSocketDisconnect:
        logger.info(f"Node disconnected: {node_id}")
    finally:
        connected_sockets.pop(node_id, None)
        db.close()
        # Clean up node sessions
        for key in list(active_node_sessions.keys()):
            if key[0] == node_id:
                active_node_sessions.pop(key, None)

@router.websocket("/nodes/ws")
async def ws_nodes_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    node_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    # Retrieve token from header or query param
    client_token = token
    if not client_token and authorization and authorization.startswith("Bearer "):
        client_token = authorization.split(" ")[1]

    # Resolve Node ID
    resolved_node_id = node_id or websocket.client.host
    await handle_ws(websocket, client_token, resolved_node_id)

@router.websocket("/node/ws")
async def ws_node_fallback_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    node_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    client_token = token
    if not client_token and authorization and authorization.startswith("Bearer "):
        client_token = authorization.split(" ")[1]

    resolved_node_id = node_id or websocket.client.host
    await handle_ws(websocket, client_token, resolved_node_id)
