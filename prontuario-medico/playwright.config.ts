import { defineConfig, devices } from '@playwright/test';

// PWA/headers exigem build de produção (lento): só entram com PWA_E2E=1 (`npm run test:e2e:pwa`).
const pwa = process.env.PWA_E2E === '1'

export default defineConfig({
  testDir: './e2e',
  // Em série: os usuários do seed são compartilhados e o login falha de forma intermitente em paralelo.
  workers: 1,
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
    ...(pwa
      ? [
          {
            // PWA/offline só funciona contra build de produção (em dev o shell não é pré-cacheado).
            name: 'pwa',
            testMatch: /(pwa|headers)\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' },
          },
        ]
      : []),
  ],
  webServer: [
    ...(pwa
      ? [
          {
            // distDir próprio para não colidir com o .next do `npm run dev`. O .env.development.local
            // (Supabase local) é exportado à mão porque `next build/start` só carregam .env.local;
            // se não existir, usa as variáveis do ambiente.
            command:
              'if [ -f ./.env.development.local ]; then set -a; . ./.env.development.local; set +a; fi; NEXT_DIST_DIR=.next-e2e npx next build && NEXT_DIST_DIR=.next-e2e npx next start -p 3100',
            url: 'http://localhost:3100/offline',
            reuseExistingServer: !process.env.CI,
            timeout: 300_000,
          },
        ]
      : []),
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Edge Function admin-usuarios (usa supabase/functions/.env, gitignored, com SITE_URL local).
      // Sem JWT o gateway responde 401, que o Playwright considera "pronto".
      command: 'npx supabase functions serve',
      url: 'http://127.0.0.1:54321/functions/v1/admin-usuarios',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
