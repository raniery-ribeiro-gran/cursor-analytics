import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersTokenUsageData } from "@/lib/membersTokenUsageStats";
import { parseTokenUsageDateRange } from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const dateRange = parseTokenUsageDateRange(request.nextUrl.searchParams);
    const data = await getMembersTokenUsageData(dateRange);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar Members Token Usage";
    if (message.includes("Data") || message.includes("datas")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[estatisticas/members-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Members Token Usage" },
      { status: 500 },
    );
  }
}
