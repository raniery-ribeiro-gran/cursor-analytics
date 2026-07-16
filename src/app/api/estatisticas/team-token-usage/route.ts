import { NextResponse } from "next/server";
import { requireTeamTokenUsageAccess } from "@/lib/authz";
import { getTeamTokenUsageData } from "@/lib/teamTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTeamTokenUsageAccess();
  if ("error" in auth) return auth.error;

  try {
    const data = await getTeamTokenUsageData(auth.ctx.email);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[estatisticas/team-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Team Token Usage" },
      { status: 500 },
    );
  }
}
