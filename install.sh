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
REPO="hivoid-org/hivoid-panel"

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
    else
        success "All dependencies are already present."
    fi
}

# ─── GitHub Downloader ───────────────────────────────────────────────────────
download_release() {
    info "Fetching latest HiVoid Panel release from GitHub..."
    
    # API Request to fetch the latest ZIP asset
    RELEASE_DATA=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
    ZIP_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name | endswith(".zip")) | .browser_download_url' | head -n 1)
    TAG=$(echo "$RELEASE_DATA" | jq -r '.tag_name')

    if [[ -z "$ZIP_URL" || "$ZIP_URL" == "null" ]]; then
        error "No .zip asset found in the latest release at ${REPO}."
    fi

    info "Downloading HiVoid Panel ${TAG}..."
    TEMP_DIR=$(mktemp -d)
    DOWNLOAD_PATH="${TEMP_DIR}/release.zip"
    curl -fsSL -o "$DOWNLOAD_PATH" "$ZIP_URL"
    
    info "Extracting assets..."
    unzip -qo "$DOWNLOAD_PATH" -d "$TEMP_DIR"
    
    # Handle ZIP structures (both flat and nested)
    SRC_DIR="$TEMP_DIR"
    [[ -d "${TEMP_DIR}/hivoid-panel" ]] && SRC_DIR="${TEMP_DIR}/hivoid-panel"
    
    export SRC_DIR
    success "Assets extracted to temporary workspace."
}

# ─── User Input ──────────────────────────────────────────────────────────────
get_user_input() {
    echo ""
    echo -e "${BOLD}HiVoid Configuration${NC}"
    echo "─────────────────────────────────────────────"
    
    # Use /dev/tty to ensure input works when piped from curl
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
    info "Creating directories..."
    mkdir -p "$PANEL_DIR" "$DATA_DIR" "$CERT_DIR" "$BACKEND_DIR" "$FRONTEND_DIR/dist"

    info "Deploying Backend..."
    cp -rv "${SRC_DIR}/backend/"* "$BACKEND_DIR/"

    info "Deploying Frontend assets (Fixed mapping)..."
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
EOF
    chmod 600 "$ENV_FILE"
}

setup_backend() {
    info "Configuring Python VENV..."
    python3 -m venv "$VENV_DIR"
    "${VENV_DIR}/bin/pip" install --upgrade pip -q
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" -q
}

setup_systemd() {
    info "Configuring Systemd..."
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
    info "Installing global 'hivoid' command..."
    cat > /usr/local/bin/hivoid <<EOF
#!/bin/bash
cd ${BACKEND_DIR}
./venv/bin/python3 -m manager.cli "\$@"
EOF
    chmod +x /usr/local/bin/hivoid
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    [[ $EUID -ne 0 ]] && error "Permission denied. Must run as root."
    
    install_deps      # Stage 0: Prep
    download_release  # Stage 1: Fetch
    get_user_input    # Stage 2: Config
    deploy_files      # Stage 3: Extract
    
    # Generate self-signed cert on the fly
    openssl req -x509 -newkey rsa:2048 -keyout "${CERT_DIR}/key.pem" -out "${CERT_DIR}/cert.pem" -days 3650 -nodes -subj "/CN=${SERVER_ADDRESS}" 2>/dev/null
    
    setup_environment # Stage 4: Settings
    setup_backend     # Stage 5: Python
    setup_systemd     # Stage 6: Service
    setup_cli         # Stage 7: CLI
    
    rm -rf "$TEMP_DIR"
    success "Deployment complete. Visit: https://${SERVER_ADDRESS}:${PANEL_PORT}"
}

main "$@"
