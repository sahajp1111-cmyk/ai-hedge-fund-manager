import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:8790", trace: "retain-on-failure" },
  webServer: {
    command: "node server-dist/server/index.js",
    url: "http://127.0.0.1:8790/api/health",
    reuseExistingServer: false,
    env: {
      NODE_ENV: "test",
      PORT: "8790",
      SCANNER_ENABLED: "false",
      DATA_DIR: "./var/e2e",
      ALLOWED_ORIGINS: "http://127.0.0.1:8790",
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
