# Datasette Desktop

A macOS desktop application that wraps [Datasette](https://datasette.io/). See [Building a desktop application for Datasette](https://simonwillison.net/2021/Aug/30/datasette-app/) for background on this project.

## Requirements

This build targets **Apple Silicon (arm64) Macs only** — it bundles a native arm64 Python interpreter. Intel and Universal builds are out of scope; `download-python.sh` refuses to run on a non-arm64 host rather than produce a broken build.

## Installation

Grab the latest release from [the releases page](https://github.com/simonw/datasette-app/releases). Download `Datasette.app.zip`, uncompress it and drag `Datasette.app` to your `/Applications` folder - then double-click the icon.

The first time you launch the app it will install the latest version of Datasette, which could take a little while. Subsequent application launches will be a lot quicker.

## Application features

- Includes a full copy of Python which stays separate from any other Python versions you may have installed
- Installs the latest Datasette release the first time it runs
- The application can open existing SQLite database files or read CSV files into an in-memory database
- It can also create a new, empty SQLite database file and create tables in that database by importing CSV data
- By default the server only accepts connections from your computer, but you can use "File -> Access Control -> Anyone on my networks" to make it visible to other computers on your network (or devices on your [Tailscale](https://tailscale.com/) network).
- Datasette plugins can be installed using the "Install Plugin" menu item

## How it works

The app consists of two parts: the Electron app, and a custom Datasette plugin called [datasette-app-support](https://github.com/simonw/datasette-app-support).

You can install a development version of the app like so:

    # Clone the repo
    git clone https://github.com/simonw/datasette-app
    cd datasette-app
    
    # Download standalone Python
    ./download-python.sh
    
    # Install Electron dependencies and start it running:
    npm install
    npm start

When the app first starts up it uses the bundled [uv](https://github.com/astral-sh/uv) to create a Python virtual environment in `~/.datasette-app/venv` (around the bundled interpreter) and installs Datasette plus the supporting plugins into it. The `datasette-app-support` plugin is installed from a wheel bundled inside the app (`wheels/`) rather than from PyPI, so the app ships a known-good version of it.

To run the Electron tests:

    npm test

The Electron tests may leave a `datasette` process running. You can find the process ID for this using:

    ps aux | grep xyz

Then use `kill PROCESS_ID` to terminate it.

To build an unsigned `.app` you can launch locally (no Apple Developer certificate required):

    npm run pack:local

This produces `dist/mac-arm64/Datasette.app`, ad-hoc code-signed so macOS will run it.

![datasette-app](https://user-images.githubusercontent.com/9599/131289203-18186b26-49a4-46e9-8925-b9e4745f3252.png)

## How to develop plugins

You can develop new Datasette plugins directly against your installation of Datasette Desktop. The [Writing Plugins](https://docs.datasette.io/en/stable/writing_plugins.html) documentation mostly applies as-is, but the one extra thing you will need to do is to install an editable version of your plugin directly into the virtual environment used by Datasette Desktop.

To do this, first create a new plugin in a folder called `datasette-your-new-plugin` with a `setup.py`, as described in the plugin documentation. The easiest way to do that is using the [datasette-plugin cookiecutter template](https://github.com/simonw/datasette-plugin).

Then `cd` into that directory and install it into Datasette Desktop's virtual
environment. The environment is managed by `uv` and does not contain `pip`, so
use the bundled `uv` to install an editable copy:

    ./python/bin/uv pip install --python ~/.datasette-app/venv/bin/python3 -e .

(Or use any `uv` on your `PATH`.) This will install the plugin into your Datasette Desktop environment, such that any edits you make to the files in that directory will be picked up the next time the embedded Datasette server is restarted.

You can restart the server either by quitting and restarting the Datasette Desktop application, or by enabling the Debug menu ("Datasette -> About Datasette -> Enable Debug Menu") and then using "Debug -> Restart Server".

## Updating the bundled Python / uv

The bundled interpreter and uv binary are pinned in `download-python.sh`
(`cpython_version` / `release_date` / `uv_version`) along with the SHA256 of each
release asset (`cpython_sha256` / `uv_sha256`). These pins are intentionally
invisible to Dependabot, so bump them by hand: update the version, then update
the matching checksum (e.g. `shasum -a 256 <downloaded asset>`). The build fails
hard if a download's hash doesn't match the pin.

## Updating the bundled datasette-app-support plugin

The patched `datasette-app-support` plugin ships as a wheel in `wheels/`, so the
app does not depend on a PyPI release of it. After changing the plugin source,
rebuild and re-bundle the wheel:

    ./scripts/update-plugin-wheel.sh

(Set `PLUGIN_REPO=/path/to/datasette-app-support` if the source isn't a sibling
checkout.) Keep the version in `minPackageVersions` (in `main.js`) in step with
the bundled wheel's version.

## Auto-update

Signed builds check for updates hourly via [update-electron-app](https://github.com/electron/update-electron-app). The update feed is a GitHub `owner/repo`, resolved in this order:

1. The `DATASETTE_APP_UPDATE_REPO` environment variable (`owner/repo` or a GitHub URL) — useful for testing or a build-time pin.
2. The user's choice, set via **File → Update Source…** and persisted to `~/.datasette-app/config.json`. Enter `owner/repo` (or a GitHub URL), or leave it blank to reset to the default. Changes apply after a restart, which the dialog offers to do.
3. The `repository` field in `package.json` (the default).

Set `DATASETTE_APP_DISABLE_UPDATES=1` to turn auto-update off entirely. The feed only ever changes from an explicit user action (the menu) or build/env config — never silently from page content — so untrusted content cannot redirect the signed updater. (Auto-update only runs in packaged, code-signed builds; it is a no-op in development.)

## Release process

To ship a new release, increment the version number in `package.json` and then [create a new release](https://github.com/simonw/datasette-app/releases/new) with a matching tag.

Then [run a deploy](https://github.com/simonw/datasette.io/actions/workflows/deploy.yml) of [datasette.io](https://datasette.io/) to update the latest release link that is displayed on the [datasette.io/desktop](https://datasette.io/desktop) page.
