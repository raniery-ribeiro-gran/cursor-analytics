import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  CURSOR_DATASET_LIST,
  isCursorDatasetKey,
} from "@/lib/cursorDatasets";
import {
  getLatestUploadByDataset,
  importMembersTokenUsageCsv,
  importMembersUsageCsv,
  listLatestUploads,
} from "@/lib/dataUploadsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latest = await listLatestUploads();
    const datasets = CURSOR_DATASET_LIST.map((dataset) => ({
      ...dataset,
      lastUpload: latest[dataset.key] ?? null,
    }));
    return NextResponse.json({ datasets });
  } catch (error) {
    console.error("[configuracoes/dados GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar status dos uploads" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const form = await request.formData();
    const datasetRaw = String(form.get("dataset") ?? "");
    const file = form.get("file");

    if (!isCursorDatasetKey(datasetRaw)) {
      return NextResponse.json(
        { error: "Dataset inválido" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo CSV não enviado" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Envie um arquivo .csv" },
        { status: 400 },
      );
    }

    const content = await file.text();

    if (datasetRaw === "members_usage") {
      const upload = await importMembersUsageCsv({
        filename: file.name,
        content,
        uploadedByEmail: session?.email ?? null,
      });

      if (upload.status === "error") {
        return NextResponse.json(
          { error: upload.errorMessage ?? "Falha no import", upload },
          { status: 400 },
        );
      }

      const lastUpload = await getLatestUploadByDataset("members_usage");
      return NextResponse.json({ ok: true, upload: lastUpload ?? upload });
    }

    if (datasetRaw === "members_token_usage") {
      const upload = await importMembersTokenUsageCsv({
        filename: file.name,
        content,
        uploadedByEmail: session?.email ?? null,
      });

      if (upload.status === "error") {
        return NextResponse.json(
          { error: upload.errorMessage ?? "Falha no import", upload },
          { status: 400 },
        );
      }

      const lastUpload = await getLatestUploadByDataset("members_token_usage");
      return NextResponse.json({ ok: true, upload: lastUpload ?? upload });
    }

    return NextResponse.json(
      { error: "Dataset ainda não suportado" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[configuracoes/dados POST]", error);
    return NextResponse.json(
      { error: "Erro ao processar upload" },
      { status: 500 },
    );
  }
}
