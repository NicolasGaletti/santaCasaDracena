/** Origem do Supabase (ex.: http://127.0.0.1:54321 local) para connect-src/img-src, com o par ws(s). */
function origemSupabase(): { http: string; ws: string } | null {
  const bruto = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!bruto) return null
  try {
    const url = new URL(bruto)
    const seguro = url.protocol === 'https:'
    return { http: url.origin, ws: `${seguro ? 'wss' : 'ws'}://${url.host}` }
  } catch {
    return null
  }
}

export function gerarNonce(): string {
  return btoa(crypto.randomUUID())
}

function montarDiretivas(scriptSrc: string): string {
  const supabase = origemSupabase()
  const connect = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']
  const img = ["'self'", 'data:', 'blob:', 'https://*.supabase.co']
  if (supabase) {
    connect.push(supabase.http, supabase.ws)
    img.push(supabase.http)
  }
  const diretivas = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Sem nonce: com nonce o 'unsafe-inline' seria ignorado, e atributos style="" (Radix, sonner,
    // next/font, Tailwind) não aceitam nonce. Risco baixo: scripts continuam sob nonce.
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect.join(' ')}`,
    `img-src ${img.join(' ')}`,
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  return diretivas.join('; ')
}

export function montarCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development'
  // 'strict-dynamic' propaga a confiança do script com nonce aos chunks que ele carrega.
  // 'unsafe-eval' só em desenvolvimento (React usa eval para stacks de erro).
  return montarDiretivas(`'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`)
}

/**
 * CSP da página /offline: estática e pré-cacheada pelo service worker, então não pode carregar nonce
 * (ficaria obsoleto no cache). Por isso 'unsafe-inline' em script-src. Aceitável: página pública,
 * sem dados, conteúdo fixo do próprio build (sem entrada de usuário). Demais diretivas idênticas.
 */
export function montarCspEstatica(): string {
  return montarDiretivas("'self' 'unsafe-inline'")
}
