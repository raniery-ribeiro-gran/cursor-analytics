import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  signSessionPayload,
  verifySessionToken,
  type SessionPayload,
} from "./auth-crypto";
import { getEnv } from "./env";
import { normalizeAuthEmail } from "./auth-shared";
import type { UserRole } from "./roles";

export { isValidGranEmail, normalizeAuthEmail } from "./auth-shared";

export const AUTH_SESSION_COOKIE = "gran_ca_session";
export const IMPERSONATOR_SESSION_COOKIE = "gran_ca_impersonator";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const LOGIN_TOKEN_TTL_MS = 60 * 1000;

export function getAuthSecret(): string {
  // Middleware (Edge) só enxerga process.env — precisa ser a mesma fonte do cookie.
  // process.env vem do .env carregado pelo Next; getEnv é fallback (arquivo em disco).
  const secret = process.env.AUTH_SECRET || getEnv("AUTH_SECRET");
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET não configurada. Defina uma chave com pelo menos 16 caracteres no .env",
    );
  }
  return secret;
}

export function getRequestIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function getRequestUserAgent(request: Request | NextRequest): string | null {
  return request.headers.get("user-agent");
}

export async function createSessionToken(
  email: string,
  role: UserRole,
): Promise<string> {
  const payload: SessionPayload = {
    email: normalizeAuthEmail(email),
    role,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signSessionPayload(payload, getAuthSecret());
}

export async function readSessionFromToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    return await verifySessionToken(token, getAuthSecret());
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  return readSessionFromToken(token);
}

export async function getImpersonatorFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATOR_SESSION_COOKIE)?.value;
  return readSessionFromToken(token);
}

export async function hasImpersonatorCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(IMPERSONATOR_SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(token: string) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: AUTH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function impersonatorCookieOptions(token: string) {
  return {
    name: IMPERSONATOR_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function clearImpersonatorCookieOptions() {
  return {
    name: IMPERSONATOR_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
