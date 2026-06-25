#!/bin/sh
# UsageRush one-line installer for macOS / Linux (no clone, no npm; needs Node >= 18).
#
#   curl -fsSL https://raw.githubusercontent.com/Fantasymax/UsageRush/master/install.sh | sh
#
# Env overrides: USAGERUSH_HOME (install dir), USAGERUSH_BIN (launcher dir), USAGERUSH_BRANCH.
set -e

REPO="Fantasymax/UsageRush"
BRANCH="${USAGERUSH_BRANCH:-master}"
DEST="${USAGERUSH_HOME:-$HOME/.usagerush-app}"
BIN_DIR="${USAGERUSH_BIN:-$HOME/.local/bin}"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ UsageRush needs Node.js >= 18, plus the claude/codex CLI you want to keep alive." >&2
  exit 1
fi

echo "→ Downloading UsageRush ($BRANCH)…"
mkdir -p "$DEST" "$BIN_DIR"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar -xz --strip-components=1 -C "$DEST"

cat > "$BIN_DIR/usagerush" <<EOF
#!/bin/sh
exec node "$DEST/src/cli.js" "\$@"
EOF
chmod +x "$BIN_DIR/usagerush"

echo "✓ Installed to $DEST"
case ":$PATH:" in
  *":$BIN_DIR:"*) echo "  Run:  usagerush setup" ;;
  *)
    echo "  Add to PATH:  export PATH=\"$BIN_DIR:\$PATH\"   (append to ~/.profile or ~/.zshrc)"
    echo "  Then run:     usagerush setup"
    ;;
esac
