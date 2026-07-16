"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DataUploadLog } from "@/lib/dataUploadsDb";
import {
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
} from "@/lib/membersTokenUsageConstants";
import type {
  MembersTokenUsageData,
  MembersTokenUsageUserDetail,
  TokenUsageDailyPoint,
  TokenUsageHeatCell,
  TokenUsageHourPoint,
  TokenUsageKindBreakdown,
  TokenUsageModelBreakdown,
  TokenUsageOutlier,
  TokenUsageSlotBreakdown,
  TokenUsageSlotQuery,
  TokenUsageSummary,
  TokenUsageUserRow,
} from "@/lib/membersTokenUsageStats";
import { PageHeader } from "./PageHeader";
import { MembersTokenUsageUserModal } from "./MembersTokenUsageUserModal";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
/** Ordem de exibição do heatmap: Seg→Dom */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

type SortKey = "tokens" | "events" | "cost" | "outside" | "email";

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}K`;
  }
  return value.toLocaleString("en-US");
}

function formatUploadDate(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.includes("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(value.replace(" ", "T"));
    if (Number.isNaN(fallback.getTime())) return value;
    return fallback.toLocaleString("pt-BR");
  }
  return date.toLocaleString("pt-BR");
}

function parseBrtDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDayMonthYear(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildPeriodLabel(summary: TokenUsageSummary): string {
  const start = parseBrtDate(summary.periodStartBrt);
  const end = parseBrtDate(summary.periodEndBrt);
  if (!start || !end) {
    return `Período não identificado · horários em Brasília (UTC−3)`;
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = sameYear ? formatDayMonth(start) : formatDayMonthYear(start);
  const endLabel = formatDayMonthYear(end);
  const days = summary.periodDays || 1;

  return `Período: ${startLabel} a ${endLabel} · ${days} dias · horários em Brasília (UTC−3)`;
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
  accent?: "navy" | "red" | "amber";
}) {
  const valueClass =
    accent === "red"
      ? "text-gran-red"
      : accent === "amber"
        ? "text-amber-700"
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

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="font-montserrat text-sm font-bold text-gran-navy">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-xs text-gran-muted">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DailyChart({
  daily,
  onSelect,
}: {
  daily: TokenUsageDailyPoint[];
  onSelect: (query: TokenUsageSlotQuery) => void;
}) {
  const maxTokens = Math.max(...daily.map((d) => d.totalTokens), 1);
  const chartHeightPx = 160;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] items-end gap-1.5">
        {daily.map((day) => {
          const barHeight = Math.max(
            Math.round((day.totalTokens / maxTokens) * chartHeightPx),
            day.totalTokens > 0 ? 4 : 0,
          );
          const outsideHeavy = day.outsidePct >= 20;
          return (
            <button
              key={day.date}
              type="button"
              disabled={day.events <= 0}
              onClick={() => onSelect({ date: day.date })}
              className="flex flex-1 flex-col items-center disabled:cursor-default enabled:cursor-pointer enabled:hover:opacity-90"
              title={`${day.date}: ${formatTokens(day.totalTokens)} tokens · ${day.events} evt · clique para ver pessoas`}
            >
              <div
                className="flex w-full flex-col justify-end"
                style={{ height: chartHeightPx }}
              >
                <div
                  className={`w-full rounded-t ${
                    outsideHeavy ? "bg-gran-red/80" : "bg-gran-blue"
                  }`}
                  style={{ height: barHeight }}
                />
              </div>
              <span className="mt-2 h-8 rotate-[-55deg] origin-top-left text-[9px] text-gran-muted whitespace-nowrap">
                {day.date.slice(5)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-gran-muted">
        Clique em um dia para ver quem usou. Barras em vermelho: ≥20% dos
        eventos fora do expediente ({WORKDAY_START_HOUR}h–{WORKDAY_END_HOUR}h).
      </p>
    </div>
  );
}

function HourlyChart({
  hourly,
  onSelect,
}: {
  hourly: TokenUsageHourPoint[];
  onSelect: (query: TokenUsageSlotQuery) => void;
}) {
  const maxEvents = Math.max(...hourly.map((h) => h.events), 1);
  const chartHeightPx = 148;

  return (
    <div>
      <div className="flex items-end gap-1">
        {hourly.map((point) => {
          const barHeight = Math.max(
            Math.round((point.events / maxEvents) * chartHeightPx),
            point.events > 0 ? 4 : 0,
          );
          return (
            <button
              key={point.hour}
              type="button"
              disabled={point.events <= 0}
              onClick={() => onSelect({ hour: point.hour })}
              className="flex flex-1 flex-col items-center disabled:cursor-default enabled:cursor-pointer enabled:hover:opacity-90"
              title={`${String(point.hour).padStart(2, "0")}h: ${point.events} eventos · clique para ver pessoas`}
            >
              <div
                className="flex w-full max-w-[28px] flex-col justify-end"
                style={{ height: chartHeightPx }}
              >
                <div
                  className={`w-full rounded-t ${
                    point.outside ? "bg-gran-red/70" : "bg-gran-navy"
                  }`}
                  style={{ height: barHeight }}
                />
              </div>
              <span
                className={`mt-1 text-[10px] ${
                  point.outside ? "font-semibold text-gran-red" : "text-gran-muted"
                }`}
              >
                {point.hour}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gran-muted">
        Clique em uma hora para ver quem usou. Fora de {WORKDAY_START_HOUR}h–
        {WORKDAY_END_HOUR - 1}h59 aparece em vermelho.
      </p>
    </div>
  );
}

function heatmapCellStyle(
  events: number,
  maxEvents: number,
): { background: string; color: string } {
  if (events <= 0) {
    return { background: "#f3f4f6", color: "#9ca3af" };
  }
  const ratio = events / maxEvents;
  if (ratio >= 0.72) return { background: "#ad1457", color: "#ffffff" };
  if (ratio >= 0.5) return { background: "#d81b60", color: "#ffffff" };
  if (ratio >= 0.32) return { background: "#ec407a", color: "#ffffff" };
  if (ratio >= 0.18) return { background: "#f48fb1", color: "#4a044e" };
  if (ratio >= 0.08) return { background: "#f8bbd0", color: "#831843" };
  return { background: "#fce4ec", color: "#9d174d" };
}

function WorkWindowHeatmap({
  cells,
  onSelect,
}: {
  cells: TokenUsageHeatCell[];
  onSelect: (query: TokenUsageSlotQuery) => void;
}) {
  const map = useMemo(() => {
    const nested = new Map<string, TokenUsageHeatCell>();
    for (const cell of cells) {
      nested.set(`${cell.weekday}-${cell.hour}`, cell);
    }
    return nested;
  }, [cells]);

  const maxEvents = Math.max(...cells.map((c) => c.events), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `40px repeat(24, minmax(0, 1fr))` }}
        >
          <div />
          {Array.from({ length: 24 }, (_, hour) => {
            const outside =
              hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR;
            return (
              <div
                key={`h-${hour}`}
                className={`pb-1 text-center text-[11px] font-medium ${
                  outside ? "text-gran-red" : "text-gran-muted"
                }`}
              >
                {hour}
              </div>
            );
          })}

          {WEEKDAY_ORDER.map((weekday) => (
            <div key={`row-${weekday}`} className="contents">
              <div className="flex items-center text-xs font-semibold text-gran-navy">
                {WEEKDAYS[weekday]}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = map.get(`${weekday}-${hour}`);
                const events = cell?.events ?? 0;
                const outside =
                  hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR;
                const style = heatmapCellStyle(events, maxEvents);
                return (
                  <button
                    key={`${weekday}-${hour}`}
                    type="button"
                    disabled={events <= 0}
                    onClick={() => onSelect({ weekday, hour })}
                    title={`${WEEKDAYS[weekday]} ${String(hour).padStart(2, "0")}h · ${events} eventos · clique para ver pessoas`}
                    className={`flex h-9 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition disabled:cursor-default enabled:cursor-pointer enabled:hover:brightness-95 enabled:hover:ring-2 enabled:hover:ring-gran-navy/30 ${
                      outside && events > 0 ? "ring-1 ring-inset ring-gran-red/35" : ""
                    }`}
                    style={style}
                  >
                    {events > 0 ? events : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gran-muted">
          <span>Clique em uma célula para ver quem gerou os eventos</span>
          <span>
            · horas em vermelho = fora de {WORKDAY_START_HOUR}h–
            {WORKDAY_END_HOUR}h
          </span>
        </div>
      </div>
    </div>
  );
}

function SlotPeopleModal({
  open,
  loading,
  error,
  data,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  data: TokenUsageSlotBreakdown | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-gran-navy/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-people-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Detalhe do período
            </p>
            <h3
              id="slot-people-title"
              className="mt-1 font-montserrat text-base font-bold text-gran-navy"
            >
              {data?.label ?? "Carregando…"}
            </h3>
            {data ? (
              <p className="mt-1 text-xs text-gran-muted">
                {data.events.toLocaleString("pt-BR")} eventos ·{" "}
                {formatTokens(data.totalTokens)} tokens · {data.people.length}{" "}
                pessoa{data.people.length === 1 ? "" : "s"}
                {data.outside ? " · fora do expediente" : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gran-muted hover:bg-gray-50 hover:text-gran-navy"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-gran-muted">Carregando pessoas…</p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {!loading && !error && data && data.people.length === 0 ? (
            <p className="text-sm text-gran-muted">
              Nenhuma pessoa neste período.
            </p>
          ) : null}
          {!loading && !error && data && data.people.length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {data.people.map((person, index) => (
                <li
                  key={person.email}
                  className="flex items-start justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gran-navy">
                      <span className="mr-2 text-gran-muted">{index + 1}.</span>
                      {person.name}
                    </p>
                    <p className="truncate text-xs text-gran-muted">
                      {person.email}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-gran-navy">
                      {person.events.toLocaleString("pt-BR")} evt
                    </p>
                    <p className="text-xs tabular-nums text-gran-muted">
                      {formatTokens(person.totalTokens)} tokens
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function shortUserLabel(name: string, email: string): string {
  const label = name?.trim() || email;
  return label.length > 28 ? `${label.slice(0, 26)}…` : label;
}

function OutlierBars({
  items,
  medianTokens,
  tone,
}: {
  items: TokenUsageOutlier[];
  medianTokens: number;
  tone: "high" | "low";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gran-muted">Nenhum outlier nesta faixa.</p>
    );
  }

  // Acima: escala até o maior outlier. Abaixo: escala = mediana (quanto % dela).
  const maxTokens =
    tone === "high"
      ? Math.max(...items.map((item) => item.totalTokens), medianTokens, 1)
      : Math.max(medianTokens, 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const widthPct = Math.min(
          Math.max((item.totalTokens / maxTokens) * 100, 1.5),
          100,
        );
        const medianPct =
          tone === "high"
            ? Math.max((medianTokens / maxTokens) * 100, 0)
            : 100;
        const vsMedian =
          medianTokens > 0
            ? Math.round((item.totalTokens / medianTokens) * 10) / 10
            : 0;
        const pctOfMedian =
          medianTokens > 0
            ? Math.round((item.totalTokens / medianTokens) * 1000) / 10
            : 0;

        return (
          <div key={item.email} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p
                className="truncate text-sm font-semibold text-gran-navy"
                title={`${item.name} · ${item.email}`}
              >
                {shortUserLabel(item.name, item.email)}
              </p>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                    tone === "high"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {tone === "high"
                    ? `${vsMedian}×`
                    : `${pctOfMedian}%`}
                </span>
                <span className="font-bold tabular-nums text-gran-navy">
                  {formatTokens(item.totalTokens)}
                </span>
              </div>
            </div>

            <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
              {medianTokens > 0 ? (
                <div
                  className="absolute inset-y-0 z-10 w-px bg-gran-navy/60"
                  style={{ left: `${Math.min(medianPct, 100)}%` }}
                  title={`Mediana ${formatTokens(medianTokens)}`}
                />
              ) : null}
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  tone === "high" ? "bg-gran-red" : "bg-amber-500"
                }`}
                style={{ width: `${widthPct}%` }}
              />
            </div>

            <p className="mt-1 text-[11px] text-gran-muted">
              {item.events.toLocaleString("pt-BR")} evt
              {item.outsidePct > 0 ? ` · ${item.outsidePct}% fora` : ""}
              {" · "}
              z {item.zScore > 0 ? "+" : ""}
              {item.zScore}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OutliersChart({
  high,
  low,
  medianTokens,
  meanTokens,
}: {
  high: TokenUsageOutlier[];
  low: TokenUsageOutlier[];
  medianTokens: number;
  meanTokens: number;
}) {
  const topHigh = high.slice(0, 8);
  const topLow = low.slice(0, 8);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <div className="rounded-md border border-gray-200 bg-gran-bg/60 px-3 py-2">
          <p className="font-bold uppercase tracking-wide text-gran-muted">
            Mediana do time
          </p>
          <p className="mt-0.5 font-montserrat text-sm font-bold text-gran-navy">
            {formatTokens(medianTokens)}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gran-bg/60 px-3 py-2">
          <p className="font-bold uppercase tracking-wide text-gran-muted">
            Média do time
          </p>
          <p className="mt-0.5 font-montserrat text-sm font-bold text-gran-navy">
            {formatTokens(meanTokens)}
          </p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="font-bold uppercase tracking-wide text-red-700">
            Acima
          </p>
          <p className="mt-0.5 font-montserrat text-sm font-bold text-red-700">
            {high.length}
          </p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="font-bold uppercase tracking-wide text-amber-800">
            Abaixo
          </p>
          <p className="mt-0.5 font-montserrat text-sm font-bold text-amber-800">
            {low.length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-red-100 bg-red-50/40 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700">
              Acima do normal
            </p>
            <p className="text-[11px] text-gran-muted">
              Linha = mediana · escala até o maior outlier
            </p>
          </div>
          <OutlierBars
            items={topHigh}
            medianTokens={medianTokens}
            tone="high"
          />
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Abaixo do normal
            </p>
            <p className="text-[11px] text-gran-muted">
              Comparado à mediana do time
            </p>
          </div>
          <OutlierBars
            items={topLow}
            medianTokens={medianTokens}
            tone="low"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-gran-muted">
        Detecção por IQR (Q3+1.5·IQR / Q1−1.5·IQR) e referência de mediana.
        Valores “× a mediana” mostram o quanto a pessoa foge do centro do time.
      </p>
    </div>
  );
}

export function MembersTokenUsagePage({
  variant = "members",
}: {
  variant?: "members" | "team";
} = {}) {
  const isTeam = variant === "team";
  const apiBase = isTeam
    ? "/api/estatisticas/team-token-usage"
    : "/api/estatisticas/members-token-usage";
  const pageTitle = isTeam ? "Team Token Usage" : "Members Token Usage";
  const pageIcon = isTeam ? "fa-people-group" : "fa-microchip";
  const emptyImportHint = isTeam
    ? "Importe o Members Token Usage em Configurações → Dados para visualizar esta estatística."
    : "Importe o Members Token Usage em Configurações → Dados para visualizar esta estatística.";

  const [upload, setUpload] = useState<DataUploadLog | null>(null);
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [byKind, setByKind] = useState<TokenUsageKindBreakdown[]>([]);
  const [byModel, setByModel] = useState<TokenUsageModelBreakdown[]>([]);
  const [users, setUsers] = useState<TokenUsageUserRow[]>([]);
  const [topUsers, setTopUsers] = useState<TokenUsageUserRow[]>([]);
  const [daily, setDaily] = useState<TokenUsageDailyPoint[]>([]);
  const [hourly, setHourly] = useState<TokenUsageHourPoint[]>([]);
  const [heatmap, setHeatmap] = useState<TokenUsageHeatCell[]>([]);
  const [outliersHigh, setOutliersHigh] = useState<TokenUsageOutlier[]>([]);
  const [outliersLow, setOutliersLow] = useState<TokenUsageOutlier[]>([]);
  const [outsideHeavyUsers, setOutsideHeavyUsers] = useState<TokenUsageUserRow[]>(
    [],
  );
  const [teamMeta, setTeamMeta] = useState<{
    organogramReports: number;
    emptyReason: "no_reports" | "no_usage" | null;
    restOfOrg: {
      users: number;
      meanTokensPerUser: number;
      medianTokensPerUser: number;
      meanOutsidePct: number;
      meanCostUsdPerUser: number;
    } | null;
    leaderName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tokens");
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotData, setSlotData] = useState<TokenUsageSlotBreakdown | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userData, setUserData] =
    useState<MembersTokenUsageUserDetail | null>(null);

  const openUserDetail = useCallback(async (email: string) => {
    setUserOpen(true);
    setUserLoading(true);
    setUserError(null);
    setUserData(null);
    try {
      const params = new URLSearchParams({ email });
      const response = await fetch(`${apiBase}/user?${params}`);
      const data = (await response.json()) as MembersTokenUsageUserDetail & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar detalhe");
      }
      setUserData(data);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUserLoading(false);
    }
  }, [apiBase]);

  const closeUserDetail = useCallback(() => {
    setUserOpen(false);
    setUserError(null);
  }, []);

  const openSlot = useCallback(async (filters: TokenUsageSlotQuery) => {
    setSlotOpen(true);
    setSlotLoading(true);
    setSlotError(null);
    setSlotData(null);
    try {
      const params = new URLSearchParams();
      if (filters.weekday !== undefined) {
        params.set("weekday", String(filters.weekday));
      }
      if (filters.hour !== undefined) {
        params.set("hour", String(filters.hour));
      }
      if (filters.date) params.set("date", filters.date);

      const response = await fetch(`${apiBase}/slot?${params}`);
      const data = (await response.json()) as TokenUsageSlotBreakdown & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar detalhe");
      }
      setSlotData(data);
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSlotLoading(false);
    }
  }, [apiBase]);

  const closeSlot = useCallback(() => {
    setSlotOpen(false);
    setSlotError(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiBase);
      const data = (await response.json()) as MembersTokenUsageData & {
        error?: string;
        organogramReports?: number;
        emptyReason?: "no_reports" | "no_usage" | null;
        restOfOrg?: {
          users: number;
          meanTokensPerUser: number;
          medianTokensPerUser: number;
          meanOutsidePct: number;
          meanCostUsdPerUser: number;
        } | null;
        leader?: { email: string; name: string };
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar estatísticas");
      }

      setUpload(data.upload);
      setSummary(data.summary);
      setByKind(data.byKind ?? []);
      setByModel(data.byModel ?? []);
      setUsers(data.users ?? []);
      setTopUsers(data.topUsers ?? []);
      setDaily(data.daily ?? []);
      setHourly(data.hourly ?? []);
      setHeatmap(data.heatmap ?? []);
      setOutliersHigh(data.outliersHigh ?? []);
      setOutliersLow(data.outliersLow ?? []);
      setOutsideHeavyUsers(data.outsideHeavyUsers ?? []);
      if (isTeam) {
        setTeamMeta({
          organogramReports: data.organogramReports ?? 0,
          emptyReason: data.emptyReason ?? null,
          restOfOrg: data.restOfOrg ?? null,
          leaderName: data.leader?.name ?? "",
        });
      } else {
        setTeamMeta(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [apiBase, isTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sortKey === "email") {
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      }
      if (sortKey === "events") return b.events - a.events;
      if (sortKey === "cost") return b.costUsd - a.costUsd;
      if (sortKey === "outside") return b.outsidePct - a.outsidePct;
      return b.totalTokens - a.totalTokens;
    });
  }, [users, query, sortKey]);

  const maxModelTokens = Math.max(...byModel.map((m) => m.totalTokens), 1);
  const periodLabel = summary ? buildPeriodLabel(summary) : null;

  const subtitle = isTeam
    ? upload
      ? `Liderados de ${teamMeta?.leaderName || "você"} · ${teamMeta?.organogramReports ?? 0} no organograma · ${summary?.users ?? 0} com usage · carga ${formatUploadDate(upload.uploadedAt)}`
      : "Consumo dos liderados (árvore completa) comparado ao restante da organização"
    : upload
      ? `Usage events · export ${upload.cycleDate ?? "—"} · última carga ${formatUploadDate(upload.uploadedAt)}`
      : "Usage events de tokens por membro (painel Cursor)";

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle={subtitle}
        icon={pageIcon}
        onRefresh={load}
        loading={loading}
        refreshLabel="Atualizar"
      />

      <main className="flex-1 px-6 py-6">
        {error ? (
          <section className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {!loading && isTeam && teamMeta?.emptyReason === "no_reports" ? (
          <section className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="font-montserrat text-lg font-bold text-gran-navy">
              Sem liderados no organograma
            </p>
            <p className="mt-2 text-sm text-gran-muted">
              Não encontramos pessoas abaixo de você na hierarquia. Confira o
              organograma ou peça ao admin para validar o vínculo de liderança.
            </p>
          </section>
        ) : null}

        {!loading && isTeam && teamMeta?.emptyReason === "no_usage" ? (
          <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Há {teamMeta.organogramReports} liderado(s) no organograma, mas
            nenhum com usage events no último upload.
          </section>
        ) : null}

        {!loading && !upload && !isTeam ? (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="font-montserrat text-lg font-bold text-gran-navy">
              Nenhum CSV carregado
            </p>
            <p className="mt-2 text-sm text-gran-muted">{emptyImportHint}</p>
          </section>
        ) : null}

        {summary && periodLabel ? (
          <>
            <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gran-navy">
              <p className="font-semibold">{periodLabel}</p>
              <p className="mt-1 text-xs">
                Expediente de referência: {WORKDAY_START_HOUR}h às{" "}
                {WORKDAY_END_HOUR}h (Brasília). Eventos fora dessa janela são
                tratados como tendência de risco.
                {isTeam
                  ? " Comparativos usam a média do restante da organização (fora do seu time)."
                  : ""}
              </p>
            </section>

            {isTeam && teamMeta?.restOfOrg ? (
              <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Média tokens (restante)"
                  value={formatTokens(teamMeta.restOfOrg.meanTokensPerUser)}
                  hint={`Mediana ${formatTokens(teamMeta.restOfOrg.medianTokensPerUser)} · ${teamMeta.restOfOrg.users} pessoas`}
                />
                <KpiCard
                  label="Média tokens (seu time)"
                  value={formatTokens(summary.meanTokensPerUser)}
                  hint={`Mediana ${formatTokens(summary.medianTokensPerUser)} · ${summary.users} pessoas`}
                />
                <KpiCard
                  label="% fora (restante)"
                  value={`${teamMeta.restOfOrg.meanOutsidePct}%`}
                  accent="amber"
                />
                <KpiCard
                  label="Cost médio (restante)"
                  value={formatUsd(teamMeta.restOfOrg.meanCostUsdPerUser)}
                  accent="red"
                />
              </section>
            ) : null}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Eventos"
                value={summary.events.toLocaleString("pt-BR")}
                hint={`${summary.users} ${isTeam ? "liderados" : "usuários"} · ${summary.periodDays} dias`}
              />
              <KpiCard
                label="Total Tokens"
                value={formatTokens(summary.totalTokens)}
                hint={`Mediana/usuário ${formatTokens(summary.medianTokensPerUser)}`}
              />
              <KpiCard
                label="On-Demand Cost"
                value={formatUsd(summary.costUsd)}
                accent="red"
              />
              <KpiCard
                label="Fora do expediente"
                value={`${summary.outsidePct}%`}
                hint={`${summary.outsideEvents.toLocaleString("pt-BR")} eventos · ${formatTokens(summary.outsideTokens)} tokens`}
                accent="amber"
              />
              <KpiCard
                label="Max Mode"
                value={summary.maxModeEvents.toLocaleString("pt-BR")}
                hint="Eventos com Max Mode = Yes"
              />
            </section>

            {(summary.outsidePct >= 5 ||
              outliersHigh.length > 0 ||
              outsideHeavyUsers.length > 0) && (
              <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Sinais de atenção</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {summary.outsidePct >= 5 ? (
                    <li>
                      {summary.outsidePct}% dos eventos e{" "}
                      {summary.outsideTokensPct}% dos tokens ocorreram fora de{" "}
                      {WORKDAY_START_HOUR}h–{WORKDAY_END_HOUR}h.
                    </li>
                  ) : null}
                  {outliersHigh.length > 0 ? (
                    <li>
                      {outliersHigh.length} usuário(s) muito acima da curva de
                      consumo (IQR).
                    </li>
                  ) : null}
                  {outliersLow.length > 0 ? (
                    <li>
                      {outliersLow.length} usuário(s) muito abaixo do uso
                      típico — possível subutilização de seat.
                    </li>
                  ) : null}
                  {outsideHeavyUsers.length > 0 ? (
                    <li>
                      {outsideHeavyUsers.length} usuário(s) com volume relevante
                      fora do expediente (≥10 eventos e ≥15%).
                    </li>
                  ) : null}
                </ul>
              </section>
            )}

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Section
                title="Top consumidores de tokens"
                subtitle="Maiores volumes no período (agregado por e-mail)"
              >
                <ol className="space-y-3">
                  {topUsers.map((user, index) => (
                    <li
                      key={user.email}
                      className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gran-navy">
                          <span className="mr-2 text-gran-muted">{index + 1}.</span>
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-gran-muted">
                          {user.email}
                        </p>
                        <p className="text-xs text-gran-muted">
                          {user.events.toLocaleString("pt-BR")} evt ·{" "}
                          {user.activeDays} dias ativos
                          {user.outsidePct >= 15
                            ? ` · ${user.outsidePct}% fora`
                            : ""}
                          {user.costUsd > 0 ? ` · ${formatUsd(user.costUsd)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-gran-navy">
                        {formatTokens(user.totalTokens)}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section
                title="Fora do expediente — maiores volumes"
                subtitle={`Usuários com uso relevante antes das ${WORKDAY_START_HOUR}h ou a partir das ${WORKDAY_END_HOUR}h`}
              >
                {outsideHeavyUsers.length === 0 ? (
                  <p className="text-sm text-gran-muted">
                    Nenhum usuário com padrão forte fora do expediente.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {outsideHeavyUsers.map((user, index) => (
                      <li
                        key={user.email}
                        className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gran-navy">
                            <span className="mr-2 text-gran-muted">
                              {index + 1}.
                            </span>
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-gran-muted">
                            {user.email}
                          </p>
                          <p className="text-xs text-gran-muted">
                            {user.outsideEvents.toLocaleString("pt-BR")} eventos
                            fora · {user.outsidePct}% do total
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-gran-red">
                          {user.outsidePct}%
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>

            <Section
              title="Saiu da curva"
              subtitle="Outliers de tokens vs mediana do time (método IQR) — barras com linha de referência"
            >
              <OutliersChart
                high={outliersHigh}
                low={outliersLow}
                medianTokens={summary.medianTokensPerUser}
                meanTokens={summary.meanTokensPerUser}
              />
            </Section>

            <Section
              title="Volume diário ao longo do período"
              subtitle="Total de tokens por dia (Brasília) · clique no dia para ver pessoas"
            >
              {daily.length > 0 ? (
                <DailyChart daily={daily} onSelect={openSlot} />
              ) : null}
            </Section>

            <Section
              title="Janela de trabalho diária"
              subtitle="Mapa de calor de eventos por dia da semana × hora (Brasília). Clique na célula para ver quem usou naquele horário."
            >
              {heatmap.length > 0 ? (
                <WorkWindowHeatmap cells={heatmap} onSelect={openSlot} />
              ) : null}
            </Section>

            <Section
              title="Distribuição por hora"
              subtitle="Volume de eventos por hora do dia (Brasília) · clique na hora para ver pessoas"
            >
              {hourly.length > 0 ? (
                <HourlyChart hourly={hourly} onSelect={openSlot} />
              ) : null}
            </Section>

            <Section
              title="Modelos utilizados"
              subtitle="Participação no total de tokens do período"
            >
              <div className="space-y-2">
                {byModel.slice(0, 15).map((model) => (
                  <div key={model.model}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-gran-navy">
                        {model.model}
                      </span>
                      <span className="text-gran-muted">
                        {formatTokens(model.totalTokens)} · {model.sharePct}% ·{" "}
                        {model.events.toLocaleString("pt-BR")} evt ·{" "}
                        {model.users} users
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gran-blue"
                        style={{
                          width: `${Math.max(
                            (model.totalTokens / maxModelTokens) * 100,
                            1,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {byKind.length > 0 ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {byKind.map((kind) => (
                    <div
                      key={kind.kind}
                      className="rounded-md border border-gray-100 bg-gran-bg/50 px-3 py-2"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
                        {kind.kind}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gran-navy">
                        {formatTokens(kind.totalTokens)}
                      </p>
                      <p className="text-xs text-gran-muted">
                        {kind.events.toLocaleString("pt-BR")} eventos
                        {kind.costUsd > 0 ? ` · ${formatUsd(kind.costUsd)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Section>

            <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 max-w-md flex-1">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
                  Buscar usuário
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome ou e-mail"
                  className="select-field w-full"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gran-muted">
                <span className="font-semibold uppercase tracking-wide">
                  Ordenar
                </span>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="select-field py-1.5 text-xs"
                >
                  <option value="tokens">Tokens</option>
                  <option value="events">Eventos</option>
                  <option value="cost">Custo OD</option>
                  <option value="outside">% fora expediente</option>
                  <option value="email">Nome</option>
                </select>
              </label>
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gran-navy">
                  Uso agregado por membro
                </p>
                <p className="text-xs text-gran-muted">
                  Exibindo {rows.length} de {users.length}
                </p>
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm text-gran-muted">
                  Carregando…
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gran-muted">
                  Nenhum usuário encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-gray-100 bg-gran-bg/60 text-xs font-bold uppercase tracking-wide text-gran-muted">
                      <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">E-mail</th>
                        <th className="px-4 py-3 text-right">Eventos</th>
                        <th className="px-4 py-3 text-right">Tokens</th>
                        <th className="px-4 py-3 text-right">Cost OD</th>
                        <th className="px-4 py-3 text-right">Dias</th>
                        <th className="px-4 py-3 text-right">Fora exp.</th>
                        <th className="px-4 py-3 text-right">% fora</th>
                        <th className="px-4 py-3 text-right">On-Demand</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.email} className="hover:bg-gran-bg/40">
                          <td className="px-4 py-3 font-semibold text-gran-navy">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-gran-muted">{row.email}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-muted">
                            {row.events.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-navy">
                            {formatTokens(row.totalTokens)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-semibold ${
                              row.costUsd > 0 ? "text-gran-red" : "text-gran-muted"
                            }`}
                          >
                            {formatUsd(row.costUsd)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-muted">
                            {row.activeDays}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-muted">
                            {row.outsideEvents.toLocaleString("pt-BR")}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-semibold ${
                              row.outsidePct >= 15
                                ? "text-gran-red"
                                : "text-gran-muted"
                            }`}
                          >
                            {row.outsidePct}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gran-muted">
                            {row.onDemandEvents.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void openUserDetail(row.email)}
                              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gran-navy transition hover:border-gran-blue hover:text-gran-blue"
                            >
                              Detalhe
                            </button>
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

      <SlotPeopleModal
        open={slotOpen}
        loading={slotLoading}
        error={slotError}
        data={slotData}
        onClose={closeSlot}
      />

      <MembersTokenUsageUserModal
        open={userOpen}
        loading={userLoading}
        error={userError}
        data={userData}
        onClose={closeUserDetail}
        benchmarkLabel={isTeam ? "Média restante da org" : undefined}
        compareTitle={
          isTeam
            ? "Comparativo com a média do restante da organização"
            : undefined
        }
        dailyAvgLabel={
          isTeam
            ? "média do restante da org no dia"
            : undefined
        }
        rankingLabel={isTeam ? "no time" : undefined}
      />
    </>
  );
}
