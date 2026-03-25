import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    port: 8000,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
