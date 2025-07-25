import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir acesso às páginas públicas
  const publicPaths = ["/login", "/registro", "/"]
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Verificar se é uma rota do backoffice
  if (pathname.startsWith("/backoffice")) {
    // Permitir apenas a página de login do backoffice sem autenticação
    if (pathname === "/backoffice/login") {
      return NextResponse.next()
    }

    // Para outras rotas do backoffice, verificar autenticação será feita no componente
    return NextResponse.next()
  }

  // Para outras rotas protegidas, a verificação será feita no componente
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
