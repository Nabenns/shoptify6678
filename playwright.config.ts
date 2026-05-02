import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  timeout: 300_000,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  projects: [
    {
      name: 'unit',
      testMatch: '**/*.unit.spec.ts',
    },
    {
      name: 'e2e',
      testMatch: '**/trial-signup.spec.ts',
      use: {
        baseURL: process.env.BASE_URL,
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
});
