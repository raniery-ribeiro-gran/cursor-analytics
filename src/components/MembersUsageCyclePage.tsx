"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MembersUsageCycleData,
  MembersUsageMember,
  MembersUsageSummary,
} from "@/lib/membersUsageStats";
import type { DataUploadLog } from "@/lib/dataUploadsDb";
import { PageHeader } from "./PageHeader";
import { PersonNameTooltip } from "./PersonNameTooltip";

type SeatFilter = "all" | string;
type RoleFilter = "all" | string;
type SortKey = "onDemand" | "included" | "free" | "name";

function formatUsd(value: number, capped = false): string {
  const base = value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return capped ? `${base.replace(/\.00$/, "")}+` : base;
}

function formatUsageDisplay(value: number, raw: string, capped: boolean): string {
  if (capped) return raw.startsWith("$") ? raw : `$${raw}`;
  return formatUsd(value);
}

function formatUploadDate(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function formatCycleLabel(cycleDate: string | null | undefined): string {
  if (!cycleDate) return "ciclo não identificado";
  const [year, month, day] = cycleDate.split("-");
  if (!year || !month || !day) return cycleDate;
  return `${day}/${month}/${year}`;
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "navy" | "red" | "success";
}) {
  const valueClass =
    accent === "red"
      ? "text-gran-red"
      : accent === "success"
        ? "text-gran-success"
        : "text-gran-navy";

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
        {label}
      </p>
      <p className={`mt-2 font-montserrat text-2xl font-bold ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-gran-muted">{hint}</p> : null}
    </div>
  );
}

function DistBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "blue" | "red" | "gray" | "lime";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const bar =
    tone === "red"
      ? "bg-gran-red"
      : tone === "lime"
        ? "bg-gran-lime"
        : tone === "blue"
          ? "bg-gran-blue"
          : "bg-gray-300";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-gran-navy">{label}</span>
        <span className="text-gran-muted">
          {formatUsd(value)} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function seatsHint(summary: MembersUsageSummary): string {
  const parts = Object.entries(summary.seats).map(
    ([seat, count]) => `${count} ${seat}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function rolesHint(summary: MembersUsageSummary): string {
  const parts = Object.entries(summary.roles).map(
    ([role, count]) => `${role} ${count}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function MembersUsageCyclePage() {
  const [upload, setUpload] = useState<DataUploadLog | null>(null);
  const [summary, setSummary] = useState<MembersUsageSummary | null>(null);
  const [members, setMembers] = useState<MembersUsageMember[]>([]);
  const [topOnDemand, setTopOnDemand] = useState<MembersUsageMember[]>([]);
  const [cycles, setCycles] = useState<DataUploadLog[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [seatFilter, setSeatFilter] = useState<SeatFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("onDemand");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCycle != null) {
        params.set("cycle", String(selectedCycle));
      }
      const response = await fetch(
        `/api/estatisticas/members-usage${params.size ? `?${params}` : ""}`,
      );
      const data = (await response.json()) as MembersUsageCycleData & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar dados");
      }
      setUpload(data.upload);
      setSummary(data.summary);
      setMembers(data.members);
      setTopOnDemand(data.topOnDemand);
      setCycles(data.cycles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [selectedCycle]);

  useEffect(() => {
    void load();
  }, [load]);

  const seatOptions = useMemo(() => {
    const values = Array.from(
      new Set(members.map((member) => member.seatType).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return values;
  }, [members]);

  const roleOptions = useMemo(() => {
    const values = Array.from(
      new Set(members.map((member) => member.role).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return values;
  }, [members]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter((row) => {
      if (seatFilter !== "all" && row.seatType !== seatFilter) return false;
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sortKey === "included") return b.includedUsage - a.includedUsage;
      if (sortKey === "free") return b.freeUsage - a.freeUsage;
      return b.onDemandUsage - a.onDemandUsage;
    });
  }, [members, query, seatFilter, roleFilter, sortKey]);

  const spendMixTotal = summary
    ? summary.includedTotal + summary.freeTotal + summary.onDemandTotal
    : 0;

  const cycleLabel = formatCycleLabel(upload?.cycleDate);
  const subtitle = upload
    ? `Uso por membro no ciclo ${cycleLabel} · última carga ${formatUploadDate(upload.uploadedAt)}`
    : "Uso por membro no ciclo de billing do Cursor";

  return (
    <>
      <PageHeader
        title="Members Usage Cycle"
        subtitle={subtitle}
        icon="fa-chart-column"
        onRefresh={load}
        loading={loading}
        refreshLabel="Atualizar"
      />

      <main className="flex-1 px-6 py-6">
        {cycles.length > 0 ? (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gran-navy">
                Histórico de ciclos
              </p>
              <p className="mt-0.5 text-xs text-gran-muted">
                O ciclo anterior é fechado automaticamente quando os acumulados
                reiniciam.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gran-navy">
              <span className="font-semibold">Ciclo</span>
              <select
                value={selectedCycle ?? upload?.usageCycleId ?? ""}
                onChange={(event) =>
                  setSelectedCycle(Number(event.target.value))
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {cycles.map((cycle, index) => (
                  <option
                    key={cycle.usageCycleId ?? cycle.id}
                    value={cycle.usageCycleId ?? ""}
                  >
                    {index === 0 ? "Atual · " : ""}
                    {formatCycleLabel(cycle.cycleDate)}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {!loading && !upload ? (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="font-montserrat text-lg font-bold text-gran-navy">
              Nenhum CSV carregado
            </p>
            <p className="mt-2 text-sm text-gran-muted">
              Importe o Members Usage cycle em Configurações → Dados para
              visualizar esta estatística.
            </p>
          </section>
        ) : null}

        {summary ? (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Membros"
                value={String(summary.members)}
                hint={seatsHint(summary)}
              />
              <KpiCard
                label="Included Usage"
                value={formatUsd(summary.includedTotal)}
                hint={`${summary.atIncludedCap} no teto de $20`}
              />
              <KpiCard
                label="Free Usage"
                value={formatUsd(summary.freeTotal)}
                hint={`${summary.freeCapped} com Free $20+`}
              />
              <KpiCard
                label="On-Demand"
                value={formatUsd(summary.onDemandTotal)}
                hint={`${summary.withOnDemand} membros com OD`}
                accent="red"
              />
              <KpiCard
                label="Seats idle"
                value={String(summary.idle)}
                hint="Sem Included / Free / OD"
              />
            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-5">
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm lg:col-span-3">
                <h2 className="font-montserrat text-sm font-bold text-gran-navy">
                  Composição do uso (ciclo)
                </h2>
                <p className="mt-1 text-xs text-gran-muted">
                  Soma Included + Free + On-Demand = {formatUsd(spendMixTotal)}
                </p>
                <div className="mt-4 space-y-3">
                  <DistBar
                    label="Included"
                    value={summary.includedTotal}
                    total={spendMixTotal}
                    tone="blue"
                  />
                  <DistBar
                    label="Free"
                    value={summary.freeTotal}
                    total={spendMixTotal}
                    tone="lime"
                  />
                  <DistBar
                    label="On-Demand"
                    value={summary.onDemandTotal}
                    total={spendMixTotal}
                    tone="red"
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-gray-100 bg-gran-bg/50 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
                      Por Seat Type
                    </p>
                    <p className="mt-1 text-sm text-gran-navy">
                      {seatsHint(summary)}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-100 bg-gran-bg/50 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
                      Por Role (Cursor)
                    </p>
                    <p className="mt-1 text-sm text-gran-navy">
                      {rolesHint(summary)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm lg:col-span-2">
                <h2 className="font-montserrat text-sm font-bold text-gran-navy">
                  Top On-Demand
                </h2>
                <p className="mt-1 text-xs text-gran-muted">
                  Maiores gastos além do plano no ciclo
                </p>
                {topOnDemand.length === 0 ? (
                  <p className="mt-4 text-sm text-gran-muted">
                    Nenhum membro com On-Demand neste ciclo.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {topOnDemand.map((row, index) => (
                      <li
                        key={row.email}
                        className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gran-navy">
                            <span className="mr-2 text-gran-muted">
                              {index + 1}.
                            </span>
                            <PersonNameTooltip
                              name={row.name}
                              tribe={row.tribe}
                              leaderName={row.leaderName}
                            />
                          </p>
                          <p className="truncate text-xs text-gran-muted">
                            {row.email}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-gran-red">
                          {formatUsd(row.onDemandUsage)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            <section className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className="block min-w-0 max-w-md flex-1">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
                  Buscar membro
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome ou e-mail"
                  className="select-field w-full"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSeatFilter("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      seatFilter === "all"
                        ? "bg-gran-blue text-white"
                        : "border border-gray-200 bg-white text-gran-muted hover:text-gran-navy"
                    }`}
                  >
                    Todos seats
                  </button>
                  {seatOptions.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => setSeatFilter(seat)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        seatFilter === seat
                          ? "bg-gran-blue text-white"
                          : "border border-gray-200 bg-white text-gran-muted hover:text-gran-navy"
                      }`}
                    >
                      {seat}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRoleFilter("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      roleFilter === "all"
                        ? "bg-gran-navy text-white"
                        : "border border-gray-200 bg-white text-gran-muted hover:text-gran-navy"
                    }`}
                  >
                    Todos roles
                  </button>
                  {roleOptions.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        roleFilter === role
                          ? "bg-gran-navy text-white"
                          : "border border-gray-200 bg-white text-gran-muted hover:text-gran-navy"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-gran-muted">
                  <span className="font-semibold uppercase tracking-wide">
                    Ordenar
                  </span>
                  <select
                    value={sortKey}
                    onChange={(event) =>
                      setSortKey(event.target.value as SortKey)
                    }
                    className="select-field py-1.5 text-xs"
                  >
                    <option value="onDemand">On-Demand</option>
                    <option value="included">Included</option>
                    <option value="free">Free</option>
                    <option value="name">Nome</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gran-navy">
                  Membros do ciclo
                </p>
                <p className="text-xs text-gran-muted">
                  Exibindo {rows.length} de {members.length}
                  {upload?.filename ? ` · ${upload.filename}` : ""}
                </p>
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm text-gran-muted">
                  Carregando membros…
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gran-muted">
                  Nenhum membro encontrado com esses filtros.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-gray-100 bg-gran-bg/60 text-xs font-bold uppercase tracking-wide text-gran-muted">
                      <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">E-mail</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Seat</th>
                        <th className="px-4 py-3 text-right">Included</th>
                        <th className="px-4 py-3 text-right">Free</th>
                        <th className="px-4 py-3 text-right">On-Demand</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.email} className="hover:bg-gran-bg/40">
                          <td className="px-4 py-3 font-semibold text-gran-navy">
                            <PersonNameTooltip
                              name={row.name}
                              tribe={row.tribe}
                              leaderName={row.leaderName}
                            />
                          </td>
                          <td className="px-4 py-3 text-gran-muted">
                            {row.email}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                row.role === "Admin"
                                  ? "bg-gran-navy/10 text-gran-navy"
                                  : "bg-gray-100 text-gran-muted"
                              }`}
                            >
                              {row.role || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                row.seatType === "Standard"
                                  ? "bg-blue-100 text-gran-blue"
                                  : "bg-gray-100 text-gran-muted"
                              }`}
                            >
                              {row.seatType || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-navy">
                            {formatUsd(row.includedUsage)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-navy">
                            {formatUsageDisplay(
                              row.freeUsage,
                              row.freeUsageRaw,
                              row.freeUsageCapped,
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-semibold ${
                              row.onDemandUsage > 0
                                ? "text-gran-red"
                                : "text-gran-muted"
                            }`}
                          >
                            {formatUsd(row.onDemandUsage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}

        {loading && !summary ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gran-muted">
            Carregando estatísticas…
          </div>
        ) : null}
      </main>
    </>
  );
}
