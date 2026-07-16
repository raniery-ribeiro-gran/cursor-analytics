import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getTeamTokenUsageData } from "@/lib/teamTokenUsageStats";
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
  if (!leaderEmail) {
    return NextResponse.json(
      { error: "Informe o e-mail do líder" },
      { status: 400 },
    );
  }

  try {
    const dateRange = parseTokenUsageDateRange(request.nextUrl.searchParams);
    return NextResponse.json(
      await getTeamTokenUsageData(leaderEmail, dateRange),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar o time";
    if (error instanceof TokenUsageDateRangeError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[estatisticas/admin/team-token-usage GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
