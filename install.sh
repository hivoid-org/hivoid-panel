#!/usr/bin/env bash
###############################################################################
#  HiVoid Panel — Pro Global Installer (Fixed Deployment Version)
###############################################################################

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Globals ─────────────────────────────────────────────────────────────────
PANEL_DIR="/opt/hivoid-panel"
BACKEND_DIR="${PANEL_DIR}/backend"
FRONTEND_DIR="${PANEL_DIR}/frontend"
DATA_DIR="${PANEL_DIR}/data"
CERT_DIR="${PANEL_DIR}/certs"
VENV_DIR="${BACKEND_DIR}/venv"
ENV_FILE="${BACKEND_DIR}/.env"
SERVICE_BACKEND="hivoid-panel-backend"
PANEL_REPO="hivoid-org/hivoid-panel"
CORE_REPO="hivoid-org/hivoid-core"

# ─── Helpers ─────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── Dependency Manager ──────────────────────────────────────────────────────
install_deps() {
    info "Checking system dependencies..."
    DEPS=(curl jq unzip openssl python3 python3-venv python3-pip)
    MISSING_DEPS=()
    for dep in "${DEPS[@]}"; do
        if ! command -v "$dep" &>/dev/null && ! dpkg -s "$dep" &>/dev/null; then
            MISSING_DEPS+=("$dep")
        fi
    done
    if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
        info "Installing missing dependencies: ${MISSING_DEPS[*]}..."
        apt-get update -qq
        apt-get install -y -qq "${MISSING_DEPS[@]}" || error "Failed to install dependencies."
        success "Dependencies installed."
    fi
}

# ─── GitHub Downloader (Panel) ───────────────────────────────────────────────
download_panel() {
    info "Fetching latest HiVoid Panel release..."
    RELEASE_DATA=$(curl -fsSL "https://api.github.com/repos/${PANEL_REPO}/releases/latest")
    ZIP_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name | endswith(".zip")) | .browser_download_url' | head -n 1)
    TAG=$(echo "$RELEASE_DATA" | jq -r '.tag_name')

    info "Downloading HiVoid Panel ${TAG}..."
    TEMP_DIR=$(mktemp -d)
    curl -fsSL -o "${TEMP_DIR}/panel.zip" "$ZIP_URL"
    unzip -qo "${TEMP_DIR}/panel.zip" -d "$TEMP_DIR"
    
    SRC_DIR="$TEMP_DIR"
    [[ -d "${TEMP_DIR}/hivoid-panel" ]] && SRC_DIR="${TEMP_DIR}/hivoid-panel"
    export SRC_DIR
    success "Panel assets extracted."
}

# ─── GitHub Downloader (Core) ────────────────────────────────────────────────
download_core() {
    info "Fetching latest HiVoid Core binary..."
    
    # Detect Architecture
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        *) error "Unsupported architecture: $ARCH" ;;
    esac

    # Find Latest Linux Asset
    RELEASE_DATA=$(curl -fsSL "https://api.github.com/repos/${CORE_REPO}/releases/latest")
    # Asset name pattern: hivoid-core-linux-amd64-vX.X.X.zip
    CORE_ZIP_URL=$(echo "$RELEASE_DATA" | jq -r ".assets[] | select(.name | contains(\"linux-$ARCH\")) | .browser_download_url" | head -n 1)
    
    if [[ -z "$CORE_ZIP_URL" || "$CORE_ZIP_URL" == "null" ]]; then
        error "No core binary found for linux-$ARCH in ${CORE_REPO}."
    fi

    info "Downloading Core binary (linux-$ARCH)..."
    CORE_TEMP=$(mktemp -d)
    curl -fsSL -o "${CORE_TEMP}/core.zip" "$CORE_ZIP_URL"
    unzip -qo "${CORE_TEMP}/core.zip" -d "$CORE_TEMP"
    
    # Move binary to /usr/local/bin (assume name 'hivoid-server' or similar in zip)
    BINARY_FILE=$(find "$CORE_TEMP" -type f -name "hivoid-server*" | head -n 1)
    [[ -z "$BINARY_FILE" ]] && BINARY_FILE=$(find "$CORE_TEMP" -type f -executable | head -n 1)
    
    mv -v "$BINARY_FILE" "/usr/local/bin/hivoid-server"
    chmod +x "/usr/local/bin/hivoid-server"
    
    rm -rf "$CORE_TEMP"
    success "Core binary installed to /usr/local/bin/hivoid-server"
}

# ─── User Input ──────────────────────────────────────────────────────────────
get_user_input() {
    echo ""
    echo -e "${BOLD}HiVoid Configuration${NC}"
    echo "─────────────────────────────────────────────"
    while true; do
        read -rp "$(echo -e "${CYAN}▸${NC} Server Address [IP/Domain]: ")" SERVER_ADDRESS < /dev/tty
        [[ -n "$SERVER_ADDRESS" ]] && break || warn "Input is required."
    done
    while true; do
        read -rp "$(echo -e "${CYAN}▸${NC} Panel Port [default: 8443]: ")" PANEL_PORT < /dev/tty
        PANEL_PORT=${PANEL_PORT:-8443}
        if [[ "$PANEL_PORT" =~ ^[0-9]+$ ]] && (( PANEL_PORT >= 1 && PANEL_PORT <= 65535 )); then
            break
        else
            warn "Invalid port."
        fi
    done
}

# ─── Deployment Logic ─────────────────────────────────────────────────────────
deploy_files() {
    info "Preparing directories..."
    mkdir -p "$PANEL_DIR" "$DATA_DIR" "$CERT_DIR" "$BACKEND_DIR" "$FRONTEND_DIR/dist"
    cp -rv "${SRC_DIR}/backend/"* "$BACKEND_DIR/"
    cp -rv "${SRC_DIR}/frontend/"* "${FRONTEND_DIR}/dist/"
}

setup_environment() {
    SECRET_KEY=$(openssl rand -hex 32)
    cat > "$ENV_FILE" <<EOF
SECRET_KEY=${SECRET_KEY}
DATABASE_URL=sqlite:///${DATA_DIR}/hivoid_panel.db
SERVER_ADDRESS=${SERVER_ADDRESS}
PANEL_PORT=${PANEL_PORT}
CERT_FILE=${CERT_DIR}/cert.pem
KEY_FILE=${CERT_DIR}/key.pem
HIVOID_BINARY_PATH=/usr/local/bin/hivoid-server
HIVOID_CONFIG_PATH=${DATA_DIR}/server.json
HIVOID_PID_PATH=/tmp/hivoid-server.pid
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
EOF
    chmod 600 "$ENV_FILE"
}

setup_backend() {
    info "Configuring Python VENV and database..."
    python3 -m venv "$VENV_DIR"
    "${VENV_DIR}/bin/pip" install --upgrade pip -q
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
    export DATABASE_URL="sqlite:///${DATA_DIR}/hivoid_panel.db"
    "${VENV_DIR}/bin/python3" "${BACKEND_DIR}/migrate.py" || warn "Migration failed."
}

setup_systemd() {
    info "Configuring Systemd service..."
    cat > "/etc/systemd/system/${SERVICE_BACKEND}.service" <<EOF
[Unit]
Description=HiVoid Panel Backend
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PANEL_PORT} --ssl-keyfile ${CERT_DIR}/key.pem --ssl-certfile ${CERT_DIR}/cert.pem
Restart=always
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now "$SERVICE_BACKEND"
}

setup_cli() {
    info "Installing 'hivoid' management CLI..."
    cat > /usr/local/bin/hivoid <<EOF
#!/bin/bash
export DATABASE_URL="sqlite:///${DATA_DIR}/hivoid_panel.db"
cd ${BACKEND_DIR}
./venv/bin/python3 -m manager.cli "\$@"
EOF
    chmod +x /usr/local/bin/hivoid
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    [[ $EUID -ne 0 ]] && error "Must run as root."
    
    install_deps
    download_core     # NEW: Install core binary first
    download_panel
    get_user_input
    deploy_files
    
    openssl req -x509 -newkey rsa:2048 -keyout "${CERT_DIR}/key.pem" -out "${CERT_DIR}/cert.pem" -days 3650 -nodes -subj "/CN=${SERVER_ADDRESS}" 2>/dev/null
    
    setup_environment
    setup_backend
    setup_systemd
    setup_cli
    
    rm -rf "$TEMP_DIR"
    echo -e "\n"
    success "HiVoid Ecosystem successfully deployed!"
    echo "─────────────────────────────────────────────"
    echo -e "${BOLD}Panel URL:${NC}  https://${SERVER_ADDRESS}:${PANEL_PORT}"
    echo -e "${BOLD}Default User:${NC} admin / admin"
    echo "─────────────────────────────────────────────"
    echo -e "Binary installed at: /usr/local/bin/hivoid-server"
    echo -e "Use the '${CYAN}hivoid${NC}' command for management.\n"
}

main "$@"
