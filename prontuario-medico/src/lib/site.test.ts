import { afterEach, describe, expect, it, vi } from 'vitest'
import { origemDoSite } from './site'

function env(vars: Record<string, string | undefined>) {
  for (const k of ['SITE_URL', 'CONTEXT', 'URL', 'DEPLOY_PRIME_URL']) vi.stubEnv(k, vars[k] as string)
  for (const k of ['SITE_URL', 'CONTEXT', 'URL', 'DEPLOY_PRIME_URL']) if (vars[k] === undefined) delete process.env[k]
}

describe('origemDoSite', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('SITE_URL tem prioridade e perde barra final', () => {
    env({ SITE_URL: 'https://x.app/', CONTEXT: 'production', URL: 'https://prod.app' })
    expect(origemDoSite()).toBe('https://x.app')
  })
  it('production usa URL', () => {
    env({ CONTEXT: 'production', URL: 'https://prod.app', DEPLOY_PRIME_URL: 'https://prime.app' })
    expect(origemDoSite()).toBe('https://prod.app')
  })
  it('branch deploy usa DEPLOY_PRIME_URL', () => {
    env({ CONTEXT: 'branch-deploy', URL: 'https://prod.app', DEPLOY_PRIME_URL: 'https://staging--x.netlify.app' })
    expect(origemDoSite()).toBe('https://staging--x.netlify.app')
  })
  it('sem DEPLOY_PRIME_URL cai em URL, depois localhost', () => {
    env({ CONTEXT: 'branch-deploy', URL: 'https://prod.app' })
    expect(origemDoSite()).toBe('https://prod.app')
    env({})
    expect(origemDoSite()).toBe('http://localhost:3000')
  })
})
