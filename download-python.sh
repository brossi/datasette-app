#!/bin/bash
set -euo pipefail

# Standalone Python build from https://github.com/astral-sh/python-build-standalone
# (formerly indygreg/python-build-standalone). Pinned to a specific release so
# builds are reproducible.
release_date="20260610"
cpython_version="3.13.14"

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
