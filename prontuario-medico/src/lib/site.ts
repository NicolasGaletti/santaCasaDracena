/**
 * Origem pública do site, vinda de configuração (nunca de cabeçalho enviado pelo cliente).
 * No Netlify, `URL` é sempre a de produção, inclusive em branch deploys; por isso fora de
 * produção usa-se `DEPLOY_PRIME_URL`. Lido em tempo de requisição (process.env dinâmico).
 */
export function origemDoSite(): string {
  const env = process.env
  const porContexto = env.CONTEXT === 'production' ? env.URL : env.DEPLOY_PRIME_URL
  const configurada = env.SITE_URL ?? porContexto ?? env.URL ?? 'http://localhost:3000'
  return configurada.replace(/\/+$/, '')
}
