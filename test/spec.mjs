import { test, expect } from '@playwright/test';
import { _electron } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const venvDir = path.join(os.homedir(), '.datasette-app', 'venv');

function sitePackages() {
  // ~/.datasette-app/venv/lib/python3.X/site-packages — minor version agnostic.
  const libDir = path.join(venvDir, 'lib');
  if (!fs.existsSync(libDir)) {
    return null;
  }
  const pyDir = fs.readdirSync(libDir).find(n => n.startsWith('python3.'));
  return pyDir ? path.join(libDir, pyDir, 'site-packages') : null;
}

test('App launches, builds the venv via uv, and quits', async () => {
  test.setTimeout(0);

  // Force the first-launch code path: remove any existing venv so the app must
  // rebuild it. This is what makes the assertions below meaningful — a stale
  // venv left over from a previous run would otherwise mask a broken uv path.
  fs.rmSync(venvDir, { recursive: true, force: true });

  const app = await _electron.launch({
    args: ['main.js'],
    recordVideo: {dir: 'test-videos'}
  });
  const window = await app.firstWindow();
  await expect(await window.title()).toContain('Loading');
  await window.waitForSelector('#run-sql-link', {
    timeout: 90000
  });
  await sleep(1000);

  // The preload's contextBridge API must survive sandbox: true — including
  // venvPath, which is resolved via synchronous IPC rather than Node APIs.
  const api = await window.evaluate(() => ({
    importCsv: typeof window.datasetteApp?.importCsv,
    installPlugin: typeof window.datasetteApp?.installPlugin,
    venvPath: window.datasetteApp?.venvPath,
  }));
  expect(api.importCsv).toBe('function');
  expect(api.installPlugin).toBe('function');
  expect(api.venvPath).toContain('.datasette-app/venv');

  // The venv must have been (re)built by the bundled uv, not by python -m venv.
  // uv stamps the interpreter config with a `uv = <version>` line.
  const pyvenvCfg = fs.readFileSync(path.join(venvDir, 'pyvenv.cfg'), 'utf8');
  expect(pyvenvCfg).toMatch(/^uv = /m);

  // The patched datasette-app-support must have been installed from the bundled
  // wheel (so the #153 fix ships with the app rather than relying on PyPI).
  const sp = sitePackages();
  expect(sp).not.toBeNull();
  const installed = fs.readdirSync(sp).some(
    n => /^datasette_app_support-.*\.dist-info$/.test(n)
  );
  expect(installed).toBe(true);

  await app.close();
});
