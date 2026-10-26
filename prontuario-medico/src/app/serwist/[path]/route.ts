import { createSerwistRoute } from '@serwist/turbopack'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// Só o shell estático e a página offline entram no precache; nada de rota autenticada.
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout.trim()
const revisao = git || randomUUID()

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: '/offline', revision: revisao }],
  globPatterns: [`${process.env.NEXT_DIST_DIR ?? '.next'}/static/**/*.{js,css,woff2}`, 'public/icons/*.png'],
  swSrc: 'src/app/sw.ts',
  useNativeEsbuild: true,
})
