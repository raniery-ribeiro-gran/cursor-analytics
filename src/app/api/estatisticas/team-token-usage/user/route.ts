import { NextRequest, NextResponse } from "next/server";
import { requireTeamTokenUsageAccess } from "@/lib/authz";
import { getTeamTokenUsageUserDetail } from "@/lib/teamTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTeamTokenUsageAccess();
  if ("error" in auth) return auth.error;

  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!email) {
    return NextResponse.json(
      { error: "Informe o e-mail do membro" },
      { status: 400 },
    );
  }

  try {
    const data = await getTeamTokenUsageUserDetail(auth.ctx.email, email);
    if (!data) {
      return NextResponse.json(
        { error: "Sem usage events para este membro no último upload" },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar detalhe";
    const status = message.includes("hierarquia") ? 403 : 500;
    console.error("[estatisticas/team-token-usage/user GET]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
