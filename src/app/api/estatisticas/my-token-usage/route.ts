import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getLatestUploadByDataset } from "@/lib/dataUploadsDb";
import { getMembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";
import {
  parseTokenUsageDateRange,
  resolveTokenUsageDateRange,
  TokenUsageDateRangeError,
} from "@/lib/tokenUsageDateRange";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const dateRangeInput = parseTokenUsageDateRange(request.nextUrl.searchParams);
    const data = await getMembersTokenUsageUserDetail(auth.ctx.email, {
      dateRange: dateRangeInput,
    });
    if (!data) {
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
          error:
            "Ainda não há usage events para o seu e-mail no último upload de Members Token Usage.",
          empty: true,
          dateRange,
        },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar My Token Usage";
    if (error instanceof TokenUsageDateRangeError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[estatisticas/my-token-usage GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar My Token Usage" },
      { status: 500 },
    );
  }
}
