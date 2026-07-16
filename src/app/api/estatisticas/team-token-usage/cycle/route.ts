import { NextResponse } from "next/server";
import { requireTeamTokenUsageAccess } from "@/lib/authz";
import { getTeamMembersCycleUsage } from "@/lib/teamTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTeamTokenUsageAccess();
  if ("error" in auth) return auth.error;

  try {
    return NextResponse.json(
      await getTeamMembersCycleUsage(auth.ctx.email),
    );
  } catch (error) {
    console.error("[estatisticas/team-token-usage/cycle GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar uso do ciclo atual" },
      { status: 500 },
    );
  }
}
