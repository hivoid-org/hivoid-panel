"""
In-memory storage for remote nodes WebSocket connections, sessions, and telemetry reports.
"""

# active_node_sessions maps (node_id, uuid) -> session details dictionary
active_node_sessions = {}

# node_telemetry maps node_id -> telemetry details dictionary
node_telemetry = {}

# connected_sockets maps node_id -> active WebSocket instance
connected_sockets = {}
