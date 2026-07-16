import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getOrganogramDescendantEmailSet } from "@/lib/organogramHierarchy";
import {
  getTokenUsageSlotPeople,
  type TokenUsageSlotQuery,
} from "@/lib/membersTokenUsageStats";
import {
  parseTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const leaderEmail = searchParams.get("leaderEmail")?.trim() ?? "";
  if (!leaderEmail) {
    return NextResponse.json(
      { error: "Informe o e-mail do líder" },
      { status: 400 },
    );
  }

  const filters: TokenUsageSlotQuery = {};
  const weekday = searchParams.get("weekday");
  const hour = searchParams.get("hour");
  const date = searchParams.get("date");
  if (weekday != null) filters.weekday = Number(weekday);
  if (hour != null) filters.hour = Number(hour);
  if (date) filters.date = date;

  try {
    Object.assign(filters, parseTokenUsageDateRange(searchParams));
    const teamEmails = await getOrganogramDescendantEmailSet(leaderEmail);
    const data = await getTokenUsageSlotPeople(filters);
    const people = data.people.filter((person) =>
      teamEmails.has(person.email.toLowerCase()),
    );
    return NextResponse.json({
      ...data,
      events: people.reduce((sum, person) => sum + person.events, 0),
      totalTokens: people.reduce((sum, person) => sum + person.totalTokens, 0),
      people,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar slot";
    const status = error instanceof TokenUsageDateRangeError ? 400 : 500;
    if (status === 500) {
      console.error("[estatisticas/admin/team-token-usage/slot GET]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
