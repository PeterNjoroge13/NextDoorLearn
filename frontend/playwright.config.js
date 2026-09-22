import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const backendUrl = 'http://127.0.0.1:3219';
const frontendUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm start',
      cwd: '../backend',
      url: `${backendUrl}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3219',
        NODE_ENV: 'development',
        DATABASE_PATH: '/tmp/nextdoorlearn-browser-smoke.db',
        JWT_SECRET: 'browser-smoke-jwt-secret-with-enough-entropy',
        FIELD_ENCRYPTION_KEY: 'browser-smoke-field-encryption-key',
        ALLOW_DIRECT_TUTOR_REGISTRATION: 'true',
        ADMIN_EMAILS: 'browser.admin@example.com',
        FRONTEND_URL: frontendUrl,
        RATE_LIMIT_MAX: '5000',
        AUTH_RATE_LIMIT_MAX: '500',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: `${backendUrl}/api` },
    },
  ],
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.js/ },
    { name: 'compact-phone', use: { ...devices['iPhone SE'], browserName: 'chromium' }, testMatch: /responsive\.spec\.js/ },
    { name: 'tablet-chromium', use: { ...devices['iPad Mini'], browserName: 'chromium' }, testMatch: /responsive\.spec\.js/ },
  ],
});
