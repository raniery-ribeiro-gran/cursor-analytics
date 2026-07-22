import { ensureSchema, query } from "./sqlite";
import {
  getLatestUploadByDataset,
  type DataUploadLog,
} from "./dataUploadsDb";
import {
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
} from "./membersTokenUsageConstants";
import {
  resolveTokenUsageDateRange,
  tokenUsageRangeParams,
  type TokenUsageDateRangeInput,
  type TokenUsageDateRangeMeta,
} from "./tokenUsageDateRange";

export { WORKDAY_END_HOUR, WORKDAY_START_HOUR } from "./membersTokenUsageConstants";

/** Expressão SQLite: instante do evento em Brasília (UTC−3). */
const EVENT_BRT = `datetime(replace(substr(event_at, 1, 19), 'T', ' '), '-3 hours')`;
const EVENT_BRT_DATE = `date(${EVENT_BRT})`;
const EVENT_BRT_HOUR = `CAST(strftime('%H', ${EVENT_BRT}) AS INTEGER)`;
const EVENT_BRT_DOW = `CAST(strftime('%w', ${EVENT_BRT}) AS INTEGER)`;
const IS_OUTSIDE_HOURS = `(${EVENT_BRT_HOUR} < ${WORKDAY_START_HOUR} OR ${EVENT_BRT_HOUR} >= ${WORKDAY_END_HOUR})`;

export interface TokenUsageKindBreakdown {
  kind: string;
  events: number;
  totalTokens: number;
  costUsd: number;
}

export interface TokenUsageModelBreakdown {
  model: string;
  events: number;
  totalTokens: number;
  users: number;
  sharePct: number;
}

export interface TokenUsageUserRow {
  email: string;
  name: string;
  tribe: string | null;
  leaderName: string | null;
  events: number;
  totalTokens: number;
  outputTokens: number;
  costUsd: number;
  includedEvents: number;
  freeEvents: number;
  onDemandEvents: number;
  maxModeEvents: number;
  outsideEvents: number;
  outsidePct: number;
  activeDays: number;
}

export interface TokenUsageDailyPoint {
  date: string;
  events: number;
  totalTokens: number;
  outsideEvents: number;
  outsidePct: number;
  uniqueUsers: number;
}

export interface TokenUsageHourPoint {
  hour: number;
  events: number;
  totalTokens: number;
  outside: boolean;
}

export interface TokenUsageHeatCell {
  weekday: number;
  hour: number;
  events: number;
  totalTokens: number;
}

export interface TokenUsageWorkdayWindow {
  date: string;
  firstHour: number;
  lastHour: number;
  spanHours: number;
  events: number;
  outsideEvents: number;
}

export interface TokenUsageOutlier {
  email: string;
  name: string;
  tribe: string | null;
  leaderName: string | null;
  totalTokens: number;
  events: number;
  outsidePct: number;
  zScore: number;
  reason: string;
}

export interface TokenUsageSummary {
  events: number;
  users: number;
  totalTokens: number;
  outputTokens: number;
  costUsd: number;
  maxModeEvents: number;
  periodStartUtc: string | null;
  periodEndUtc: string | null;
  periodStartBrt: string | null;
  periodEndBrt: string | null;
  periodDays: number;
  outsideEvents: number;
  outsidePct: number;
  outsideTokens: number;
  outsideTokensPct: number;
  medianTokensPerUser: number;
  meanTokensPerUser: number;
}

export interface MembersTokenUsageData {
  upload: DataUploadLog | null;
  dateRange: TokenUsageDateRangeMeta;
  summary: TokenUsageSummary | null;
  byKind: TokenUsageKindBreakdown[];
  byModel: TokenUsageModelBreakdown[];
  users: TokenUsageUserRow[];
  topUsers: TokenUsageUserRow[];
  daily: TokenUsageDailyPoint[];
  hourly: TokenUsageHourPoint[];
  heatmap: TokenUsageHeatCell[];
  workWindows: TokenUsageWorkdayWindow[];
  outliersHigh: TokenUsageOutlier[];
  outliersLow: TokenUsageOutlier[];
  outsideHeavyUsers: TokenUsageUserRow[];
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function tokens(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base]!;
  return sorted[base]! + rest * (next - sorted[base]!);
}

function emptyPayload(): MembersTokenUsageData {
  return {
    upload: null,
    dateRange: {
      from: null,
      to: null,
      minDate: null,
      maxDate: null,
      isDefault: true,
    },
    summary: null,
    byKind: [],
    byModel: [],
    users: [],
    topUsers: [],
    daily: [],
    hourly: [],
    heatmap: [],
    workWindows: [],
    outliersHigh: [],
    outliersLow: [],
    outsideHeavyUsers: [],
  };
}

export async function getMembersTokenUsageData(
  dateRangeInput: TokenUsageDateRangeInput = {},
): Promise<MembersTokenUsageData> {
  await ensureSchema();

  const upload = await getLatestUploadByDataset("members_token_usage");
  if (!upload) return emptyPayload();
  const dateRange = await resolveTokenUsageDateRange(upload.id, dateRangeInput);
  const range = tokenUsageRangeParams(dateRange);
  const rangeQueryParams = [upload.id, ...range.params];

  const aggResult = await query(
    `
    SELECT
      COUNT(*) AS events,
      COUNT(DISTINCT user_email) AS users,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd,
      COALESCE(SUM(CASE WHEN max_mode = 1 THEN 1 ELSE 0 END), 0) AS max_mode_events,
      MIN(event_at) AS period_start_utc,
      MAX(event_at) AS period_end_utc,
      MIN(${EVENT_BRT}) AS period_start_brt,
      MAX(${EVENT_BRT}) AS period_end_brt,
      COUNT(DISTINCT ${EVENT_BRT_DATE}) AS period_days,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN total_tokens ELSE 0 END), 0) AS outside_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
  `,
    rangeQueryParams,
  );
  const agg = (aggResult.rows[0] ?? {}) as Record<string, unknown>;
  const events = Number(agg.events ?? 0);
  const totalTokens = tokens(agg.total_tokens);
  const outsideEvents = Number(agg.outside_events ?? 0);
  const outsideTokens = tokens(agg.outside_tokens);

  const kindResult = await query(
    `
    SELECT
      kind,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY kind
    ORDER BY total_tokens DESC, events DESC
  `,
    rangeQueryParams,
  );
  const byKind: TokenUsageKindBreakdown[] = (
    kindResult.rows as Record<string, unknown>[]
  ).map((row) => ({
    kind: String(row.kind || "—"),
    events: Number(row.events ?? 0),
    totalTokens: tokens(row.total_tokens),
    costUsd: money(row.cost_usd),
  }));

  const modelResult = await query(
    `
    SELECT
      model,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COUNT(DISTINCT user_email) AS users
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY model
    ORDER BY total_tokens DESC, events DESC
  `,
    rangeQueryParams,
  );
  const byModel: TokenUsageModelBreakdown[] = (
    modelResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const modelTokens = tokens(row.total_tokens);
    return {
      model: String(row.model || "—"),
      events: Number(row.events ?? 0),
      totalTokens: modelTokens,
      users: Number(row.users ?? 0),
      sharePct: pct(modelTokens, totalTokens),
    };
  });

  const usersResult = await query(
    `
    SELECT
      user_email,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd,
      COALESCE(SUM(CASE WHEN kind = 'Included' THEN 1 ELSE 0 END), 0) AS included_events,
      COALESCE(SUM(CASE WHEN kind = 'Free' THEN 1 ELSE 0 END), 0) AS free_events,
      COALESCE(SUM(CASE WHEN kind = 'On-Demand' THEN 1 ELSE 0 END), 0) AS on_demand_events,
      COALESCE(SUM(CASE WHEN max_mode = 1 THEN 1 ELSE 0 END), 0) AS max_mode_events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COUNT(DISTINCT ${EVENT_BRT_DATE}) AS active_days
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY user_email
    ORDER BY total_tokens DESC, events DESC, user_email ASC
  `,
    rangeQueryParams,
  );

  const { getOrganogramIndex } = await import("./organogramDb");
  const organogram = await getOrganogramIndex();

  const users: TokenUsageUserRow[] = (
    usersResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const userEvents = Number(row.events ?? 0);
    const userOutside = Number(row.outside_events ?? 0);
    const email = String(row.user_email ?? "").toLowerCase();
    const person = organogram.findByEmail(email);
    return {
      email,
      name: displayNameFromEmail(email, person?.name ?? null),
      tribe: (person?.tribe || person?.department || "").trim() || null,
      leaderName: person?.managerName?.trim() || null,
      events: userEvents,
      totalTokens: tokens(row.total_tokens),
      outputTokens: tokens(row.output_tokens),
      costUsd: money(row.cost_usd),
      includedEvents: Number(row.included_events ?? 0),
      freeEvents: Number(row.free_events ?? 0),
      onDemandEvents: Number(row.on_demand_events ?? 0),
      maxModeEvents: Number(row.max_mode_events ?? 0),
      outsideEvents: userOutside,
      outsidePct: pct(userOutside, userEvents),
      activeDays: Number(row.active_days ?? 0),
    };
  });

  const tokenValues = users.map((user) => user.totalTokens);
  const meanTokens =
    tokenValues.length > 0
      ? tokenValues.reduce((sum, value) => sum + value, 0) / tokenValues.length
      : 0;
  const medianTokens = median(tokenValues);
  const deviation = stdDev(tokenValues, meanTokens);
  const sortedTokens = [...tokenValues].sort((a, b) => a - b);
  const q1 = quantile(sortedTokens, 0.25);
  const q3 = quantile(sortedTokens, 0.75);
  const iqr = Math.max(q3 - q1, 0);
  const highFence = q3 + 1.5 * iqr;
  const lowFence = Math.max(q1 - 1.5 * iqr, 0);

  const outliersHigh: TokenUsageOutlier[] = users
    .filter((user) => user.totalTokens > highFence && user.totalTokens > 0)
    .slice(0, 12)
    .map((user) => ({
      email: user.email,
      name: user.name,
      tribe: user.tribe,
      leaderName: user.leaderName,
      totalTokens: user.totalTokens,
      events: user.events,
      outsidePct: user.outsidePct,
      zScore:
        deviation > 0
          ? Math.round(((user.totalTokens - meanTokens) / deviation) * 10) / 10
          : 0,
      reason: `Acima do Q3+1.5·IQR (${formatFence(highFence)})`,
    }));

  const outliersLow: TokenUsageOutlier[] = [...users]
    .filter(
      (user) =>
        user.totalTokens <= lowFence ||
        (medianTokens > 0 && user.totalTokens < medianTokens * 0.15),
    )
    .sort((a, b) => a.totalTokens - b.totalTokens)
    .slice(0, 12)
    .map((user) => ({
      email: user.email,
      name: user.name,
      tribe: user.tribe,
      leaderName: user.leaderName,
      totalTokens: user.totalTokens,
      events: user.events,
      outsidePct: user.outsidePct,
      zScore:
        deviation > 0
          ? Math.round(((user.totalTokens - meanTokens) / deviation) * 10) / 10
          : 0,
      reason:
        user.totalTokens <= lowFence
          ? `Abaixo do Q1−1.5·IQR (${formatFence(lowFence)})`
          : "Muito abaixo da mediana (<15%)",
    }));

  const outsideHeavyUsers = [...users]
    .filter((user) => user.outsideEvents >= 10 && user.outsidePct >= 15)
    .sort((a, b) => b.outsideEvents - a.outsideEvents || b.outsidePct - a.outsidePct)
    .slice(0, 12);

  const dailyResult = await query(
    `
    SELECT
      ${EVENT_BRT_DATE} AS day,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COUNT(DISTINCT user_email) AS unique_users
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY day
    ORDER BY day ASC
  `,
    rangeQueryParams,
  );
  const daily: TokenUsageDailyPoint[] = (
    dailyResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const dayEvents = Number(row.events ?? 0);
    const dayOutside = Number(row.outside_events ?? 0);
    return {
      date: String(row.day ?? ""),
      events: dayEvents,
      totalTokens: tokens(row.total_tokens),
      outsideEvents: dayOutside,
      outsidePct: pct(dayOutside, dayEvents),
      uniqueUsers: Number(row.unique_users ?? 0),
    };
  });

  const hourlyResult = await query(
    `
    SELECT
      ${EVENT_BRT_HOUR} AS hour,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY hour
    ORDER BY hour ASC
  `,
    rangeQueryParams,
  );
  const hourlyMap = new Map<number, TokenUsageHourPoint>();
  for (let hour = 0; hour < 24; hour += 1) {
    hourlyMap.set(hour, {
      hour,
      events: 0,
      totalTokens: 0,
      outside: hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR,
    });
  }
  for (const row of hourlyResult.rows as Record<string, unknown>[]) {
    const hour = Number(row.hour ?? 0);
    hourlyMap.set(hour, {
      hour,
      events: Number(row.events ?? 0),
      totalTokens: tokens(row.total_tokens),
      outside: hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR,
    });
  }
  const hourly = Array.from(hourlyMap.values());

  const heatResult = await query(
    `
    SELECT
      ${EVENT_BRT_DOW} AS weekday,
      ${EVENT_BRT_HOUR} AS hour,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY weekday, hour
  `,
    rangeQueryParams,
  );
  const heatmap: TokenUsageHeatCell[] = (
    heatResult.rows as Record<string, unknown>[]
  ).map((row) => ({
    weekday: Number(row.weekday ?? 0),
    hour: Number(row.hour ?? 0),
    events: Number(row.events ?? 0),
    totalTokens: tokens(row.total_tokens),
  }));

  const windowResult = await query(
    `
    SELECT
      ${EVENT_BRT_DATE} AS day,
      MIN(${EVENT_BRT_HOUR}) AS first_hour,
      MAX(${EVENT_BRT_HOUR}) AS last_hour,
      COUNT(*) AS events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY day
    ORDER BY day ASC
  `,
    rangeQueryParams,
  );
  const workWindows: TokenUsageWorkdayWindow[] = (
    windowResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const firstHour = Number(row.first_hour ?? 0);
    const lastHour = Number(row.last_hour ?? 0);
    return {
      date: String(row.day ?? ""),
      firstHour,
      lastHour,
      spanHours: Math.max(lastHour - firstHour + 1, 0),
      events: Number(row.events ?? 0),
      outsideEvents: Number(row.outside_events ?? 0),
    };
  });

  const summary: TokenUsageSummary = {
    events,
    users: Number(agg.users ?? 0),
    totalTokens,
    outputTokens: tokens(agg.output_tokens),
    costUsd: money(agg.cost_usd),
    maxModeEvents: Number(agg.max_mode_events ?? 0),
    periodStartUtc: (agg.period_start_utc as string | null) ?? null,
    periodEndUtc: (agg.period_end_utc as string | null) ?? null,
    periodStartBrt: (agg.period_start_brt as string | null) ?? null,
    periodEndBrt: (agg.period_end_brt as string | null) ?? null,
    periodDays: Number(agg.period_days ?? 0),
    outsideEvents,
    outsidePct: pct(outsideEvents, events),
    outsideTokens,
    outsideTokensPct: pct(outsideTokens, totalTokens),
    medianTokensPerUser: tokens(medianTokens),
    meanTokensPerUser: tokens(meanTokens),
  };

  return {
    upload,
    dateRange,
    summary,
    byKind,
    byModel,
    users,
    topUsers: users.slice(0, 10),
    daily,
    hourly,
    heatmap,
    workWindows,
    outliersHigh,
    outliersLow,
    outsideHeavyUsers,
  };
}

function formatFence(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export interface TokenUsageSlotPerson {
  email: string;
  name: string;
  tribe: string | null;
  leaderName: string | null;
  events: number;
  totalTokens: number;
}

export interface TokenUsageSlotBreakdown {
  weekday: number | null;
  hour: number | null;
  date: string | null;
  label: string;
  outside: boolean;
  events: number;
  totalTokens: number;
  people: TokenUsageSlotPerson[];
}

export interface TokenUsageSlotQuery {
  weekday?: number;
  hour?: number;
  date?: string;
  from?: string;
  to?: string;
}

function displayNameFromEmail(email: string, resolvedName: string | null): string {
  if (resolvedName?.trim()) return resolvedName.trim();
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getTokenUsageSlotPeople(
  filters: TokenUsageSlotQuery,
): Promise<TokenUsageSlotBreakdown> {
  await ensureSchema();

  const upload = await getLatestUploadByDataset("members_token_usage");
  if (!upload) {
    return {
      weekday: filters.weekday ?? null,
      hour: filters.hour ?? null,
      date: filters.date ?? null,
      label: "Sem dados",
      outside: false,
      events: 0,
      totalTokens: 0,
      people: [],
    };
  }
  const dateRange = await resolveTokenUsageDateRange(upload.id, {
    from: filters.from,
    to: filters.to,
  });

  const weekday =
    filters.weekday !== undefined && Number.isFinite(filters.weekday)
      ? Math.trunc(filters.weekday)
      : null;
  const hour =
    filters.hour !== undefined && Number.isFinite(filters.hour)
      ? Math.trunc(filters.hour)
      : null;
  const date =
    filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)
      ? filters.date
      : null;

  if (weekday === null && hour === null && !date) {
    throw new Error("Informe weekday+hour, hour ou date");
  }
  if (weekday !== null && (weekday < 0 || weekday > 6)) {
    throw new Error("weekday inválido");
  }
  if (hour !== null && (hour < 0 || hour > 23)) {
    throw new Error("hour inválido");
  }
  if (weekday !== null && hour === null) {
    throw new Error("weekday exige hour");
  }

  const range = tokenUsageRangeParams(dateRange);
  const clauses = ["upload_id = $1", range.sql];
  const params: unknown[] = [upload.id, ...range.params];

  if (date) {
    params.push(date);
    clauses.push(`${EVENT_BRT_DATE} = $${params.length}`);
  }
  if (weekday !== null) {
    params.push(weekday);
    clauses.push(`${EVENT_BRT_DOW} = $${params.length}`);
  }
  if (hour !== null) {
    params.push(hour);
    clauses.push(`${EVENT_BRT_HOUR} = $${params.length}`);
  }

  const result = await query(
    `
    SELECT
      user_email,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE ${clauses.join(" AND ")}
    GROUP BY user_email
    ORDER BY total_tokens DESC, events DESC, user_email ASC
  `,
    params,
  );

  const { getOrganogramIndex } = await import("./organogramDb");
  const organogram = await getOrganogramIndex();

  const people: TokenUsageSlotPerson[] = (
    result.rows as Record<string, unknown>[]
  ).map((row) => {
    const email = String(row.user_email ?? "").toLowerCase();
    const person = organogram.findByEmail(email);
    return {
      email,
      name: displayNameFromEmail(email, person?.name ?? null),
      tribe: (person?.tribe || person?.department || "").trim() || null,
      leaderName: person?.managerName?.trim() || null,
      events: Number(row.events ?? 0),
      totalTokens: tokens(row.total_tokens),
    };
  });

  const events = people.reduce((sum, person) => sum + person.events, 0);
  const totalTokens = people.reduce((sum, person) => sum + person.totalTokens, 0);

  const outside =
    hour !== null
      ? hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR
      : false;

  let label = "Detalhe do período";
  if (date && hour !== null) {
    label = `${date.split("-").reverse().join("/")} às ${String(hour).padStart(2, "0")}h`;
  } else if (weekday !== null && hour !== null) {
    label = `${WEEKDAY_LABELS[weekday]} às ${String(hour).padStart(2, "0")}h`;
  } else if (hour !== null) {
    label = `Todas as ${String(hour).padStart(2, "0")}h (Brasília)`;
  } else if (date) {
    label = `Dia ${date.split("-").reverse().join("/")}`;
  }

  return {
    weekday,
    hour,
    date,
    label,
    outside,
    events,
    totalTokens,
    people,
  };
}

export interface TokenUsageUserDetailMetrics {
  events: number;
  totalTokens: number;
  outputTokens: number;
  costUsd: number;
  outsideEvents: number;
  outsidePct: number;
  outsideTokens: number;
  activeDays: number;
  maxModeEvents: number;
  includedEvents: number;
  freeEvents: number;
  onDemandEvents: number;
}

export interface TokenUsageUserDailyPoint {
  date: string;
  events: number;
  totalTokens: number;
  outsideEvents: number;
  teamAvgTokensPerUser: number;
}

export interface MembersTokenUsageUserDetail {
  dateRange: TokenUsageDateRangeMeta;
  email: string;
  name: string;
  user: TokenUsageUserDetailMetrics;
  teamAvg: TokenUsageUserDetailMetrics;
  ratios: {
    events: number;
    totalTokens: number;
    costUsd: number;
    outsidePct: number;
    activeDays: number;
    maxModeEvents: number;
  };
  rankByTokens: number;
  totalUsers: number;
  percentileByTokens: number;
  daily: TokenUsageUserDailyPoint[];
  hourly: TokenUsageHourPoint[];
  heatmap: TokenUsageHeatCell[];
  byKind: TokenUsageKindBreakdown[];
  byModel: TokenUsageModelBreakdown[];
  outlierSide: "high" | "low" | null;
  outlierReason: string | null;
  zScore: number;
}

function emptyMetrics(): TokenUsageUserDetailMetrics {
  return {
    events: 0,
    totalTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    outsideEvents: 0,
    outsidePct: 0,
    outsideTokens: 0,
    activeDays: 0,
    maxModeEvents: 0,
    includedEvents: 0,
    freeEvents: 0,
    onDemandEvents: 0,
  };
}

function ratio(userValue: number, avgValue: number): number {
  if (avgValue <= 0) return userValue > 0 ? 99 : 0;
  return Math.round((userValue / avgValue) * 10) / 10;
}

function mapUserMetrics(row: Record<string, unknown>): TokenUsageUserDetailMetrics {
  const events = Number(row.events ?? 0);
  const outsideEvents = Number(row.outside_events ?? 0);
  return {
    events,
    totalTokens: tokens(row.total_tokens),
    outputTokens: tokens(row.output_tokens),
    costUsd: money(row.cost_usd),
    outsideEvents,
    outsidePct: pct(outsideEvents, events),
    outsideTokens: tokens(row.outside_tokens),
    activeDays: Number(row.active_days ?? 0),
    maxModeEvents: Number(row.max_mode_events ?? 0),
    includedEvents: Number(row.included_events ?? 0),
    freeEvents: Number(row.free_events ?? 0),
    onDemandEvents: Number(row.on_demand_events ?? 0),
  };
}

export interface MembersTokenUsageUserDetailOptions {
  dateRange?: TokenUsageDateRangeInput;
  compareLabel?: string;
  /**
   * Pool usado para médias / z-score / outliers / média diária.
   * Default: todos os usuários do upload.
   */
  compareEmails?: Set<string>;
  /**
   * Pool usado para ranking e percentil.
   * Default: mesmo conjunto de compareEmails (ou todos).
   */
  rankAmongEmails?: Set<string>;
}

export async function getMembersTokenUsageUserDetail(
  emailInput: string,
  options: MembersTokenUsageUserDetailOptions = {},
): Promise<MembersTokenUsageUserDetail | null> {
  await ensureSchema();

  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("E-mail inválido");
  }

  const upload = await getLatestUploadByDataset("members_token_usage");
  if (!upload) return null;
  const dateRange = await resolveTokenUsageDateRange(
    upload.id,
    options.dateRange,
  );
  const range = tokenUsageRangeParams(dateRange);
  const commonParams = [upload.id, ...range.params];

  const userAgg = await query(
    `
    SELECT
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN total_tokens ELSE 0 END), 0) AS outside_tokens,
      COUNT(DISTINCT ${EVENT_BRT_DATE}) AS active_days,
      COALESCE(SUM(CASE WHEN max_mode = 1 THEN 1 ELSE 0 END), 0) AS max_mode_events,
      COALESCE(SUM(CASE WHEN kind = 'Included' THEN 1 ELSE 0 END), 0) AS included_events,
      COALESCE(SUM(CASE WHEN kind = 'Free' THEN 1 ELSE 0 END), 0) AS free_events,
      COALESCE(SUM(CASE WHEN kind = 'On-Demand' THEN 1 ELSE 0 END), 0) AS on_demand_events
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
  `,
    [...commonParams, email],
  );

  const userRow = (userAgg.rows[0] ?? {}) as Record<string, unknown>;
  if (Number(userRow.events ?? 0) <= 0) return null;

  const user = mapUserMetrics(userRow);

  const allUsersResult = await query(
    `
    SELECT
      user_email,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN total_tokens ELSE 0 END), 0) AS outside_tokens,
      COUNT(DISTINCT ${EVENT_BRT_DATE}) AS active_days,
      COALESCE(SUM(CASE WHEN max_mode = 1 THEN 1 ELSE 0 END), 0) AS max_mode_events,
      COALESCE(SUM(CASE WHEN kind = 'Included' THEN 1 ELSE 0 END), 0) AS included_events,
      COALESCE(SUM(CASE WHEN kind = 'Free' THEN 1 ELSE 0 END), 0) AS free_events,
      COALESCE(SUM(CASE WHEN kind = 'On-Demand' THEN 1 ELSE 0 END), 0) AS on_demand_events
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql}
    GROUP BY user_email
  `,
    commonParams,
  );

  const allUsersWithEmail = (
    allUsersResult.rows as Record<string, unknown>[]
  ).map((row) => ({
    email: String(row.user_email ?? "").toLowerCase(),
    metrics: mapUserMetrics(row),
  }));

  const comparePool = options.compareEmails
    ? allUsersWithEmail.filter((entry) =>
        options.compareEmails!.has(entry.email),
      )
    : allUsersWithEmail;
  const rankPool = options.rankAmongEmails
    ? allUsersWithEmail.filter((entry) =>
        options.rankAmongEmails!.has(entry.email),
      )
    : comparePool;

  const compareUsers =
    comparePool.length > 0
      ? comparePool.map((entry) => entry.metrics)
      : allUsersWithEmail.map((entry) => entry.metrics);
  const rankUsers =
    rankPool.length > 0
      ? rankPool.map((entry) => entry.metrics)
      : compareUsers;

  const totalUsers = Math.max(compareUsers.length, 1);
  const rankTotalUsers = Math.max(rankUsers.length, 1);
  const sum = compareUsers.reduce((acc, item) => {
    acc.events += item.events;
    acc.totalTokens += item.totalTokens;
    acc.outputTokens += item.outputTokens;
    acc.costUsd += item.costUsd;
    acc.outsideEvents += item.outsideEvents;
    acc.outsideTokens += item.outsideTokens;
    acc.activeDays += item.activeDays;
    acc.maxModeEvents += item.maxModeEvents;
    acc.includedEvents += item.includedEvents;
    acc.freeEvents += item.freeEvents;
    acc.onDemandEvents += item.onDemandEvents;
    return acc;
  }, emptyMetrics());

  const teamAvg: TokenUsageUserDetailMetrics = {
    events: Math.round(sum.events / totalUsers),
    totalTokens: tokens(sum.totalTokens / totalUsers),
    outputTokens: tokens(sum.outputTokens / totalUsers),
    costUsd: money(sum.costUsd / totalUsers),
    outsideEvents: Math.round(sum.outsideEvents / totalUsers),
    outsidePct: pct(sum.outsideEvents, sum.events),
    outsideTokens: tokens(sum.outsideTokens / totalUsers),
    activeDays: Math.round((sum.activeDays / totalUsers) * 10) / 10,
    maxModeEvents: Math.round(sum.maxModeEvents / totalUsers),
    includedEvents: Math.round(sum.includedEvents / totalUsers),
    freeEvents: Math.round(sum.freeEvents / totalUsers),
    onDemandEvents: Math.round(sum.onDemandEvents / totalUsers),
  };

  const tokenValues = rankUsers
    .map((item) => item.totalTokens)
    .sort((a, b) => b - a);
  const rankByTokens =
    tokenValues.findIndex((value) => value === user.totalTokens) + 1 ||
    rankTotalUsers;
  const meanTokens = sum.totalTokens / totalUsers;
  const deviation = stdDev(
    compareUsers.map((item) => item.totalTokens),
    meanTokens,
  );
  const zScore =
    deviation > 0
      ? Math.round(((user.totalTokens - meanTokens) / deviation) * 10) / 10
      : 0;
  const percentileByTokens =
    rankTotalUsers > 1
      ? Math.round(
          ((rankTotalUsers - rankByTokens) / (rankTotalUsers - 1)) * 1000,
        ) / 10
      : 100;

  const sortedTokens = [...compareUsers.map((u) => u.totalTokens)].sort(
    (a, b) => a - b,
  );
  const q1 = quantile(sortedTokens, 0.25);
  const q3 = quantile(sortedTokens, 0.75);
  const iqr = Math.max(q3 - q1, 0);
  const highFence = q3 + 1.5 * iqr;
  const lowFence = Math.max(q1 - 1.5 * iqr, 0);
  const medianTokens = median(sortedTokens);
  let outlierSide: "high" | "low" | null = null;
  let outlierReason: string | null = null;
  const compareLabel = options.compareLabel ?? "Diretoria de TI";
  if (user.totalTokens > highFence) {
    outlierSide = "high";
    outlierReason = `Acima do Q3+1.5·IQR (${formatFence(highFence)}) vs ${compareLabel}`;
  } else if (
    user.totalTokens <= lowFence ||
    (medianTokens > 0 && user.totalTokens < medianTokens * 0.15)
  ) {
    outlierSide = "low";
    outlierReason =
      user.totalTokens <= lowFence
        ? `Abaixo do Q1−1.5·IQR (${formatFence(lowFence)}) vs ${compareLabel}`
        : `Muito abaixo da mediana da ${compareLabel} (<15%)`;
  }

  const compareEmailList = options.compareEmails
    ? [...options.compareEmails]
    : null;

  let teamDailyMap = new Map<string, number>();
  if (compareEmailList && compareEmailList.length > 0) {
    const placeholders = compareEmailList
      .map((_, index) => `$${index + 4}`)
      .join(", ");
    const teamDailyResult = await query(
      `
      SELECT
        ${EVENT_BRT_DATE} AS day,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COUNT(DISTINCT user_email) AS unique_users
      FROM cursor_token_usage_events
      WHERE upload_id = $1 AND ${range.sql} AND user_email IN (${placeholders})
      GROUP BY day
    `,
      [...commonParams, ...compareEmailList],
    );
    for (const row of teamDailyResult.rows as Record<string, unknown>[]) {
      const day = String(row.day ?? "");
      const dayTokens = tokens(row.total_tokens);
      const uniqueUsers = Math.max(Number(row.unique_users ?? 1), 1);
      teamDailyMap.set(day, tokens(dayTokens / uniqueUsers));
    }
  } else {
    const teamDailyResult = await query(
      `
      SELECT
        ${EVENT_BRT_DATE} AS day,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COUNT(DISTINCT user_email) AS unique_users
      FROM cursor_token_usage_events
      WHERE upload_id = $1 AND ${range.sql}
      GROUP BY day
    `,
      commonParams,
    );
    for (const row of teamDailyResult.rows as Record<string, unknown>[]) {
      const day = String(row.day ?? "");
      const dayTokens = tokens(row.total_tokens);
      const uniqueUsers = Math.max(Number(row.unique_users ?? 1), 1);
      teamDailyMap.set(day, tokens(dayTokens / uniqueUsers));
    }
  }

  const userDailyResult = await query(
    `
    SELECT
      ${EVENT_BRT_DATE} AS day,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
    GROUP BY day
    ORDER BY day ASC
  `,
    [...commonParams, email],
  );
  const daily: TokenUsageUserDailyPoint[] = (
    userDailyResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const day = String(row.day ?? "");
    return {
      date: day,
      events: Number(row.events ?? 0),
      totalTokens: tokens(row.total_tokens),
      outsideEvents: Number(row.outside_events ?? 0),
      teamAvgTokensPerUser: teamDailyMap.get(day) ?? 0,
    };
  });

  const hourlyResult = await query(
    `
    SELECT
      ${EVENT_BRT_HOUR} AS hour,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
    GROUP BY hour
    ORDER BY hour ASC
  `,
    [...commonParams, email],
  );
  const hourlyMap = new Map<number, TokenUsageHourPoint>();
  for (let hour = 0; hour < 24; hour += 1) {
    hourlyMap.set(hour, {
      hour,
      events: 0,
      totalTokens: 0,
      outside: hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR,
    });
  }
  for (const row of hourlyResult.rows as Record<string, unknown>[]) {
    const hour = Number(row.hour ?? 0);
    hourlyMap.set(hour, {
      hour,
      events: Number(row.events ?? 0),
      totalTokens: tokens(row.total_tokens),
      outside: hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR,
    });
  }
  const hourly = Array.from(hourlyMap.values());

  const heatResult = await query(
    `
    SELECT
      ${EVENT_BRT_DOW} AS weekday,
      ${EVENT_BRT_HOUR} AS hour,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
    GROUP BY weekday, hour
  `,
    [...commonParams, email],
  );
  const heatmap: TokenUsageHeatCell[] = (
    heatResult.rows as Record<string, unknown>[]
  ).map((row) => ({
    weekday: Number(row.weekday ?? 0),
    hour: Number(row.hour ?? 0),
    events: Number(row.events ?? 0),
    totalTokens: tokens(row.total_tokens),
  }));

  const kindResult = await query(
    `
    SELECT
      kind,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
    GROUP BY kind
    ORDER BY total_tokens DESC, events DESC
  `,
    [...commonParams, email],
  );
  const byKind: TokenUsageKindBreakdown[] = (
    kindResult.rows as Record<string, unknown>[]
  ).map((row) => ({
    kind: String(row.kind || "—"),
    events: Number(row.events ?? 0),
    totalTokens: tokens(row.total_tokens),
    costUsd: money(row.cost_usd),
  }));

  const modelResult = await query(
    `
    SELECT
      model,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE upload_id = $1 AND ${range.sql} AND user_email = $4
    GROUP BY model
    ORDER BY total_tokens DESC, events DESC
  `,
    [...commonParams, email],
  );
  const byModel: TokenUsageModelBreakdown[] = (
    modelResult.rows as Record<string, unknown>[]
  ).map((row) => {
    const modelTokens = tokens(row.total_tokens);
    return {
      model: String(row.model || "—"),
      events: Number(row.events ?? 0),
      totalTokens: modelTokens,
      users: 1,
      sharePct: pct(modelTokens, user.totalTokens),
    };
  });

  const { getOrganogramIndex } = await import("./organogramDb");
  const organogram = await getOrganogramIndex();
  const person = organogram.findByEmail(email);

  return {
    dateRange,
    email,
    name: displayNameFromEmail(email, person?.name ?? null),
    user,
    teamAvg,
    ratios: {
      events: ratio(user.events, teamAvg.events),
      totalTokens: ratio(user.totalTokens, teamAvg.totalTokens),
      costUsd: ratio(user.costUsd, teamAvg.costUsd),
      outsidePct: ratio(user.outsidePct, teamAvg.outsidePct),
      activeDays: ratio(user.activeDays, teamAvg.activeDays),
      maxModeEvents: ratio(user.maxModeEvents, teamAvg.maxModeEvents),
    },
    rankByTokens,
    totalUsers: rankTotalUsers,
    percentileByTokens,
    daily,
    hourly,
    heatmap,
    byKind,
    byModel,
    outlierSide,
    outlierReason,
    zScore,
  };
}

