"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "./PageHeader";
import type { DataUploadLog } from "@/lib/dataUploadsDb";

interface DatasetCard {
  key: string;
  label: string;
  description: string;
  expectedHeaders: readonly string[];
  lastUpload: DataUploadLog | null;
}

function formatUploadDate(iso: string | null | undefined): string {
  if (!iso) return "Nunca enviado";
  const date = new Date(iso.includes("T") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) {
    // SQLite datetime('now') costuma vir como "YYYY-MM-DD HH:MM:SS"
    const fallback = new Date(iso.replace(" ", "T") + "Z");
    if (Number.isNaN(fallback.getTime())) return iso;
    return fallback.toLocaleString("pt-BR");
  }
  return date.toLocaleString("pt-BR");
}

export function DataUploadsSettings() {
  const [datasets, setDatasets] = useState<DatasetCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/dados");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar dados");
      }
      setDatasets(data.datasets as DatasetCard[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleUpload(datasetKey: string, file: File | null) {
    if (!file) return;
    setUploadingKey(datasetKey);
    setMessage(null);
    setError(null);

    try {
      const form = new FormData();
      form.set("dataset", datasetKey);
      form.set("file", file);

      const response = await fetch("/api/configuracoes/dados", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Falha no upload");
      }

      const upload = data.upload as DataUploadLog | undefined;
      const inserted = upload?.rowCount ?? 0;
      const ignored = upload?.ignoredRowCount ?? 0;
      const parsed = upload?.parsedRowCount ?? inserted + ignored;
      setMessage(
        datasetKey === "members_token_usage"
          ? `Upload incremental concluído: ${inserted} eventos novos e ${ignored} ignorados por pertencerem a dias já armazenados (${parsed} lidos).`
          : `Snapshot do ciclo ${upload?.usageCycleId ?? "—"} salvo: ${inserted} membros processados.`,
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Dados"
        subtitle="Importação dos CSVs extraídos do painel do Cursor"
        icon="fa-database"
        onRefresh={loadStatus}
        loading={loading}
        refreshLabel="Atualizar"
      />

      <main className="flex-1 px-6 py-6">
        <p className="mb-6 max-w-3xl text-sm text-gran-muted">
          Faça upload dos arquivos exportados do Cursor. Cada dataset mantém um
          histórico de envios; o cartão mostra quando foi o último import
          bem-sucedido.
        </p>

        {message && (
          <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-gran-success">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && datasets.length === 0 ? (
          <p className="text-sm text-gran-muted">Carregando datasets…</p>
        ) : (
          <ul className="space-y-4">
            {datasets.map((dataset) => {
              const last = dataset.lastUpload;
              const busy = uploadingKey === dataset.key;

              return (
                <li
                  key={dataset.key}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-montserrat text-base font-bold text-gran-navy">
                        {dataset.label}
                      </h2>
                      <p className="mt-1 text-sm text-gran-muted">
                        {dataset.description}
                      </p>
                      <p className="mt-2 text-xs text-gran-muted">
                        Colunas: {dataset.expectedHeaders.join(" · ")}
                      </p>

                      <div className="mt-4 rounded-lg bg-gran-bg px-3 py-2 text-sm text-gran-navy">
                        <p className="font-semibold">
                          Último envio:{" "}
                          <span className="font-normal">
                            {formatUploadDate(last?.uploadedAt)}
                          </span>
                        </p>
                        {last && (
                          <p className="mt-1 text-xs text-gran-muted">
                            {last.filename}
                            {last.cycleDate ? ` · ciclo ${last.cycleDate}` : ""}
                            {last.rowCount
                              ? ` · ${last.rowCount} registros`
                              : ""}
                            {last.ignoredRowCount
                              ? ` · ${last.ignoredRowCount} ignorados`
                              : ""}
                            {last.usageCycleId
                              ? ` · ciclo histórico #${last.usageCycleId}`
                              : ""}
                            {last.uploadedByEmail
                              ? ` · por ${last.uploadedByEmail}`
                              : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gran-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gran-blue/90 disabled:opacity-50">
                        <i
                          className={`fa-solid ${
                            busy ? "fa-spinner animate-spin" : "fa-upload"
                          }`}
                          aria-hidden="true"
                        />
                        {busy ? "Enviando…" : "Enviar CSV"}
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.target.value = "";
                            void handleUpload(dataset.key, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
