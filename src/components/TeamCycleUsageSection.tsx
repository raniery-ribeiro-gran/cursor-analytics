"use client";

import type { TeamMembersCycleUsage } from "@/lib/teamTokenUsageStats";
import { PersonNameTooltip } from "./PersonNameTooltip";

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatCycleDate(value: string | null): string {
  if (!value) return "não identificado";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function CycleKpi({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-montserrat text-2xl font-bold ${
          accent ? "text-gran-red" : "text-gran-navy"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-gran-muted">{hint}</p> : null}
    </div>
  );
}

export function TeamCycleUsageSection({
  data,
  loading,
  error,
}: {
  data: TeamMembersCycleUsage | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="mt-8 border-t border-gray-200 pt-8">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gran-red">
          Ciclo atual
        </p>
        <h2 className="mt-1 font-montserrat text-xl font-bold text-gran-navy">
          Uso do time no Members Usage Cycle
        </h2>
        <p className="mt-1 text-sm text-gran-muted">
          Acompanhamento cumulativo de Included, Free e On-Demand dos liderados.
          {data?.upload
            ? ` Snapshot de ${formatCycleDate(data.cycleDate)} · ciclo histórico #${data.usageCycleId ?? "—"}.`
            : ""}
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gran-muted">
          Carregando uso do ciclo…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && !data?.upload ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gran-muted">
          Nenhum snapshot de Members Usage Cycle foi importado.
        </div>
      ) : null}

      {!loading && !error && data?.upload ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CycleKpi
              label="Liderados"
              value={String(data.membersWithUsage)}
              hint={`${data.organogramReports} na hierarquia`}
            />
            <CycleKpi
              label="Included Usage"
              value={formatUsd(data.includedTotal)}
            />
            <CycleKpi label="Free Usage" value={formatUsd(data.freeTotal)} />
            <CycleKpi
              label="On-Demand"
              value={formatUsd(data.onDemandTotal)}
              hint={`${data.withOnDemand} com consumo`}
              accent={data.onDemandTotal > 0}
            />
            <CycleKpi
              label="Sem uso"
              value={String(data.idle)}
              hint="Included, Free e On-Demand zerados"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gran-navy">
                Uso por liderado no ciclo
              </p>
            </div>
            {data.members.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gran-muted">
                Nenhum liderado localizado no snapshot atual.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-100 bg-gran-bg/60 text-xs font-bold uppercase tracking-wide text-gran-muted">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Seat</th>
                      <th className="px-4 py-3 text-right">Included</th>
                      <th className="px-4 py-3 text-right">Free</th>
                      <th className="px-4 py-3 text-right">On-Demand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.members.map((member) => (
                      <tr key={member.email} className="hover:bg-gran-bg/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gran-navy">
                            <PersonNameTooltip
                              name={member.name}
                              tribe={member.tribe}
                              leaderName={member.leaderName}
                            />
                          </p>
                          <p className="text-xs text-gran-muted">
                            {member.email}
                            {member.depth > 1
                              ? ` · nível ${member.depth} da hierarquia`
                              : " · direto"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gran-muted">
                          {member.seatType || "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gran-navy">
                          {formatUsd(member.includedUsage)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gran-navy">
                          {formatUsd(member.freeUsage)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-semibold ${
                            member.onDemandUsage > 0
                              ? "text-gran-red"
                              : "text-gran-muted"
                          }`}
                        >
                          {formatUsd(member.onDemandUsage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
