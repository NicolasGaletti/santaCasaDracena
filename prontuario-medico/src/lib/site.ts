/** Origem pública do site, vinda de configuração (nunca de cabeçalho enviado pelo cliente). */
export function origemDoSite(): string {
  const configurada = process.env.SITE_URL ?? process.env.URL ?? 'http://localhost:3000'
  return configurada.replace(/\/+$/, '')
}
