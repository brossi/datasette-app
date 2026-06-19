#!/bin/bash
set -euo pipefail

# Standalone Python build from https://github.com/astral-sh/python-build-standalone
# (formerly indygreg/python-build-standalone). Pinned to a specific release so
# builds are reproducible.
release_date="20260610"
cpython_version="3.13.14"

# uv (https://github.com/astral-sh/uv) manages the app's virtualenv and package
# installs. It is bundled alongside the interpreter so it ships inside the app.
uv_version="0.11.22"

# Match the host architecture so the bundled interpreter runs natively
# (arm64 Macs would otherwise run an x86_64 Python under Rosetta).
arch=`uname -m`
if [ "$arch" = "arm64" ]; then
    arch="aarch64"
fi

filename="cpython-${cpython_version}+${release_date}-${arch}-apple-darwin-install_only.tar.gz"
url="https://github.com/astral-sh/python-build-standalone/releases/download/${release_date}/${filename}"

standalone_python="python/"

if [ ! -d "$standalone_python" ]; then
    curl -L -O "$url"
    tar -xzf "${filename}"
    rm -rf "${filename}"
    # Delete the bundled stdlib test suite, saving ~23MB of disk space.
    # Globbed so it stays correct across Python minor versions.
    rm -rf python/lib/python3.*/test
fi

# Bundle the uv binary next to the interpreter (python/ is copied into the app's
# Resources, so this ships with no extra packaging config).
if [ ! -f "python/bin/uv" ]; then
    uv_dir="uv-${arch}-apple-darwin"
    uv_filename="${uv_dir}.tar.gz"
    uv_url="https://github.com/astral-sh/uv/releases/download/${uv_version}/${uv_filename}"
    curl -L -O "$uv_url"
    tar -xzf "${uv_filename}"
    mv "${uv_dir}/uv" python/bin/uv
    rm -rf "${uv_filename}" "${uv_dir}"
fi
