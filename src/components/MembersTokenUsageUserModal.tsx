"use client";

import { useEffect, useMemo } from "react";
import {
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
} from "@/lib/membersTokenUsageConstants";
import type { MembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

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

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 10) return `${Math.round(value)}×`;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`;
}

function CompareCard({
  label,
  userValue,
  avgValue,
  ratioValue,
  format = "number",
  accent,
  avgLabel = "Média time",
}: {
  label: string;
  userValue: number;
  avgValue: number;
  ratioValue: number;
  format?: "number" | "tokens" | "usd" | "pct";
  accent?: "red" | "amber" | "navy";
  avgLabel?: string;
}) {
  const display = (value: number) => {
    if (format === "tokens") return formatTokens(value);
    if (format === "usd") return formatUsd(value);
    if (format === "pct") return `${value}%`;
    return value.toLocaleString("pt-BR");
  };

  const above = ratioValue > 1.15;
  const below = ratioValue < 0.85;
  const valueClass =
    accent === "red" || (above && format !== "pct" && label.includes("Fora"))
      ? "text-gran-red"
      : accent === "amber"
        ? "text-amber-700"
        : "text-gran-navy";

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gran-muted">
        {label}
      </p>
      <p className={`mt-1 font-montserrat text-xl font-bold ${valueClass}`}>
        {display(userValue)}
      </p>
      <p className="mt-1 text-xs text-gran-muted">
        {avgLabel}: {display(avgValue)}
      </p>
      <p
        className={`mt-1 text-xs font-semibold ${
          above ? "text-gran-red" : below ? "text-amber-700" : "text-gran-navy"
        }`}
      >
        {formatRatio(ratioValue)} a média
      </p>
    </div>
  );
}

function heatmapCellStyle(
  events: number,
  maxEvents: number,
): { background: string; color: string } {
  if (events <= 0) return { background: "#f3f4f6", color: "#9ca3af" };
  const ratio = events / maxEvents;
  if (ratio >= 0.72) return { background: "#ad1457", color: "#ffffff" };
  if (ratio >= 0.5) return { background: "#d81b60", color: "#ffffff" };
  if (ratio >= 0.32) return { background: "#ec407a", color: "#ffffff" };
  if (ratio >= 0.18) return { background: "#f48fb1", color: "#4a044e" };
  if (ratio >= 0.08) return { background: "#f8bbd0", color: "#831843" };
  return { background: "#fce4ec", color: "#9d174d" };
}

export function TokenUsageUserDetailView({
  data,
  benchmarkLabel = "Média time",
  compareTitle = "Comparativo com a média do time",
  dailyAvgLabel = "média por usuário ativo no dia",
}: {
  data: MembersTokenUsageUserDetail;
  benchmarkLabel?: string;
  compareTitle?: string;
  dailyAvgLabel?: string;
}) {
  const heatMap = useMemo(() => {
    const nested = new Map<string, { events: number; totalTokens: number }>();
    for (const cell of data.heatmap) {
      nested.set(`${cell.weekday}-${cell.hour}`, {
        events: cell.events,
        totalTokens: cell.totalTokens,
      });
    }
    return nested;
  }, [data.heatmap]);

  const maxHeatEvents = Math.max(
    ...data.heatmap.map((cell) => cell.events),
    1,
  );

  const dailyMax = Math.max(
    ...data.daily.flatMap((day) => [
      day.totalTokens,
      day.teamAvgTokensPerUser,
    ]),
    1,
  );

  const hourlyMax = Math.max(...data.hourly.map((h) => h.events), 1);
  const modelMax = Math.max(...data.byModel.map((m) => m.totalTokens), 1);

  return (
    <div className="space-y-5">
      {data.outlierReason ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            data.outlierSide === "high"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <strong>Saiu da curva:</strong> {data.outlierReason}
        </div>
      ) : null}

      <section>
        <h4 className="mb-3 font-montserrat text-sm font-bold text-gran-navy">
          {compareTitle}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CompareCard
            label="Tokens"
            userValue={data.user.totalTokens}
            avgValue={data.teamAvg.totalTokens}
            ratioValue={data.ratios.totalTokens}
            format="tokens"
            avgLabel={benchmarkLabel}
          />
          <CompareCard
            label="Eventos"
            userValue={data.user.events}
            avgValue={data.teamAvg.events}
            ratioValue={data.ratios.events}
            avgLabel={benchmarkLabel}
          />
          <CompareCard
            label="Cost On-Demand"
            userValue={data.user.costUsd}
            avgValue={data.teamAvg.costUsd}
            ratioValue={data.ratios.costUsd}
            format="usd"
            accent="red"
            avgLabel={benchmarkLabel}
          />
          <CompareCard
            label="% fora do expediente"
            userValue={data.user.outsidePct}
            avgValue={data.teamAvg.outsidePct}
            ratioValue={data.ratios.outsidePct}
            format="pct"
            accent="amber"
            avgLabel={benchmarkLabel}
          />
          <CompareCard
            label="Dias ativos"
            userValue={data.user.activeDays}
            avgValue={data.teamAvg.activeDays}
            ratioValue={data.ratios.activeDays}
            avgLabel={benchmarkLabel}
          />
          <CompareCard
            label="Max Mode"
            userValue={data.user.maxModeEvents}
            avgValue={data.teamAvg.maxModeEvents}
            ratioValue={data.ratios.maxModeEvents}
            avgLabel={benchmarkLabel}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gran-muted">
            Included:{" "}
            <strong className="text-gran-navy">
              {data.user.includedEvents.toLocaleString("pt-BR")}
            </strong>{" "}
            (média {data.teamAvg.includedEvents.toLocaleString("pt-BR")})
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gran-muted">
            Free:{" "}
            <strong className="text-gran-navy">
              {data.user.freeEvents.toLocaleString("pt-BR")}
            </strong>{" "}
            (média {data.teamAvg.freeEvents.toLocaleString("pt-BR")})
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gran-muted">
            On-Demand:{" "}
            <strong className="text-gran-navy">
              {data.user.onDemandEvents.toLocaleString("pt-BR")}
            </strong>{" "}
            (média {data.teamAvg.onDemandEvents.toLocaleString("pt-BR")})
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <h4 className="font-montserrat text-sm font-bold text-gran-navy">
          Volume diário vs média do dia
        </h4>
        <p className="mt-1 text-xs text-gran-muted">
          Azul = você · cinza = {dailyAvgLabel}
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-[640px] items-end gap-1">
            {data.daily.map((day) => {
              const userH = Math.max(
                Math.round((day.totalTokens / dailyMax) * 120),
                day.totalTokens > 0 ? 3 : 0,
              );
              const avgH = Math.max(
                Math.round((day.teamAvgTokensPerUser / dailyMax) * 120),
                day.teamAvgTokensPerUser > 0 ? 2 : 0,
              );
              return (
                <div
                  key={day.date}
                  className="flex flex-1 flex-col items-center"
                  title={`${day.date}: você ${formatTokens(day.totalTokens)} · média ${formatTokens(day.teamAvgTokensPerUser)}`}
                >
                  <div className="relative w-full" style={{ height: 120 }}>
                    <div
                      className="absolute bottom-0 left-1/2 w-[45%] -translate-x-[110%] rounded-t bg-gran-blue"
                      style={{ height: userH }}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 w-[45%] translate-x-[10%] rounded-t bg-gray-300"
                      style={{ height: avgH }}
                    />
                  </div>
                  <span className="mt-1 text-[9px] text-gran-muted">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <h4 className="font-montserrat text-sm font-bold text-gran-navy">
            Distribuição por hora
          </h4>
          <p className="mt-1 text-xs text-gran-muted">
            Seus eventos (vermelho = fora de {WORKDAY_START_HOUR}h–
            {WORKDAY_END_HOUR}h)
          </p>
          <div className="mt-4 flex items-end gap-1">
            {data.hourly.map((point) => {
              const h = Math.max(
                Math.round((point.events / hourlyMax) * 110),
                point.events > 0 ? 3 : 0,
              );
              return (
                <div
                  key={point.hour}
                  className="flex flex-1 flex-col items-center"
                  title={`${point.hour}h: ${point.events} evt`}
                >
                  <div
                    className="flex w-full flex-col justify-end"
                    style={{ height: 110 }}
                  >
                    <div
                      className={`w-full rounded-t ${
                        point.outside ? "bg-gran-red/80" : "bg-gran-navy"
                      }`}
                      style={{ height: h }}
                    />
                  </div>
                  <span
                    className={`mt-1 text-[9px] ${
                      point.outside ? "text-gran-red" : "text-gran-muted"
                    }`}
                  >
                    {point.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <h4 className="font-montserrat text-sm font-bold text-gran-navy">
            Modelos utilizados
          </h4>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {data.byModel.slice(0, 12).map((model) => (
              <div key={model.model}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-gran-navy">
                    {model.model}
                  </span>
                  <span className="shrink-0 text-gran-muted">
                    {formatTokens(model.totalTokens)} · {model.sharePct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gran-blue"
                    style={{
                      width: `${Math.max(
                        (model.totalTokens / modelMax) * 100,
                        2,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.byKind.map((kind) => (
              <div
                key={kind.kind}
                className="rounded-md border border-gray-100 bg-gran-bg/50 px-2 py-2"
              >
                <p className="text-[10px] font-bold uppercase text-gran-muted">
                  {kind.kind}
                </p>
                <p className="text-xs font-semibold text-gran-navy">
                  {formatTokens(kind.totalTokens)}
                </p>
                <p className="text-[11px] text-gran-muted">
                  {kind.events.toLocaleString("pt-BR")} evt
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <h4 className="font-montserrat text-sm font-bold text-gran-navy">
          Janela de trabalho (mapa de calor)
        </h4>
        <p className="mt-1 text-xs text-gran-muted">
          Seus eventos por dia da semana × hora (Brasília)
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[820px]">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `36px repeat(24, minmax(0, 1fr))`,
              }}
            >
              <div />
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className={`text-center text-[10px] ${
                    hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR
                      ? "font-semibold text-gran-red"
                      : "text-gran-muted"
                  }`}
                >
                  {hour}
                </div>
              ))}
              {WEEKDAY_ORDER.map((weekday) => (
                <div key={weekday} className="contents">
                  <div className="flex items-center text-xs font-semibold text-gran-navy">
                    {WEEKDAYS[weekday]}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = heatMap.get(`${weekday}-${hour}`);
                    const events = cell?.events ?? 0;
                    const style = heatmapCellStyle(events, maxHeatEvents);
                    return (
                      <div
                        key={`${weekday}-${hour}`}
                        title={`${WEEKDAYS[weekday]} ${hour}h · ${events} evt · ${formatTokens(cell?.totalTokens ?? 0)}`}
                        className="flex h-8 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums"
                        style={style}
                      >
                        {events > 0 ? events : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function MembersTokenUsageUserModal({
  open,
  loading,
  error,
  data,
  onClose,
  benchmarkLabel,
  compareTitle,
  dailyAvgLabel,
  rankingLabel,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  data: MembersTokenUsageUserDetail | null;
  onClose: () => void;
  benchmarkLabel?: string;
  compareTitle?: string;
  dailyAvgLabel?: string;
  rankingLabel?: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-gran-navy/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-gran-bg shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Detalhe do membro
            </p>
            <h3
              id="user-detail-title"
              className="mt-1 font-montserrat text-lg font-bold text-gran-navy"
            >
              {data?.name ?? "Carregando…"}
            </h3>
            {data ? (
              <p className="mt-1 text-sm text-gran-muted">
                {data.email} · ranking #{data.rankByTokens}/{data.totalUsers}
                {rankingLabel ? ` ${rankingLabel}` : " em tokens"} · percentil{" "}
                {data.percentileByTokens} · z={data.zScore}
                {data.outlierSide
                  ? ` · outlier ${data.outlierSide === "high" ? "acima" : "abaixo"}`
                  : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-sm text-gran-muted">Carregando detalhe…</p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {data ? (
            <TokenUsageUserDetailView
              data={data}
              benchmarkLabel={benchmarkLabel}
              compareTitle={compareTitle}
              dailyAvgLabel={dailyAvgLabel}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
