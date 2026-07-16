import { NextRequest, NextResponse } from "next/server";
import { requireTeamTokenUsageAccess } from "@/lib/authz";
import { getOrganogramDescendantEmailSet } from "@/lib/organogramHierarchy";
import {
  getTokenUsageSlotPeople,
  type TokenUsageSlotQuery,
} from "@/lib/membersTokenUsageStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTeamTokenUsageAccess();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const filters: TokenUsageSlotQuery = {};

  const weekday = searchParams.get("weekday");
  const hour = searchParams.get("hour");
  const date = searchParams.get("date");

  if (weekday != null) filters.weekday = Number(weekday);
  if (hour != null) filters.hour = Number(hour);
  if (date) filters.date = date;

  try {
    const teamEmails = await getOrganogramDescendantEmailSet(auth.ctx.email);
    const data = await getTokenUsageSlotPeople(filters);
    return NextResponse.json({
      ...data,
      people: data.people.filter((person) =>
        teamEmails.has(person.email.toLowerCase()),
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar slot";
    console.error("[estatisticas/team-token-usage/slot GET]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
