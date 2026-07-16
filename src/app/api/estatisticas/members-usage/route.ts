import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersUsageCycleData } from "@/lib/membersUsageStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const rawCycle = request.nextUrl.searchParams.get("cycle");
    const usageCycleId = rawCycle ? Number(rawCycle) : undefined;
    if (
      usageCycleId !== undefined &&
      (!Number.isInteger(usageCycleId) || usageCycleId < 1)
    ) {
      return NextResponse.json({ error: "Ciclo inválido" }, { status: 400 });
    }
    const data = await getMembersUsageCycleData(usageCycleId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[estatisticas/members-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar Members Usage Cycle" },
      { status: 500 },
    );
  }
}
