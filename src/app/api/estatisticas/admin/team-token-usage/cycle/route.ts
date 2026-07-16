import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getTeamMembersCycleUsage } from "@/lib/teamTokenUsageStats";

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
    return NextResponse.json(await getTeamMembersCycleUsage(leaderEmail));
  } catch (error) {
    console.error("[estatisticas/admin/team-token-usage/cycle GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar uso do ciclo atual" },
      { status: 500 },
    );
  }
}
