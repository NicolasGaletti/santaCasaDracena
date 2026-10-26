import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { destinoSeguro } from '@/lib/redirect'
import { createClient } from '@/lib/supabase/server'

const TIPOS_OTP = ['invite', 'recovery'] as const satisfies readonly EmailOtpType[]

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const tipo = requestUrl.searchParams.get('type')
  const destination = new URL(destinoSeguro(requestUrl.searchParams.get('next')), requestUrl.origin)

  const supabase = await createClient()

  if (tokenHash) {
    const tipoValido = TIPOS_OTP.find((t) => t === tipo)
    if (!tipoValido) return NextResponse.redirect(new URL('/login?error=link_invalido', requestUrl.origin))
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipoValido })
    if (!error) return NextResponse.redirect(destination)
    return NextResponse.redirect(new URL('/login?error=link_invalido', requestUrl.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(destination)
  }

  return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', requestUrl.origin))
}
