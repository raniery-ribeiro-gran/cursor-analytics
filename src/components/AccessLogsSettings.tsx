"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessLogEntry } from "@/lib/accessLogs";
import {
  ACCESS_LOG_STATUS_LABELS,
  ACCESS_LOG_STATUS_STYLES,
  formatAccessLogDateTime,
  formatAccessLogFailure,
} from "@/lib/accessLogs";
import { formatUserAgentSummary } from "@/lib/userAgent";
import type { LoginAttemptStatus } from "@/lib/authDb";
import { PageHeader } from "./PageHeader";

type StatusFilter = LoginAttemptStatus | "all";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "success", label: "Sucessos" },
  { value: "failed", label: "Falhas" },
  { value: "pending", label: "Códigos enviados" },
  { value: "expired", label: "Expirados" },
];

function StatusBadge({ status }: { status: LoginAttemptStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACCESS_LOG_STATUS_STYLES[status]}`}
    >
      {ACCESS_LOG_STATUS_LABELS[status]}
    </span>
  );
}

export function AccessLogsSettings() {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filter !== "all") params.set("status", filter);

      const response = await fetch(`/api/configuracoes/logs-acesso?${params}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar logs");
      }
      setLogs(data.logs as AccessLogEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const successCount = logs.filter((log) => log.status === "success").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;

  return (
    <>
      <PageHeader
        title="Logs de acesso"
        subtitle="Histórico de logins, códigos enviados e tentativas na plataforma"
        icon="fa-shield-halved"
        onRefresh={loadLogs}
        loading={loading}
        refreshLabel="Atualizar logs"
      />

      <main className="flex-1 px-6 py-6">
        <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gran-navy">
          Registro de todas as solicitações de código, logins bem-sucedidos e
          falhas. Códigos gerados após a atualização do sistema ficam salvos para
          auditoria; registros antigos podem não exibir o token.
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Exibidos
            </p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-gran-navy">
              {logs.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Sucessos (filtro)
            </p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-gran-success">
              {successCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Falhas (filtro)
            </p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-red-700">
              {failedCount}
            </p>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === option.value
                  ? "bg-gran-blue text-white"
                  : "border border-gray-200 bg-white text-gran-muted hover:text-gran-navy"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gran-muted">
              Carregando logs…
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gran-muted">
              Nenhum registro encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gran-bg/60 text-xs font-bold uppercase tracking-wide text-gran-muted">
                  <tr>
                    <th className="px-4 py-3">Horário</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Dispositivo</th>
                    <th className="px-4 py-3">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gran-bg/40">
                      <td className="whitespace-nowrap px-4 py-3 text-gran-navy">
                        {formatAccessLogDateTime(log.verifiedAt ?? log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gran-navy">
                        {log.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gran-muted">{log.email}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3">
                        {log.tokenCode ? (
                          <code className="rounded bg-gran-bg px-2 py-0.5 font-mono text-xs font-semibold text-gran-blue">
                            {log.tokenCode}
                          </code>
                        ) : (
                          <span className="text-gran-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gran-muted">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td
                        className="max-w-[200px] truncate px-4 py-3 text-xs text-gran-muted"
                        title={log.userAgent ?? undefined}
                      >
                        {formatUserAgentSummary(log.userAgent)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gran-muted">
                        {log.status === "failed"
                          ? formatAccessLogFailure(log.failureReason)
                          : log.status === "success"
                            ? formatAccessLogDateTime(log.verifiedAt)
                            : log.status === "pending"
                              ? `Expira ${formatAccessLogDateTime(log.expiresAt)}`
                              : formatAccessLogFailure(log.failureReason)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
