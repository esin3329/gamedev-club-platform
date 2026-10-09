#!/bin/bash
# Secret scanning script using gitleaks
# 
# Usage:
#   ./scripts/scan-secrets.sh          # Scan staged changes
#   ./scripts/scan-secrets.sh --all    # Scan entire git history
#
# Exit codes:
#   0 = No secrets found
#   1 = Secrets found or error

set -e

GITLEAKS_VERSION="8.18.4"
GITLEAKS_BIN="${GITLEAKS_BIN:-gitleaks}"

# Check if gitleaks is available
if ! command -v "$GITLEAKS_BIN" &> /dev/null; then
  echo "gitleaks not found. Installing..."
  
  # Detect OS and architecture
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
  esac
  
  # Download to temp directory
  TEMP_DIR=$(mktemp -d)
  curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${OS}_${ARCH}.tar.gz" | tar xz -C "$TEMP_DIR"
  GITLEAKS_BIN="$TEMP_DIR/gitleaks"
fi

echo "=== Secret Scanning with gitleaks ==="
echo ""

if [ "$1" == "--all" ]; then
  echo "Scanning entire git history..."
  "$GITLEAKS_BIN" detect --source . --log-opts="--all --full-history" -v
else
  echo "Scanning staged changes..."
  "$GITLEAKS_BIN" protect --source . --staged -v
fi

RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo ""
  echo "✅ No secrets found"
else
  echo ""
  echo "❌ Secrets detected! Please remove them before committing."
  echo "   See https://github.com/gitleaks/gitleaks for more info."
fi

exit $RESULT
