import { NextRequest, NextResponse } from "next/server";
import type { LoginAttemptStatus } from "@/lib/authDb";
import { listLoginAttempts } from "@/lib/authDb";
import type { AccessLogEntry } from "@/lib/accessLogs";
import { findPersonByEmail } from "@/lib/organogramDb";

export const dynamic = "force-dynamic";

const VALID_FILTERS = new Set<LoginAttemptStatus | "all">([
  "all",
  "pending",
  "success",
  "failed",
  "expired",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      500,
      Math.max(1, Number(searchParams.get("limit") ?? "200") || 200),
    );
    const filterParam = searchParams.get("status") ?? "all";
    const statusFilter = VALID_FILTERS.has(filterParam as LoginAttemptStatus | "all")
      ? (filterParam as LoginAttemptStatus | "all")
      : "all";

    const rows = await listLoginAttempts(limit, statusFilter);

    const logs: AccessLogEntry[] = await Promise.all(
      rows.map(async (row) => {
        const person = await findPersonByEmail(row.email);
        return {
          id: row.id,
          email: row.email,
          name: person?.name ?? null,
          status: row.status,
          failureReason: row.failureReason,
          tokenCode: row.tokenCode,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          verifiedAt: row.verifiedAt,
        };
      }),
    );

    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error("[configuracoes/logs-acesso]", error);
    return NextResponse.json(
      { error: "Erro ao carregar logs de acesso" },
      { status: 500 },
    );
  }
}
