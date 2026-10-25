import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

const ROTAS_PUBLICAS = ['/login']
const PREFIXOS_PUBLICOS = ['/auth/']

export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const { pathname, search } = request.nextUrl
  const publica =
    ROTAS_PUBLICAS.includes(pathname) || PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p))

  if (!data?.claims && !publica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
