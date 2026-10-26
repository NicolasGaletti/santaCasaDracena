import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { destinoSeguro } from '@/lib/redirect'
import { createClient } from '@/lib/supabase/server'

const TIPOS_OTP: EmailOtpType[] = ['invite', 'recovery', 'email', 'magiclink', 'signup', 'email_change']

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const tipo = requestUrl.searchParams.get('type') as EmailOtpType | null
  const destination = new URL(destinoSeguro(requestUrl.searchParams.get('next')), requestUrl.origin)

  const supabase = await createClient()

  if (tokenHash && tipo && TIPOS_OTP.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
    if (!error) return NextResponse.redirect(destination)
    return NextResponse.redirect(new URL('/login?error=link_invalido', requestUrl.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(destination)
  }

  return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', requestUrl.origin))
}
