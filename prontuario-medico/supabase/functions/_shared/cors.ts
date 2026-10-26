// CORS da Edge Function: só a origem do app (SITE_URL) pode chamar do navegador.
const CABECALHOS_PERMITIDOS = 'authorization, x-client-info, apikey, content-type'

export function origemPermitida(): string | null {
  const site = Deno.env.get('SITE_URL')
  if (!site) return null
  try {
    return new URL(site).origin
  } catch {
    return null
  }
}

export function corsHeaders(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin')
  const permitida = origemPermitida()
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origem && permitida && origem === permitida) {
    base['Access-Control-Allow-Origin'] = origem
  }
  return base
}
