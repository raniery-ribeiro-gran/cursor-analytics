"use client";

import { useEffect, useState } from "react";
import type { MembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";
import { PageHeader } from "./PageHeader";
import { TokenUsageUserDetailView } from "./MembersTokenUsageUserModal";

export function MyTokenUsagePage() {
  const [data, setData] = useState<MembersTokenUsageUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setEmpty(false);
      try {
        const response = await fetch("/api/estatisticas/my-token-usage");
        const payload = await response.json();
        if (cancelled) return;

        if (response.status === 404 && payload.empty) {
          setEmpty(true);
          setData(null);
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Erro ao carregar My Token Usage");
        }

        setData(payload as MembersTokenUsageUserDetail);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar My Token Usage",
          );
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="My Token Usage"
        subtitle="Seu consumo de tokens comparado às tendências gerais do time (último upload)."
        icon="fa-chart-line"
      />

      <main className="flex-1 px-6 py-6">
        {loading ? (
          <p className="text-sm text-gran-muted">Carregando seu usage…</p>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {empty ? (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="font-montserrat text-lg font-bold text-gran-navy">
              Sem dados para o seu e-mail
            </p>
            <p className="mt-2 text-sm text-gran-muted">
              Ainda não há usage events no último upload de Members Token Usage.
              Quando o admin importar os dados, esta tela será preenchida
              automaticamente.
            </p>
          </section>
        ) : null}

        {data ? (
          <div className="space-y-6">
            <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <p className="font-montserrat text-base font-bold text-gran-navy">
                {data.name}
              </p>
              <p className="mt-1 text-sm text-gran-muted">
                {data.email} · ranking #{data.rankByTokens}/{data.totalUsers} em
                tokens · percentil {data.percentileByTokens} · z={data.zScore}
                {data.outlierSide
                  ? ` · outlier ${data.outlierSide === "high" ? "acima" : "abaixo"}`
                  : ""}
              </p>
            </section>
            <TokenUsageUserDetailView data={data} />
          </div>
        ) : null}
      </main>
    </>
  );
}
