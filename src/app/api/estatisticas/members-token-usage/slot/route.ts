import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getTokenUsageSlotPeople } from "@/lib/membersTokenUsageStats";
import {
  parseTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const weekdayRaw = searchParams.get("weekday");
    const hourRaw = searchParams.get("hour");
    const date = searchParams.get("date") ?? undefined;
    const dateRange = parseTokenUsageDateRange(searchParams);

    const weekday =
      weekdayRaw === null || weekdayRaw === ""
        ? undefined
        : Number(weekdayRaw);
    const hour =
      hourRaw === null || hourRaw === "" ? undefined : Number(hourRaw);

    if (weekday !== undefined && !Number.isFinite(weekday)) {
      return NextResponse.json({ error: "weekday inválido" }, { status: 400 });
    }
    if (hour !== undefined && !Number.isFinite(hour)) {
      return NextResponse.json({ error: "hour inválido" }, { status: 400 });
    }

    const data = await getTokenUsageSlotPeople({
      weekday,
      hour,
      date,
      ...dateRange,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar detalhe";
    const status =
      error instanceof TokenUsageDateRangeError ||
      message.includes("Informe") ||
      message.includes("inválid")
        ? 400
        : 500;
    if (status >= 500) {
      console.error("[estatisticas/members-token-usage/slot GET]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
