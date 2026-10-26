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
      testIgnore: /pwa\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      testIgnore: /pwa\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // PWA/offline só funciona contra build de produção (em dev o shell não é pré-cacheado).
      name: 'pwa',
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' },
    },
  ],
  webServer: [
    {
      // distDir próprio para não colidir com o .next do `npm run dev`. O .env.development.local
      // (Supabase local) é exportado à mão porque `next build/start` só carregam .env.local.
      command:
        'set -a && . ./.env.development.local && set +a && NEXT_DIST_DIR=.next-e2e npx next build && NEXT_DIST_DIR=.next-e2e npx next start -p 3100',
      url: 'http://localhost:3100/offline',
      reuseExistingServer: true,
      timeout: 300_000,
    },
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
