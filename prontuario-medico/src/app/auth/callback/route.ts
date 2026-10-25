import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next') ?? '/'
  const nextUrl = new URL(requestedNext, requestUrl.origin)
  const destination = nextUrl.origin === requestUrl.origin ? nextUrl : new URL('/', requestUrl.origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(destination)
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', requestUrl.origin))
}
