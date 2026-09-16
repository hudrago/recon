import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const sourceDatabaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) throw new Error('DATABASE_URL or E2E_DATABASE_URL is required for Playwright');
const parsedDatabaseUrl = new URL(sourceDatabaseUrl);
if (!process.env.E2E_DATABASE_URL) parsedDatabaseUrl.searchParams.set('schema', `recon_e2e_${process.pid}_${Date.now()}`);
const e2eDatabaseUrl = parsedDatabaseUrl.toString();
const e2eSchema = parsedDatabaseUrl.searchParams.get('schema');
if (!e2eSchema?.startsWith('recon_e2e')) throw new Error('E2E_DATABASE_URL must use a recon_e2e-prefixed schema');
process.env.E2E_DATABASE_URL = e2eDatabaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' },
    },
  ],
  webServer: [
    {
      command: 'node --import tsx src/main.ts',
      cwd: 'apps/api',
      env: { DATABASE_URL: e2eDatabaseUrl, PORT: '3101', WEB_URL: 'http://127.0.0.1:3100' },
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev --port 3100',
      cwd: 'apps/web',
      env: { API_URL: 'http://127.0.0.1:3101' },
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
    },
  ],
});