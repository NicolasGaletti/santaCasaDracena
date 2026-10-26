import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
    },
    {
      // Edge Function admin-usuarios (usa supabase/functions/.env, gitignored, com SITE_URL local).
      // Sem JWT o gateway responde 401, que o Playwright considera "pronto".
      command: 'npx supabase functions serve',
      url: 'http://127.0.0.1:54321/functions/v1/admin-usuarios',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
