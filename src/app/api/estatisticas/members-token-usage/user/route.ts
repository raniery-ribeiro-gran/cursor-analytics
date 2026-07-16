import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getMembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";
import {
  parseTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const email = request.nextUrl.searchParams.get("email") ?? "";
    const dateRange = parseTokenUsageDateRange(request.nextUrl.searchParams);
    const data = await getMembersTokenUsageUserDetail(email, { dateRange });
    if (!data) {
      return NextResponse.json(
        { error: "Usuário não encontrado neste upload" },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar detalhe";
    const status =
      error instanceof TokenUsageDateRangeError ||
      message.includes("E-mail inválido")
        ? 400
        : 500;
    if (status >= 500) {
      console.error("[estatisticas/members-token-usage/user GET]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
