#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

APP_DIR="${HOME}/.local/share/mdviewer"
BIN_DIR="${HOME}/.local/bin"
BIN_PATH="${BIN_DIR}/mdviewer"
DESKTOP_DIR="${HOME}/.local/share/applications"
MIME_DIR="${HOME}/.local/share/mime/packages"

mkdir -p "${APP_DIR}" "${BIN_DIR}" "${DESKTOP_DIR}" "${MIME_DIR}"

rm -rf "${APP_DIR}"/*
cp -R "${REPO_ROOT}"/* "${APP_DIR}"/

cd "${APP_DIR}"
npm install --no-audit --no-fund

cat > "${BIN_PATH}" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail
cd "${APP_DIR}"
exec "${APP_DIR}/node_modules/.bin/electron" "${APP_DIR}" "\$@"
WRAPPER
chmod +x "${BIN_PATH}"

DESKTOP_FILE="${DESKTOP_DIR}/mdviewer.desktop"
MIME_FILE="${MIME_DIR}/mdviewer-mime.xml"

sed "s|__MDVIEWER_CMD__|${BIN_PATH}|g" "${SCRIPT_DIR}/mdviewer.desktop" > "${DESKTOP_FILE}"
cp "${SCRIPT_DIR}/mdviewer-mime.xml" "${MIME_FILE}"

update-mime-database "${HOME}/.local/share/mime"
update-desktop-database "${DESKTOP_DIR}" || true

xdg-mime default mdviewer.desktop text/markdown
xdg-mime default mdviewer.desktop text/x-markdown

echo "Installed mdviewer"
echo "Launcher: ${BIN_PATH}"
echo "Desktop file: ${DESKTOP_FILE}"
