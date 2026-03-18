#!/usr/bin/env bash
###############################################################################
#  HiVoid Panel — Pro Global Installer (GitHub Release Mode)
#  Usage: curl -fsSL https://raw.githubusercontent.com/hivoid-org/hivoid-panel/main/install.sh | sudo bash
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
REPO="hivoid-org/hivoid-panel"

# ─── Helpers ─────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── GitHub Downloader ───────────────────────────────────────────────────────
download_release() {
    info "Fetching latest HiVoid Panel release from GitHub..."
    
    # Check for jq (critical for parsing)
    if ! command -v jq &>/dev/null; then
        apt-get install -y -qq jq || error "Could not install 'jq'. It is required to parse GitHub API."
    fi

    # Find Latest ZIP Asset
    RELEASE_DATA=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
    ZIP_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name | endswith(".zip")) | .browser_download_url' | head -n 1)
    TAG=$(echo "$RELEASE_DATA" | jq -r '.tag_name')

    if [[ -z "$ZIP_URL" || "$ZIP_URL" == "null" ]]; then
        error "No .zip asset found in the latest GitHub release. Ensure you have published a zip in ${REPO}."
    fi

    info "Downloading HiVoid Panel ${TAG}..."
    TEMP_DIR=$(mktemp -d)
    DOWNLOAD_PATH="${TEMP_DIR}/release.zip"
    
    curl -fsSL -o "$DOWNLOAD_PATH" "$ZIP_URL"
    
    info "Extracting assets..."
    if ! command -v unzip &>/dev/null; then
        apt-get install -y -qq unzip
    fi
    
    unzip -qo "$DOWNLOAD_PATH" -d "$TEMP_DIR"
    
    # Set the working source directory (the extracted content)
    # The ZIP structure from package.sh puts files in the root or in backend/frontend subdirs
    SRC_DIR="$TEMP_DIR"
    [[ -d "${TEMP_DIR}/hivoid-panel" ]] && SRC_DIR="${TEMP_DIR}/hivoid-panel"
    
    export SRC_DIR
    success "Release ${TAG} downloaded and extracted."
}

# ─── User Input ──────────────────────────────────────────────────────────────
get_user_input() {
    echo ""
    echo -e "${BOLD}HiVoid Configuration${NC}"
    echo "─────────────────────────────────────────────"
    
    # Server Address
    while true; do
        read -rp "$(echo -e "${CYAN}▸${NC} Server Address [IP/Domain]: ")" SERVER_ADDRESS < /dev/tty
        [[ -n "$SERVER_ADDRESS" ]] && break || warn "Address is required."
    done

    # Panel Port
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

# ─── Setup Logic ──────────────────────────────────────────────────────────────
setup_directories() {
    mkdir -p "$PANEL_DIR" "$DATA_DIR" "$CERT_DIR" "$BACKEND_DIR" "$FRONTEND_DIR"
}

copy_source_files() {
    info "Deploying files from extraction..."
    cp -rv "${SRC_DIR}/backend/"* "$BACKEND_DIR/"
    mkdir -p "${FRONTEND_DIR}/dist"
    cp -rv "${SRC_DIR}/frontend/dist/"* "${FRONTEND_DIR}/dist/"
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
    info "Setting up Python environment..."
    python3 -m venv "$VENV_DIR"
    "${VENV_DIR}/bin/pip" install --upgrade pip -q
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" -q
}

setup_systemd() {
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
    info "Installing 'hivoid' command..."
    cat > /usr/local/bin/hivoid <<EOF
#!/bin/bash
cd ${BACKEND_DIR}
./venv/bin/python3 -m manager.cli "\$@"
EOF
    chmod +x /usr/local/bin/hivoid
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    [[ $EUID -ne 0 ]] && error "Run as root."
    
    # 1. Download
    download_release
    
    # 2. Config
    get_user_input
    
    # 3. Base Setup
    setup_directories
    copy_source_files
    
    # 4. Certificates (Self-signed)
    openssl req -x509 -newkey rsa:2048 -keyout "${CERT_DIR}/key.pem" -out "${CERT_DIR}/cert.pem" -days 3650 -nodes -subj "/CN=${SERVER_ADDRESS}" 2>/dev/null
    
    # 5. Core Deployment
    setup_environment
    setup_backend
    setup_systemd
    setup_cli
    
    # 6. Cleanup
    rm -rf "$TEMP_DIR"

    success "Installation complete!"
    echo -e "\nAccess here: https://${SERVER_ADDRESS}:${PANEL_PORT}"
    echo -e "Use 'hivoid' command in terminal for management.\n"
}

main "$@"
