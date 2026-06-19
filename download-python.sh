#!/bin/bash
set -euo pipefail

# Datasette.app ships a native Apple-Silicon (arm64) interpreter. Universal and
# Intel builds are deliberately out of scope, so refuse to run on anything else
# rather than silently producing a dist/mac tree the (arm64) build config and CI
# paths don't expect.
arch=`uname -m`
if [ "$arch" != "arm64" ]; then
    echo "error: Datasette.app builds are Apple-Silicon (arm64) only; detected '${arch}'." >&2
    echo "       Build on an arm64 Mac; Intel/Universal builds are not supported." >&2
    exit 1
fi
# astral assets use 'aarch64' for arm64 macOS.
asset_arch="aarch64"

# Standalone Python build from https://github.com/astral-sh/python-build-standalone
# (formerly indygreg/python-build-standalone). Pinned to a specific release so
# builds are reproducible.
release_date="20260610"
cpython_version="3.13.14"

# uv (https://github.com/astral-sh/uv) manages the app's virtualenv and package
# installs. It is bundled alongside the interpreter so it ships inside the app.
uv_version="0.11.23"

# SHA256 of the exact (immutable) release assets downloaded below. These guard
# against a corrupted or tampered download — the build fails hard on a mismatch
# rather than bundling an unverified interpreter into a notarized app. Recompute
# and update these whenever the versions above change (see README "Updating the
# bundled Python / uv").
cpython_sha256="0e255968ed96255df59b6bc9504545260c11de3171e48f7640668d88154945ba"
uv_sha256="71ef9de85db820749b3b12b7585624ee279e9c5afcbc6f8236bc3d628c4305b0"

verify_sha256() {
    # $1 = file, $2 = expected hash
    local actual
    actual=`shasum -a 256 "$1" | awk '{print $1}'`
    if [ "$actual" != "$2" ]; then
        echo "error: checksum mismatch for $1" >&2
        echo "       expected: $2" >&2
        echo "       actual:   $actual" >&2
        rm -f "$1"
        exit 1
    fi
}

filename="cpython-${cpython_version}+${release_date}-${asset_arch}-apple-darwin-install_only.tar.gz"
url="https://github.com/astral-sh/python-build-standalone/releases/download/${release_date}/${filename}"

if [ ! -d "python/" ]; then
    curl -L -O "$url"
    verify_sha256 "${filename}" "${cpython_sha256}"
    tar -xzf "${filename}"
    rm -rf "${filename}"
    # Delete the bundled stdlib test suite, saving ~23MB of disk space.
    # Globbed so it stays correct across Python minor versions.
    rm -rf python/lib/python3.*/test
fi

# Bundle the uv binary next to the interpreter (python/ is copied into the app's
# Resources, so this ships with no extra packaging config).
if [ ! -f "python/bin/uv" ]; then
    uv_dir="uv-${asset_arch}-apple-darwin"
    uv_filename="${uv_dir}.tar.gz"
    uv_url="https://github.com/astral-sh/uv/releases/download/${uv_version}/${uv_filename}"
    curl -L -O "$uv_url"
    verify_sha256 "${uv_filename}" "${uv_sha256}"
    tar -xzf "${uv_filename}"
    mv "${uv_dir}/uv" python/bin/uv
    rm -rf "${uv_filename}" "${uv_dir}"
fi
