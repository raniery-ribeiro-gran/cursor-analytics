import { NextRequest, NextResponse } from "next/server";
import { requireTeamTokenUsageAccess } from "@/lib/authz";
import { getTeamTokenUsageData } from "@/lib/teamTokenUsageStats";
import {
  parseTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTeamTokenUsageAccess();
  if ("error" in auth) return auth.error;

  try {
    const dateRange = parseTokenUsageDateRange(request.nextUrl.searchParams);
    const data = await getTeamTokenUsageData(auth.ctx.email, dateRange);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar Team Token Usage";
    if (error instanceof TokenUsageDateRangeError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[estatisticas/team-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Team Token Usage" },
      { status: 500 },
    );
  }
}
