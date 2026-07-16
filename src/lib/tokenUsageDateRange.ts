import { query } from "./sqlite";

const EVENT_BRT = `datetime(replace(substr(event_at, 1, 19), 'T', ' '), '-3 hours')`;
export const EVENT_BRT_DATE = `date(${EVENT_BRT})`;

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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

function subtractDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function parseTokenUsageDateRange(
  searchParams: URLSearchParams,
): TokenUsageDateRangeInput {
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  if ((from && !to) || (!from && to)) {
    throw new TokenUsageDateRangeError("Informe as datas De e Até");
  }
  if (from && !isValidDate(from)) {
    throw new TokenUsageDateRangeError("Data De inválida");
  }
  if (to && !isValidDate(to)) {
    throw new TokenUsageDateRangeError("Data Até inválida");
  }
  if (from && to && from > to) {
    throw new TokenUsageDateRangeError(
      "A data De deve ser anterior ou igual à data Até",
    );
  }
  return { from, to };
}

export async function resolveTokenUsageDateRange(
  uploadId: number,
  input: TokenUsageDateRangeInput = {},
): Promise<TokenUsageDateRangeMeta> {
  if ((input.from && !input.to) || (!input.from && input.to)) {
    throw new TokenUsageDateRangeError("Informe as datas De e Até");
  }
  if (input.from && !isValidDate(input.from)) {
    throw new TokenUsageDateRangeError("Data De inválida");
  }
  if (input.to && !isValidDate(input.to)) {
    throw new TokenUsageDateRangeError("Data Até inválida");
  }
  if (input.from && input.to && input.from > input.to) {
    throw new TokenUsageDateRangeError(
      "A data De deve ser anterior ou igual à data Até",
    );
  }

  const result = await query(
    `SELECT MIN(${EVENT_BRT_DATE}) AS min_date, MAX(${EVENT_BRT_DATE}) AS max_date
     FROM cursor_token_usage_events
     WHERE upload_id = $1`,
    [uploadId],
  );
  const row = (result.rows[0] ?? {}) as Record<string, unknown>;
  const minDate = (row.min_date as string | null) ?? null;
  const maxDate = (row.max_date as string | null) ?? null;
  const isDefault = !input.from && !input.to;

  if (!maxDate) {
    return { from: null, to: null, minDate, maxDate, isDefault };
  }

  const to = input.to ?? maxDate;
  const defaultFrom = subtractDays(maxDate, 29);
  const from = input.from ?? (minDate && minDate > defaultFrom ? minDate : defaultFrom);
  return { from, to, minDate, maxDate, isDefault };
}

export function tokenUsageRangeParams(
  meta: TokenUsageDateRangeMeta,
  startIndex = 2,
): {
  sql: string;
  params: string[];
} {
  if (!meta.from || !meta.to) return { sql: "1 = 0", params: [] };
  return {
    sql: `${EVENT_BRT_DATE} BETWEEN $${startIndex} AND $${startIndex + 1}`,
    params: [meta.from, meta.to],
  };
}
