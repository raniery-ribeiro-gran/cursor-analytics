import { query } from "./sqlite";
import {
  isValidTokenUsageDate,
  subtractDays,
  TokenUsageDateRangeError,
  type TokenUsageDateRangeInput,
  type TokenUsageDateRangeMeta,
} from "./tokenUsageDateRangeShared";

export {
  HEATMAP_DAY_COUNT,
  TokenUsageDateRangeError,
  formatHeatmapDayLabel,
  heatmapDateWindow,
  listDatesInclusive,
  parseTokenUsageDateRange,
  weekdayFromIsoDate,
  type TokenUsageDateRangeInput,
  type TokenUsageDateRangeMeta,
} from "./tokenUsageDateRangeShared";

const EVENT_BRT = `datetime(replace(substr(event_at, 1, 19), 'T', ' '), '-3 hours')`;
export const EVENT_BRT_DATE = `date(${EVENT_BRT})`;

export async function resolveTokenUsageDateRange(
  uploadId: number,
  input: TokenUsageDateRangeInput = {},
): Promise<TokenUsageDateRangeMeta> {
  if ((input.from && !input.to) || (!input.from && input.to)) {
    throw new TokenUsageDateRangeError("Informe as datas De e Até");
  }
  if (input.from && !isValidTokenUsageDate(input.from)) {
    throw new TokenUsageDateRangeError("Data De inválida");
  }
  if (input.to && !isValidTokenUsageDate(input.to)) {
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
  const from =
    input.from ?? (minDate && minDate > defaultFrom ? minDate : defaultFrom);
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
