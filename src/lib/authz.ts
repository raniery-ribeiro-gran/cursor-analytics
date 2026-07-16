import { NextResponse } from "next/server";
import { getSessionFromCookies } from "./auth";
import { canManageBacklog, isAdminRole, canViewTeamTokenUsage, type UserRole } from "./roles";
import { getUserRole } from "./userRolesDb";

export interface AuthContext {
  email: string;
  role: UserRole;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}

export function forbiddenResponse(message = "Acesso negado") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const role = await getUserRole(session.email);
  return { email: session.email, role };
}

type AuthResult =
  | { ctx: AuthContext }
  | { error: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorizedResponse() };
  return { ctx };
}

export async function requirePriorizador(): Promise<AuthResult> {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (!canManageBacklog(result.ctx.role)) {
    return { error: forbiddenResponse("Permissão de priorizador necessária") };
  }
  return result;
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (!isAdminRole(result.ctx.role)) {
    return { error: forbiddenResponse("Permissão de administrador necessária") };
  }
  return result;
}

export async function requireTeamTokenUsageAccess(): Promise<AuthResult> {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (!canViewTeamTokenUsage(result.ctx.role)) {
    return {
      error: forbiddenResponse("Permissão de líder necessária"),
    };
  }
  return result;
}
