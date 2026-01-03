// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Definimos qual rota queremos proteger
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');

  if (isAdminPage) {
    // 2. Verificamos se existe um "cookie" de sessão (que vamos criar no login)
    const isAuthenticated = request.cookies.get('rivilog_admin_session');

    if (!isAuthenticated) {
      // 3. Se não estiver autenticado, redireciona para a Home (ou uma página de erro)
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

// 4. Configuramos o middleware para rodar apenas nas rotas de admin
export const config = {
  matcher: '/admin/:path*',
};