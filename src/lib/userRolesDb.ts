import { normalizeAuthEmail } from "./auth-shared";
import { query } from "./sqlite";
import {
  DEFAULT_USER_ROLE,
  isUserRole,
  type UserRole,
  normalizeUserRole,
} from "./roles";

export interface UserRoleRow {
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccessEntry {
  email: string;
  name: string;
  department: string;
  role: UserRole;
  hasLoggedIn: boolean;
  updatedAt: string | null;
}

export interface OrganogramUserCandidate {
  email: string;
  name: string;
  department: string;
}

function mapUserRoleRow(row: Record<string, unknown>): UserRoleRow {
  return {
    email: row.email as string,
    role: normalizeUserRole(row.role as string),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getUserRole(email: string): Promise<UserRole> {
  const normalized = normalizeAuthEmail(email);

  try {
    const result = await query<{ role: string }>(
      `SELECT role FROM user_roles WHERE email = $1`,
      [normalized],
    );
    const role = result.rows[0]?.role;
    return normalizeUserRole(role);
  } catch (error) {
    if (isMissingUserRolesTable(error)) {
      return DEFAULT_USER_ROLE;
    }
    throw error;
  }
}

/** Garante registro com perfil Leitor no primeiro login. */
export async function ensureUserRole(email: string): Promise<UserRole> {
  const normalized = normalizeAuthEmail(email);

  try {
    await query(
      `
      INSERT INTO user_roles (email, role)
      VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING
    `,
      [normalized, DEFAULT_USER_ROLE],
    );
    return getUserRole(normalized);
  } catch (error) {
    if (isMissingUserRolesTable(error)) {
      console.warn(
        "[userRoles] Tabela user_roles ausente — execute npm run db:migrate",
      );
      return DEFAULT_USER_ROLE;
    }
    throw error;
  }
}

function isMissingUserRolesTable(error: unknown): boolean {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return /no such table:\s*user_roles/i.test(message);
}

export async function listUserAccessEntries(): Promise<UserAccessEntry[]> {
  const result = await query(
    `
    SELECT
      lower(t.email) AS email,
      t.name,
      t.tribe AS department,
      ur.role,
      ur.updated_at,
      ur.logged_in_at
    FROM user_roles ur
    INNER JOIN tech_organogram t ON lower(t.email) = ur.email
    ORDER BY t.name ASC, t.email ASC
  `,
  );

  return result.rows.map((row) => {
    const record = row as Record<string, unknown>;
    const roleValue = record.role as string;
    return {
      email: record.email as string,
      name: record.name as string,
      department: record.department as string,
      role: normalizeUserRole(roleValue),
      hasLoggedIn: record.logged_in_at != null,
      updatedAt: record.updated_at ? String(record.updated_at) : null,
    };
  });
}

export async function listOrganogramUsersWithoutRole(): Promise<
  OrganogramUserCandidate[]
> {
  const result = await query(
    `
    SELECT lower(t.email) AS email, t.name, t.tribe AS department
    FROM tech_organogram t
    LEFT JOIN user_roles ur ON ur.email = lower(t.email)
    WHERE ur.email IS NULL
    ORDER BY t.name ASC, t.email ASC
  `,
  );

  return result.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      email: record.email as string,
      name: record.name as string,
      department: record.department as string,
    };
  });
}

export async function createUserRole(
  email: string,
  role: UserRole,
): Promise<UserRoleRow | "exists" | "not_in_organogram" | null> {
  if (!isUserRole(role)) return null;

  const normalized = normalizeAuthEmail(email);
  const exists = await query(
    `SELECT 1 AS ok FROM tech_organogram WHERE lower(email) = $1`,
    [normalized],
  );
  if (exists.rowCount === 0) return "not_in_organogram";

  const already = await query(`SELECT 1 AS ok FROM user_roles WHERE email = $1`, [
    normalized,
  ]);
  if (already.rowCount > 0) return "exists";

  await query(
    `
    INSERT INTO user_roles (email, role, updated_at)
    VALUES ($1, $2, datetime('now'))
  `,
    [normalized, role],
  );

  const result = await query(
    `
    SELECT email, role, created_at, updated_at
    FROM user_roles
    WHERE email = $1
  `,
    [normalized],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapUserRoleRow(row);
}

export async function markUserLoggedIn(email: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  await query(
    `
    UPDATE user_roles
    SET logged_in_at = COALESCE(logged_in_at, datetime('now'))
    WHERE email = $1
  `,
    [normalized],
  );
}

export async function updateUserRole(
  email: string,
  role: UserRole,
): Promise<UserRoleRow | null> {
  if (!isUserRole(role)) return null;

  const normalized = normalizeAuthEmail(email);
  const exists = await query(
    `SELECT 1 AS ok FROM tech_organogram WHERE lower(email) = $1`,
    [normalized],
  );
  if (exists.rowCount === 0) return null;

  await query(
    `
    INSERT INTO user_roles (email, role, updated_at)
    VALUES ($1, $2, datetime('now'))
    ON CONFLICT (email) DO UPDATE SET
      role = excluded.role,
      updated_at = datetime('now')
  `,
    [normalized, role],
  );

  const result = await query(
    `
    SELECT email, role, created_at, updated_at
    FROM user_roles
    WHERE email = $1
  `,
    [normalized],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapUserRoleRow(row);
}

export async function countAdmins(excludeEmail?: string): Promise<number> {
  const normalizedExclude = excludeEmail
    ? normalizeAuthEmail(excludeEmail)
    : null;

  const result = await query<{ total: number }>(
    `
    SELECT COUNT(*) AS total
    FROM user_roles
    WHERE role = 'administrador'
      AND ($1 IS NULL OR email <> $1)
  `,
    [normalizedExclude],
  );

  return Number(result.rows[0]?.total ?? 0);
}
