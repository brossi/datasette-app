#!/bin/bash
set -euo pipefail

# Rebuild the bundled datasette-app-support wheel from the sibling source repo
# and drop it into wheels/. The app installs this wheel at first launch (see
# findBundledPluginWheel in main.js), so the #153 fix ships without depending on
# a PyPI release. Run this whenever the plugin source changes.
#
# Override the plugin location with PLUGIN_REPO=/path/to/datasette-app-support.

here="$(cd "$(dirname "$0")/.." && pwd)"
plugin_repo="${PLUGIN_REPO:-${here}/../datasette-app-support}"

if [ ! -f "${plugin_repo}/pyproject.toml" ]; then
    echo "error: datasette-app-support source not found at ${plugin_repo}" >&2
    echo "       set PLUGIN_REPO to its path and retry." >&2
    exit 1
fi

echo "Building wheel from ${plugin_repo}"
rm -rf "${plugin_repo}/dist"
python3 -m build --wheel "${plugin_repo}"

wheel="$(ls "${plugin_repo}"/dist/datasette_app_support-*.whl | head -1)"
if [ -z "${wheel}" ]; then
    echo "error: no wheel was produced" >&2
    exit 1
fi

# Replace any previously-bundled wheel so only one version ships.
rm -f "${here}"/wheels/datasette_app_support-*.whl
mkdir -p "${here}/wheels"
cp "${wheel}" "${here}/wheels/"
echo "Bundled $(basename "${wheel}") into wheels/"
