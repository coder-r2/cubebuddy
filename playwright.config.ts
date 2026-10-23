import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Runs against the production build served by `vite preview` (build first: `npm run build`).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/cubebuddy/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run preview -- --strictPort --port ${PORT}`,
    url: `http://localhost:${PORT}/cubebuddy/`,
    reuseExistingServer: !process.env.CI,
  },
});
