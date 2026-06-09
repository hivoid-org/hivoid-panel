# HiVoid Panel 🚀

<p align="center">
  <img src="logo/hi-logo-white-transparent.png" alt="Hi Void Logo" width="200" />
</p>

<p align="center">
  Professional management interface for the HiVoid encrypted proxy core.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v2.0.0-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MPL--2.0-green?style=flat-square" />
  <img src="https://img.shields.io/badge/core-v2.0.0--stable-purple?style=flat-square" />
  <img src="https://img.shields.io/badge/platform-Linux-lightgrey?style=flat-square" />
</p>

---

## ✨ What's New in v2.0.0

- **Hub-and-Node WebSocket Architecture**: The panel now acts as a central hub. Remote nodes running in Slave mode connect via WebSocket, receive real-time config syncs, and report live usage and telemetry back to the panel.
- **VoidReach Transport Support**: Full support for the VoidReach TCP/WebSocket transport layer — including `cdn`, `direct`, `fronting`, and `relay` modes — injected automatically into `server.json` and client subscriptions.
- **Live Traffic Accounting**: Usage data from remote nodes is merged with local sessions and reflected in real-time on the Live Connections dashboard.
- **Nested Config Schema**: Generates the new v2.0.0 structured `server.json` format (`server.listen`, `security.cert_file`, `features.*`), while maintaining backward compatibility with the flat format.
- **Core v2.0.0 Sync**: Full support for all new user policy fields — `max_ips`, `bandwidth_limit`, `data_limit`, `expire_at` (RFC3339), `bytes_in`, `bytes_out`.

---

## 🚀 One-Line Installation

Run the following command on your **Ubuntu 22.04/24.04** server:

```bash
curl -fsSL https://raw.githubusercontent.com/hivoid-org/hivoid-panel/main/install.sh | sudo bash
```

---

## 🖥 Web Dashboard

After installation, access the panel at:

```
https://YOUR_SERVER_IP:8443
```

| Field | Default |
|-------|---------|
| Username | `admin` |
| Password | `admin` |

> **Important:** Change your password immediately after first login.

---

## 🛠 Terminal Management (CLI)

Manage your server directly from the command line using the `hivoid` command:

| Command | Action |
|---------|--------|
| `hivoid` | Open the interactive TUI menu |
| `hivoid start` | Start the core service |
| `hivoid stop` | Stop the core service |
| `hivoid restart` | Restart the core service |
| `hivoid status` | Check service health |
| `hivoid update` | Update the core binary from GitHub |
| `hivoid reset-pass [PWD]` | Reset admin password |
| `hivoid change-port [PORT]` | Change the web panel port |

---

## 🔗 Hub Node Connection

To connect a remote node to this panel as a Hub, start the node with:

```bash
hivoid-server hub --config hub.json
```

The node will connect to the panel WebSocket at:

```
wss://YOUR_PANEL_IP:8443/api/v1/nodes/ws?token=<node_token>
```

Or using the `Authorization` header:

```
Authorization: Bearer <node_token>
```

> Configure the `node_token` under **Settings → Network & Core → Core JSON Override**.

---

## 🔒 Security First

1. Login and navigate to **Settings → Admin Account** — change your password immediately.
2. Enable **Two-Factor Authentication (2FA)** for extra login protection.
3. Set a strong `node_token` in the Core JSON config before connecting remote nodes.
4. Optionally change the web panel port via CLI: `hivoid change-port 9443`.

---

## 📁 System Paths

| Resource | Path |
|----------|------|
| Server Config | `/opt/hivoid-panel/data/server.json` |
| Usage Accounting | `/opt/hivoid-panel/data/server.json.usage.json` |
| Panel Database | `/opt/hivoid-panel/backend/data/hivoid_panel.db` |
| Backend Logs | `journalctl -u hivoid-panel-backend -f` |
| Core Binary | `/usr/local/bin/hivoid-server` |

---

## 📄 License

Licensed under the [Mozilla Public License 2.0](LICENSE).
