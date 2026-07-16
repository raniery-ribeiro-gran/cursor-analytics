"use client";

import { useEffect, useState } from "react";
import type { TokenUsageDateRangeMeta } from "@/lib/tokenUsageDateRange";

function defaultFrom(meta: TokenUsageDateRangeMeta): string {
  if (!meta.maxDate) return "";
  const [year, month, day] = meta.maxDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  date.setUTCDate(date.getUTCDate() - 29);
  const value = date.toISOString().slice(0, 10);
  return meta.minDate && meta.minDate > value ? meta.minDate : value;
}

export function TokenUsageDateRangeFilter({
  meta,
  loading,
  onApply,
}: {
  meta: TokenUsageDateRangeMeta | null;
  loading: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    setFrom(meta.from ?? "");
    setTo(meta.to ?? "");
    setError(null);
  }, [meta]);

  function apply(nextFrom = from, nextTo = to) {
    if (!nextFrom || !nextTo) {
      setError("Informe as datas De e Até.");
      return;
    }
    if (nextFrom > nextTo) {
      setError("A data De deve ser anterior ou igual à data Até.");
      return;
    }
    setError(null);
    onApply(nextFrom, nextTo);
  }

  function applyLast30Days() {
    if (!meta?.maxDate) return;
    const nextFrom = defaultFrom(meta);
    setFrom(nextFrom);
    setTo(meta.maxDate);
    apply(nextFrom, meta.maxDate);
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
              De
            </span>
            <input
              type="date"
              value={from}
              min={meta?.minDate ?? undefined}
              max={meta?.maxDate ?? undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="select-field w-full"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
              Até
            </span>
            <input
              type="date"
              value={to}
              min={meta?.minDate ?? undefined}
              max={meta?.maxDate ?? undefined}
              onChange={(event) => setTo(event.target.value)}
              className="select-field w-full"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !meta?.maxDate}
            onClick={() => apply()}
            className="rounded-md bg-gran-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-gran-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Aplicando…" : "Aplicar"}
          </button>
          <button
            type="button"
            disabled={loading || !meta?.maxDate}
            onClick={applyLast30Days}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gran-navy transition hover:border-gran-blue hover:text-gran-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            Últimos 30 dias
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {meta?.minDate && meta.maxDate ? (
        <p className="mt-2 text-xs text-gran-muted">
          Dados disponíveis de {meta.minDate.split("-").reverse().join("/")} a{" "}
          {meta.maxDate.split("-").reverse().join("/")}.
        </p>
      ) : null}
    </section>
  );
}
