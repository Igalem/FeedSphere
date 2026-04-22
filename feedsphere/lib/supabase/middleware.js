import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { user } } = await supabase.auth.getUser()

  const url = new URL(request.url)
  const isLoginPage = url.pathname === '/login'
  const isAuthCallback = url.pathname.startsWith('/auth/callback')
  const isApiRoute = url.pathname.startsWith('/api')

  // Rule 1: Redirect unauthenticated users to /login (except for Auth callback and API routes)
  if (!user && !isLoginPage && !isAuthCallback && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rule 2: Redirect logged-in users away from /login
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}
