import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getLatestUploadByDataset } from "@/lib/dataUploadsDb";
import { getMembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";
import {
  parseTokenUsageDateRange,
  resolveTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!email) {
    return NextResponse.json(
      { error: "Informe o e-mail da pessoa" },
      { status: 400 },
    );
  }

  try {
    const dateRangeInput = parseTokenUsageDateRange(
      request.nextUrl.searchParams,
    );
    const data = await getMembersTokenUsageUserDetail(email, {
      dateRange: dateRangeInput,
    });
    if (data) return NextResponse.json(data);

    const upload = await getLatestUploadByDataset("members_token_usage");
    const dateRange = upload
      ? await resolveTokenUsageDateRange(upload.id, dateRangeInput)
      : {
          from: null,
          to: null,
          minDate: null,
          maxDate: null,
          isDefault: !dateRangeInput.from,
        };
    return NextResponse.json(
      {
        error: "Ainda não há usage events para esta pessoa no período.",
        empty: true,
        dateRange,
      },
      { status: 404 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar a pessoa";
    if (error instanceof TokenUsageDateRangeError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[estatisticas/admin/team-token-usage/person GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
