import { type NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// O navegador busca esses arquivos sem cookie para instalar o app; só têm nome e ícone.
const isPwaFile = (pathname: string) =>
  pathname === "/manifest.webmanifest" ||
  pathname === "/apple-icon.png" ||
  pathname.startsWith("/icons/");

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    pathname === "/login" ||
    isPwaFile(pathname) ||
    isValidSession(request.cookies.get(SESSION_COOKIE)?.value)
  ) {
    return NextResponse.next();
  }
  // Server Actions chegam como POST na própria página: responde 401 em vez de redirecionar.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Não autenticado", { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
