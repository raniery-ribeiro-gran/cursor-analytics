import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersTokenUsageData } from "@/lib/membersTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const data = await getMembersTokenUsageData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[estatisticas/members-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Members Token Usage" },
      { status: 500 },
    );
  }
}
