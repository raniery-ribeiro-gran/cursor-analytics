import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const data = await getMembersTokenUsageUserDetail(auth.ctx.email);
    if (!data) {
      return NextResponse.json(
        {
          error:
            "Ainda não há usage events para o seu e-mail no último upload de Members Token Usage.",
          empty: true,
        },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[estatisticas/my-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar My Token Usage" },
      { status: 500 },
    );
  }
}
