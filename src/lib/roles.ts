import { normalizeAuthEmail } from "./auth-shared";

export type UserRole =
  | "administrador"
  | "priorizador"
  | "demandante"
  | "leitor"
  | "lider";

export const USER_ROLES: UserRole[] = [
  "administrador",
  "priorizador",
  "demandante",
  "leitor",
  "lider",
];

/** Perfis gerenciáveis na UI nesta fase. */
export const MANAGEABLE_USER_ROLES: UserRole[] = [
  "administrador",
  "lider",
  "leitor",
];

export const DEFAULT_USER_ROLE: UserRole = "leitor";

/** Home do app (My Token Usage) — também a única tela do perfil Leitor. */
export const APP_HOME_PATH = "/";

/** @deprecated Use APP_HOME_PATH. */
export const READER_HOME_PATH = APP_HOME_PATH;

export const TEAM_TOKEN_USAGE_PATH = "/estatisticas/team-token-usage";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  administrador: "Administrador",
  priorizador: "Priorizador",
  demandante: "Demandante",
  leitor: "Leitor",
  lider: "Líder",
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrador:
    "Acesso total ao Cursor Analytics: configurações, uploads de dados, logs, controle de acesso e simulação de usuários.",
  priorizador: "Reservado para fases futuras.",
  demandante: "Reservado para fases futuras.",
  leitor:
    "Acesso à home (My Token Usage): vê o próprio consumo de tokens comparado às tendências gerais do time.",
  lider:
    "Acesso à home e ao Team Token Usage: acompanha o consumo dos liderados (toda a hierarquia abaixo) comparado à média de toda a Diretoria de TI.",
};

export const ADMIN_ONLY_PAGE_PATHS = [
  "/configuracoes/dados",
  "/configuracoes/logs-acesso",
  "/configuracoes/controle-acesso",
  "/configuracoes/perfis",
] as const;

export const ADMIN_ONLY_API_PREFIXES = [
  "/api/configuracoes/dados",
  "/api/configuracoes/logs-acesso",
  "/api/configuracoes/usuarios",
  "/api/configuracoes/simular-usuario",
] as const;

export const LEADER_ONLY_PAGE_PATHS = [TEAM_TOKEN_USAGE_PATH] as const;

export const LEADER_ONLY_API_PREFIXES = [
  "/api/estatisticas/team-token-usage",
] as const;

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isManageableUserRole(value: string): value is UserRole {
  return MANAGEABLE_USER_ROLES.includes(value as UserRole);
}

export function normalizeUserRole(
  value: string | null | undefined,
): UserRole {
  if (value && isUserRole(value)) return value;
  return DEFAULT_USER_ROLE;
}

export function isAdminRole(role: UserRole): boolean {
  return role === "administrador";
}

export function isReaderRole(role: UserRole): boolean {
  return role === "leitor";
}

export function isLeaderRole(role: UserRole): boolean {
  return role === "lider";
}

/** Admin ou Líder podem ver Team Token Usage. */
export function canViewTeamTokenUsage(role: UserRole): boolean {
  return isAdminRole(role) || isLeaderRole(role);
}

export function isLeaderOnlyPath(pathname: string): boolean {
  if (
    LEADER_ONLY_PAGE_PATHS.includes(
      pathname as (typeof LEADER_ONLY_PAGE_PATHS)[number],
    )
  ) {
    return true;
  }
  return LEADER_ONLY_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/** Rotas liberadas para o perfil Leitor (páginas + APIs de auth/sessão). */
export function isReaderAllowedPath(pathname: string): boolean {
  if (pathname === APP_HOME_PATH) return true;
  if (pathname === "/estatisticas/my-token-usage") return true;
  if (pathname.startsWith("/api/estatisticas/my-token-usage")) return true;
  // Deixa o request chegar à autorização baseada no banco. Isso permite que
  // uma promoção Leitor → Líder funcione sem exigir novo login/cookie.
  if (pathname === TEAM_TOKEN_USAGE_PATH) return true;
  if (pathname.startsWith("/api/estatisticas/team-token-usage")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

/** Únicas rotas disponíveis para o perfil Líder. */
export function isLeaderAllowedPath(pathname: string): boolean {
  if (pathname === APP_HOME_PATH) return true;
  if (pathname === "/estatisticas/my-token-usage") return true;
  if (pathname === TEAM_TOKEN_USAGE_PATH) return true;
  if (pathname.startsWith("/api/estatisticas/my-token-usage")) return true;
  if (pathname.startsWith("/api/estatisticas/team-token-usage")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export function canPrioritizeDemands(role: UserRole): boolean {
  return (
    role === "administrador" ||
    role === "priorizador" ||
    role === "demandante"
  );
}

export function canManageBacklog(role: UserRole): boolean {
  return role === "administrador" || role === "priorizador";
}

export function canPrioritize(role: UserRole): boolean {
  return canManageBacklog(role);
}

export function isAdminOnlyPath(pathname: string): boolean {
  if (
    ADMIN_ONLY_PAGE_PATHS.includes(
      pathname as (typeof ADMIN_ONLY_PAGE_PATHS)[number],
    )
  ) {
    return true;
  }
  return ADMIN_ONLY_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/** @deprecated Use isAdminRole com perfil da sessão. */
export function isAdminEmail(email: string): boolean {
  return (
    normalizeAuthEmail(email) ===
    normalizeAuthEmail("raniery.ribeiro@gran.com")
  );
}
