const { defineConfig } = require("@playwright/test");

// Minimal config so `playwright test` reliably discovers test/spec.mjs across
// Playwright versions (modern defaults only match *.spec.* / *.test.*), and so
// the Electron app is driven by a single worker.
module.exports = defineConfig({
  testDir: "test",
  testMatch: "**/*.mjs",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
});
