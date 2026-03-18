# HiVoid Panel 🚀

Professional management interface for HiVoid encrypted core.

## 🚀 One-Line Installation

Run the following command on your Ubuntu 22.04/24.04 server:

```bash
curl -fsSL https://raw.githubusercontent.com/hivoid-org/hivoid-panel/main/install.sh | sudo bash
```

---

## 🖥 Web Dashboard
After installation, access the panel via:
`https://YOUR_SERVER_IP:8443`
- **Default Username:** `admin`
- **Default Password:** `admin`

---

## 🛠 Terminal Management (CLI)
Manage your server directly from the command line using the simple `hivoid` command:

| Command | Action |
|---------|--------|
| `hivoid` | Open the interactive TUI menu (Best Experience) |
| `hivoid start` | Start the core service |
| `hivoid stop` | Stop the core service |
| `hivoid status` | Check service health |
| `hivoid update` | Update the core binary from GitHub |
| `hivoid reset-pass [PWD]` | Reset admin password |
| `hivoid change-port [PORT]` | Change the web panel port |

---

## 🔒 Security First
1. Login to the dashboard and navigate to **Settings**.
2. Change the default admin password immediately.
3. You can also change the Web Panel Port via the CLI for extra security.

---

## 📁 System Paths
- **Config:** `/opt/hivoid-panel/data/server.json`
- **Logs:** `journalctl -u hivoid-panel-backend -f`
