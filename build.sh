#!/usr/bin/env bash
# ==============================================================================
# build_and_package.sh
# Production-ready build & packaging script
# Builds frontend, prepares backend, and packages both into a deployment zip.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
BACKEND_DIR="${PROJECT_ROOT}/backend"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [[ -f "${FRONTEND_DIR}/package.json" ]]; then
  PROJECT_VERSION=$(grep '"version":' "${FRONTEND_DIR}/package.json" | head -1 | cut -d'"' -f4)
else
  PROJECT_VERSION="unknown"
fi

DIST_DIR="${PROJECT_ROOT}/dist"
mkdir -p "${DIST_DIR}"

ZIP_NAME="hivoid-deploy-v${PROJECT_VERSION}.zip"
ZIP_OUTPUT_PATH="${DIST_DIR}/${ZIP_NAME}"
DEPLOY_STAGING_DIR="$(mktemp -d /tmp/hivoid-deploy-XXXXXX)"

# ------------------------------------------------------------------------------
# LOGGING
# ------------------------------------------------------------------------------
log_info()    { echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') — $*"; }
log_success() { echo "[OK]    $(date '+%Y-%m-%d %H:%M:%S') — $*"; }
log_warn()    { echo "[WARN]  $(date '+%Y-%m-%d %H:%M:%S') — $*" >&2; }
log_error()   { echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') — $*" >&2; }

# ------------------------------------------------------------------------------
# CLEANUP TRAP — remove staging dir on exit (success or failure)
# ------------------------------------------------------------------------------
cleanup() {
  local exit_code=$?
  if [[ -d "${DEPLOY_STAGING_DIR}" ]]; then
    log_info "Cleaning up staging directory: ${DEPLOY_STAGING_DIR}"
    rm -rf "${DEPLOY_STAGING_DIR}"
  fi
  if [[ ${exit_code} -ne 0 ]]; then
    log_error "Script exited with errors (exit code: ${exit_code})."
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

# ==============================================================================
# STEP 1 — Verify required tools
# ==============================================================================
log_info "STEP 1: Checking required dependencies..."

if ! command -v node &>/dev/null; then
  log_error "Node.js is not installed or not in PATH. Please install Node.js (>= 16) and retry."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  log_error "npm is not installed or not in PATH. Please install npm and retry."
  exit 1
fi

if ! command -v zip &>/dev/null; then
  log_error "'zip' utility is not installed. Install it with: sudo apt-get install -y zip"
  exit 1
fi

NODE_VERSION="$(node --version)"
NPM_VERSION="$(npm --version)"
log_success "Node.js ${NODE_VERSION} and npm ${NPM_VERSION} detected."

# ==============================================================================
# STEP 2 — Install dependencies and build frontend
# ==============================================================================
log_info "STEP 2: Building frontend..."

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  log_error "Frontend directory not found: ${FRONTEND_DIR}"
  exit 1
fi

cd "${FRONTEND_DIR}"
log_info "Running: npm install (in ${FRONTEND_DIR})"
npm install --prefer-offline --no-audit --no-fund

log_info "Running: npm run build"
npm run build

log_success "Frontend build completed."

# ==============================================================================
# STEP 3 — Verify build output exists
# ==============================================================================
log_info "STEP 3: Verifying frontend build output..."

FRONTEND_BUILD_DIR=""
for candidate in "dist" "build" "out" ".next" "public/build"; do
  if [[ -d "${FRONTEND_DIR}/${candidate}" ]]; then
    FRONTEND_BUILD_DIR="${FRONTEND_DIR}/${candidate}"
    log_success "Build output found: ${FRONTEND_BUILD_DIR}"
    break
  fi
done

if [[ -z "${FRONTEND_BUILD_DIR}" ]]; then
  log_error "No build output directory found inside ${FRONTEND_DIR}."
  log_error "Expected one of: dist/, build/, out/, .next/, public/build/"
  exit 1
fi

# ==============================================================================
# STEP 4 — Prepare deployment staging folder
# ==============================================================================
log_info "STEP 4: Preparing deployment staging directory: ${DEPLOY_STAGING_DIR}"

STAGING_BACKEND="${DEPLOY_STAGING_DIR}/backend"
STAGING_FRONTEND="${DEPLOY_STAGING_DIR}/frontend"

# Copy backend
if [[ ! -d "${BACKEND_DIR}" ]]; then
  log_error "Backend directory not found: ${BACKEND_DIR}"
  exit 1
fi

log_info "Copying backend to staging..."
cp -r "${BACKEND_DIR}" "${STAGING_BACKEND}"
log_success "Backend copied."

# Copy only the frontend build output
log_info "Copying frontend build output to staging..."
mkdir -p "${STAGING_FRONTEND}"
cp -r "${FRONTEND_BUILD_DIR}/." "${STAGING_FRONTEND}/"
log_success "Frontend build output copied."

# ==============================================================================
# STEP 5 — Remove unnecessary files from staging
# ==============================================================================
log_info "STEP 5: Removing unnecessary files from staging..."

# node_modules
find "${DEPLOY_STAGING_DIR}" -type d -name "node_modules" -prune -exec rm -rf {} + 2>/dev/null || true
log_info "Removed: node_modules directories."

# .git directories
find "${DEPLOY_STAGING_DIR}" -type d -name ".git" -prune -exec rm -rf {} + 2>/dev/null || true
log_info "Removed: .git directories."

# Cache and temp files
find "${DEPLOY_STAGING_DIR}" -type d \( \
  -name ".cache"     -o \
  -name ".parcel-cache" -o \
  -name ".turbo"     -o \
  -name ".eslintcache" \
\) -prune -exec rm -rf {} + 2>/dev/null || true

find "${DEPLOY_STAGING_DIR}" -type f \( \
  -name "*.log"      -o \
  -name "*.tmp"      -o \
  -name ".DS_Store"  -o \
  -name "Thumbs.db"  -o \
  -name ".npmrc"     -o \
  -name ".env.local" -o \
  -name ".env.development" \
\) -delete 2>/dev/null || true

log_success "Cleanup complete."

# ==============================================================================
# STEP 6 — Create deployment zip
# ==============================================================================
log_info "STEP 6: Creating deployment archive: ${ZIP_NAME}"

cd "${DEPLOY_STAGING_DIR}"
zip -r "${ZIP_OUTPUT_PATH}" backend/ frontend/ \
  --exclude "*.DS_Store" \
  --exclude "*__pycache__*" \
  --exclude "*.pyc"

log_success "Archive created: ${ZIP_OUTPUT_PATH}"

# ==============================================================================
# STEP 7 — Summary
# ==============================================================================
ZIP_SIZE="$(du -sh "${ZIP_OUTPUT_PATH}" | cut -f1)"

echo ""
echo "============================================================"
echo "  DEPLOYMENT PACKAGE READY"
echo "============================================================"
echo "  Archive : ${ZIP_OUTPUT_PATH}"
echo "  Size    : ${ZIP_SIZE}"
echo "  Contents:"
echo "    backend/   — application server code"
echo "    frontend/  — compiled frontend build output"
echo "  Timestamp : ${TIMESTAMP}"
echo "============================================================"
echo ""

log_success "Build and packaging completed successfully."