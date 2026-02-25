// @route apps/web/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/audio/(.*)',   // extensão chama sem cookie de sessão Clerk
  '/api/webhooks/(.*)',
])

// Origens permitidas para CORS (extensão Chrome)
const ALLOWED_ORIGINS = [
  'chrome-extension://',  // prefixo — qualquer extensão
]

function isChromeExtension(origin: string | null): boolean {
  return !!origin && origin.startsWith('chrome-extension://')
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-upload-id, x-chunk-index, x-total-chunks, x-session-id',
    'Access-Control-Max-Age':       '86400',
  }
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const origin = req.headers.get('origin') ?? ''

  // ── Responde preflight OPTIONS imediatamente ──────────────────────────
  if (req.method === 'OPTIONS' && isChromeExtension(origin)) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  // ── Protege rotas não-públicas ─────────────────────────────────────────
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // ── Adiciona CORS headers na resposta normal ───────────────────────────
  const res = NextResponse.next()
  if (isChromeExtension(origin)) {
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v))
  }
  return res
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}