import type { NextRequest } from 'next/server'
import { atualizarSessao } from '@/lib/supabase/proxy'
import { gerarNonce, montarCsp } from '@/lib/csp'

export async function proxy(request: NextRequest) {
  // Nonce por requisição: o Next lê o CSP do request e aplica o nonce aos scripts que renderiza.
  const nonce = gerarNonce()
  const csp = montarCsp(nonce)
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  return atualizarSessao(request, headers, csp)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|serwist/|manifest.webmanifest|offline$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
