import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersUsageCycleData } from "@/lib/membersUsageStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const data = await getMembersUsageCycleData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[estatisticas/members-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Members Usage Cycle" },
      { status: 500 },
    );
  }
}
