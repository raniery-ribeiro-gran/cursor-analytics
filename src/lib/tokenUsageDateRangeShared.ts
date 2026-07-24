export interface TokenUsageDateRangeInput {
  from?: string;
  to?: string;
}

export interface TokenUsageDateRangeMeta {
  from: string | null;
  to: string | null;
  minDate: string | null;
  maxDate: string | null;
  isDefault: boolean;
}

export class TokenUsageDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenUsageDateRangeError";
  }
}

export function isValidTokenUsageDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

export function subtractDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  return subtractDays(value, -days);
}

/** Quantidade de dias exibidos no mapa de calor diário. */
export const HEATMAP_DAY_COUNT = 15;

export function heatmapDateWindow(meta: TokenUsageDateRangeMeta): {
  from: string | null;
  to: string | null;
} {
  if (!meta.from || !meta.to) return { from: null, to: null };
  const windowFrom = subtractDays(meta.to, HEATMAP_DAY_COUNT - 1);
  return {
    from: windowFrom > meta.from ? windowFrom : meta.from,
    to: meta.to,
  };
}

export function listDatesInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function weekdayFromIsoDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day)).getUTCDay();
}

export function formatHeatmapDayLabel(date: string, weekday?: number): string {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
  const dow =
    weekday !== undefined && weekday >= 0 && weekday <= 6
      ? weekday
      : weekdayFromIsoDate(date);
  const [, month, day] = date.split("-");
  return `${weekdays[dow]} ${day}/${month}`;
}

export function parseTokenUsageDateRange(
  searchParams: URLSearchParams,
): TokenUsageDateRangeInput {
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  if ((from && !to) || (!from && to)) {
    throw new TokenUsageDateRangeError("Informe as datas De e Até");
  }
  if (from && !isValidTokenUsageDate(from)) {
    throw new TokenUsageDateRangeError("Data De inválida");
  }
  if (to && !isValidTokenUsageDate(to)) {
    throw new TokenUsageDateRangeError("Data Até inválida");
  }
  if (from && to && from > to) {
    throw new TokenUsageDateRangeError(
      "A data De deve ser anterior ou igual à data Até",
    );
  }
  return { from, to };
}
