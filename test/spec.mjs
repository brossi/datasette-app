import { test, expect } from '@playwright/test';
import { _electron } from 'playwright';
import { execFileSync } from 'child_process';
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

test('Opening a SQLite database file renders its table', async () => {
  test.setTimeout(0);

  // Build a tiny fixture database with the bundled interpreter, so this test
  // exercises the real open-database path (Electron -> datasette-app-support ->
  // datasette -> rendered page) end to end. The venv built by the test above is
  // reused, so this launch is fast.
  const py = path.join(process.cwd(), 'python', 'bin', 'python3');
  const dbPath = path.join(os.tmpdir(), `datasette-app-test-${Date.now()}.db`);
  execFileSync(py, [
    '-c',
    'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]);' +
      "c.execute('create table creatures (id integer primary key, name text)');" +
      "c.execute(\"insert into creatures (name) values ('Cleo'),('Pancakes')\");" +
      'c.commit(); c.close()',
    dbPath,
  ]);

  const app = await _electron.launch({ args: ['main.js'] });
  try {
    const window = await app.firstWindow();
    await window.waitForSelector('#run-sql-link', { timeout: 90000 });

    // Emulate the macOS "Open With… Datasette" event for the fixture database.
    await app.evaluate(({ app: electronApp }, p) => {
      electronApp.emit('open-file', { preventDefault() {} }, p);
    }, dbPath);

    // The window should navigate to the opened database's overview page and
    // list its table. Assert on the visible table link (the name also appears in
    // the hidden SQL editor, so target the link role specifically).
    await expect(window.getByRole('link', { name: 'creatures' })).toBeVisible({
      timeout: 30000,
    });
  } finally {
    await app.close();
    fs.rmSync(dbPath, { force: true });
  }
});
