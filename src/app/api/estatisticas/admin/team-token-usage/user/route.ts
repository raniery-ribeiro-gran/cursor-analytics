import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getTeamTokenUsageUserDetail } from "@/lib/teamTokenUsageStats";
import {
  parseTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const leaderEmail =
    request.nextUrl.searchParams.get("leaderEmail")?.trim() ?? "";
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!leaderEmail || !email) {
    return NextResponse.json(
      { error: "Informe o líder e o membro" },
      { status: 400 },
    );
  }

  try {
    const dateRange = parseTokenUsageDateRange(request.nextUrl.searchParams);
    const data = await getTeamTokenUsageUserDetail(
      leaderEmail,
      email,
      dateRange,
    );
    if (!data) {
      return NextResponse.json(
        { error: "Sem usage events para este membro no período" },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar detalhe";
    const status =
      error instanceof TokenUsageDateRangeError
        ? 400
        : message.includes("hierarquia")
          ? 403
          : 500;
    if (status === 500) {
      console.error("[estatisticas/admin/team-token-usage/user GET]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
