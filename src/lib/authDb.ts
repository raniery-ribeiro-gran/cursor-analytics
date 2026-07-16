import crypto from "crypto";
import { query } from "./sqlite";
import { normalizeAuthEmail } from "./auth";
import { normalizeUserAgent } from "./userAgent";

export type LoginAttemptStatus =
  | "pending"
  | "success"
  | "failed"
  | "expired";

export interface LoginAttempt {
  id: number;
  email: string;
  tokenHash: string;
  ipAddress: string | null;
  status: LoginAttemptStatus;
  failureReason: string | null;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

function hashLoginToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateLoginToken(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let token = "";
  for (let index = 0; index < 8; index += 1) {
    token += charset[bytes[index] % charset.length];
  }
  return token;
}

export async function expirePendingLoginAttempts(email: string): Promise<void> {
  await query(
    `
    UPDATE login_attempts
    SET status = 'expired',
        failure_reason = 'superseded'
    WHERE email = $1 AND status = 'pending'
  `,
    [normalizeAuthEmail(email)],
  );
}

export async function createLoginAttempt(
  email: string,
  token: string,
  ipAddress: string,
  expiresAt: Date,
  userAgent?: string | null,
): Promise<number> {
  const normalized = normalizeAuthEmail(email);
  await expirePendingLoginAttempts(normalized);

  const result = await query<{ id: number }>(
    `
    INSERT INTO login_attempts (
      email, token_hash, token_code, ip_address, user_agent, status, expires_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    RETURNING id
  `,
    [
      normalized,
      hashLoginToken(token),
      token,
      ipAddress,
      normalizeUserAgent(userAgent),
      expiresAt.toISOString(),
    ],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function findValidPendingAttempt(
  email: string,
): Promise<LoginAttempt | null> {
  const result = await query<{
    id: number;
    email: string;
    tokenHash: string;
    ipAddress: string | null;
    status: LoginAttemptStatus;
    failureReason: string | null;
    createdAt: string;
    expiresAt: string;
    verifiedAt: string | null;
  }>(
    `
    SELECT
      id,
      email,
      token_hash AS tokenHash,
      ip_address AS ipAddress,
      status,
      failure_reason AS failureReason,
      created_at AS createdAt,
      expires_at AS expiresAt,
      verified_at AS verifiedAt
    FROM login_attempts
    WHERE email = $1
      AND status = 'pending'
      AND expires_at > $2
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [normalizeAuthEmail(email), new Date().toISOString()],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    email: row.email,
    tokenHash: row.tokenHash,
    ipAddress: row.ipAddress,
    status: row.status,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    verifiedAt: row.verifiedAt,
  };
}

export async function markLoginAttemptSuccess(
  attemptId: number,
  ipAddress: string,
  userAgent?: string | null,
): Promise<void> {
  await query(
    `
    UPDATE login_attempts
    SET status = 'success',
        verified_at = datetime('now'),
        ip_address = COALESCE(ip_address, $2),
        user_agent = COALESCE($3, user_agent)
    WHERE id = $1
  `,
    [attemptId, ipAddress, normalizeUserAgent(userAgent)],
  );
}

export async function recordFailedLoginWithoutPending(
  email: string,
  reason: string,
  ipAddress: string,
  userAgent?: string | null,
): Promise<void> {
  await query(
    `
    INSERT INTO login_attempts (
      email, token_hash, ip_address, user_agent, status, failure_reason, expires_at, verified_at
    ) VALUES ($1, '', $2, $3, 'failed', $4, datetime('now'), datetime('now'))
  `,
    [
      normalizeAuthEmail(email),
      ipAddress,
      normalizeUserAgent(userAgent),
      reason,
    ],
  );
}

export function verifyLoginToken(attempt: LoginAttempt, token: string): boolean {
  const normalizedToken = token.trim().toUpperCase();
  if (normalizedToken.length !== 8) return false;
  const hash = hashLoginToken(normalizedToken);
  return hash === attempt.tokenHash;
}

export interface LoginAttemptListRow {
  id: number;
  email: string;
  tokenCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: LoginAttemptStatus;
  failureReason: string | null;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

export async function listLoginAttempts(
  limit = 200,
  statusFilter?: LoginAttemptStatus | "all",
): Promise<LoginAttemptListRow[]> {
  const params: unknown[] = [limit];
  let statusClause = "";

  if (statusFilter && statusFilter !== "all") {
    params.push(statusFilter);
    statusClause = `AND status = $${params.length}`;
  }

  const result = await query<{
    id: number;
    email: string;
    tokenCode: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    status: LoginAttemptStatus;
    failureReason: string | null;
    createdAt: string;
    expiresAt: string;
    verifiedAt: string | null;
  }>(
    `
    SELECT
      id,
      email,
      token_code AS tokenCode,
      ip_address AS ipAddress,
      user_agent AS userAgent,
      status,
      failure_reason AS failureReason,
      created_at AS createdAt,
      expires_at AS expiresAt,
      verified_at AS verifiedAt
    FROM login_attempts
    WHERE 1=1 ${statusClause}
    ORDER BY created_at DESC
    LIMIT $1
  `,
    params,
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    email: row.email,
    tokenCode: row.tokenCode,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    status: row.status,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    verifiedAt: row.verifiedAt,
  }));
}
