import { NextRequest, NextResponse } from "next/server";
import {
  APP_HOME_PATH,
  isAdminOnlyPath,
  isAdminRole,
  isLeaderAllowedPath,
  isLeaderRole,
  isReaderAllowedPath,
  isReaderRole,
} from "@/lib/roles";
import { AUTH_SESSION_COOKIE } from "@/lib/auth";
import { verifySessionToken } from "@/lib/auth-crypto";

const PUBLIC_PAGE_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = [
  "/api/auth/request-token",
  "/api/auth/verify-token",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_PATHS.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login") {
      const secret = process.env.AUTH_SECRET;
      if (secret && secret.length >= 16) {
        const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
        const session = token
          ? await verifySessionToken(token, secret)
          : null;
        if (session) {
          return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
        }
      }
    }
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "AUTH_SECRET não configurada no servidor" },
        { status: 503 },
      );
    }
    return new NextResponse("AUTH_SECRET não configurada no servidor", {
      status: 503,
    });
  }

  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token, secret) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isReaderRole(session.role) && !isReaderAllowedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
  }

  if (isLeaderRole(session.role) && !isLeaderAllowedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
  }

  if (isAdminOnlyPath(pathname) && !isAdminRole(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
