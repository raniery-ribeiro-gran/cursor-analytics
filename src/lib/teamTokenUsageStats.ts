import {
  getLatestUploadByDataset,
  type DataUploadLog,
} from "./dataUploadsDb";
import {
  getMembersTokenUsageData,
  getMembersTokenUsageUserDetail,
  type MembersTokenUsageData,
  type MembersTokenUsageUserDetail,
  type TokenUsageOutlier,
  type TokenUsageSummary,
  type TokenUsageUserRow,
} from "./membersTokenUsageStats";
import {
  getOrganogramDescendants,
  type OrganogramDescendant,
} from "./organogramHierarchy";
import { findPersonByEmail } from "./organogramDb";
import {
  getMembersUsageCycleData,
  type MembersUsageMember,
} from "./membersUsageStats";
import {
  tokenUsageRangeParams,
  type TokenUsageDateRangeInput,
  type TokenUsageDateRangeMeta,
} from "./tokenUsageDateRange";

export interface DirectorateBenchmark {
  users: number;
  meanTokensPerUser: number;
  medianTokensPerUser: number;
  meanEventsPerUser: number;
  meanCostUsdPerUser: number;
  meanOutsidePct: number;
  totalTokens: number;
  events: number;
  costUsd: number;
  outsidePct: number;
}

export interface TeamTokenUsageData extends MembersTokenUsageData {
  leader: {
    email: string;
    name: string;
  };
  organogramReports: number;
  reports: OrganogramDescendant[];
  directorate: DirectorateBenchmark | null;
  emptyReason: "no_reports" | "no_usage" | null;
}

export interface TeamMembersCycleMember extends MembersUsageMember {
  depth: number;
}

export interface TeamMembersCycleUsage {
  upload: DataUploadLog | null;
  cycleDate: string | null;
  usageCycleId: number | null;
  organogramReports: number;
  membersWithUsage: number;
  includedTotal: number;
  freeTotal: number;
  onDemandTotal: number;
  withOnDemand: number;
  idle: number;
  members: TeamMembersCycleMember[];
}

/** Snapshot cumulativo do ciclo atual, limitado à árvore do líder. */
export async function getTeamMembersCycleUsage(
  leaderEmail: string,
): Promise<TeamMembersCycleUsage> {
  const reports = await getOrganogramDescendants(leaderEmail);
  const reportByEmail = new Map(
    reports.map((report) => [report.email.toLowerCase(), report]),
  );
  const cycle = await getMembersUsageCycleData();
  const members: TeamMembersCycleMember[] = cycle.members
    .filter((member) => reportByEmail.has(member.email.toLowerCase()))
    .map((member) => ({
      ...member,
      depth: reportByEmail.get(member.email.toLowerCase())?.depth ?? 1,
    }))
    .sort(
      (a, b) =>
        b.onDemandUsage - a.onDemandUsage ||
        b.includedUsage + b.freeUsage - (a.includedUsage + a.freeUsage) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

  return {
    upload: cycle.upload,
    cycleDate: cycle.upload?.cycleDate ?? null,
    usageCycleId: cycle.upload?.usageCycleId ?? null,
    organogramReports: reports.length,
    membersWithUsage: members.length,
    includedTotal: members.reduce(
      (sum, member) => sum + member.includedUsage,
      0,
    ),
    freeTotal: members.reduce((sum, member) => sum + member.freeUsage, 0),
    onDemandTotal: members.reduce(
      (sum, member) => sum + member.onDemandUsage,
      0,
    ),
    withOnDemand: members.filter((member) => member.onDemandUsage > 0).length,
    idle: members.filter(
      (member) =>
        member.includedUsage === 0 &&
        member.freeUsage === 0 &&
        member.onDemandUsage === 0,
    ).length,
    members,
  };
}

function emptyTeamPayload(
  leaderEmail: string,
  leaderName: string,
  reports: OrganogramDescendant[],
  emptyReason: TeamTokenUsageData["emptyReason"],
  upload: DataUploadLog | null = null,
  dateRange: TokenUsageDateRangeMeta = {
    from: null,
    to: null,
    minDate: null,
    maxDate: null,
    isDefault: true,
  },
): TeamTokenUsageData {
  return {
    upload,
    dateRange,
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
    leader: { email: leaderEmail, name: leaderName },
    organogramReports: reports.length,
    reports,
    directorate: null,
    emptyReason,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base]!;
  return sorted[base]! + rest * (next - sorted[base]!);
}

function formatFence(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function buildSummaryFromUsers(
  users: TokenUsageUserRow[],
  period: Pick<
    TokenUsageSummary,
    | "periodStartUtc"
    | "periodEndUtc"
    | "periodStartBrt"
    | "periodEndBrt"
    | "periodDays"
  >,
): TokenUsageSummary {
  const events = users.reduce((sum, user) => sum + user.events, 0);
  const totalTokens = users.reduce((sum, user) => sum + user.totalTokens, 0);
  const outputTokens = users.reduce((sum, user) => sum + user.outputTokens, 0);
  const costUsd =
    Math.round(users.reduce((sum, user) => sum + user.costUsd, 0) * 100) / 100;
  const maxModeEvents = users.reduce(
    (sum, user) => sum + user.maxModeEvents,
    0,
  );
  const outsideEvents = users.reduce(
    (sum, user) => sum + user.outsideEvents,
    0,
  );
  const outsideTokens = users.reduce(
    (sum, user) =>
      sum + Math.round((user.outsidePct / 100) * user.totalTokens),
    0,
  );
  const tokenValues = users.map((user) => user.totalTokens);

  return {
    events,
    users: users.length,
    totalTokens,
    outputTokens,
    costUsd,
    maxModeEvents,
    ...period,
    outsideEvents,
    outsidePct:
      events > 0 ? Math.round((outsideEvents / events) * 1000) / 10 : 0,
    outsideTokens,
    outsideTokensPct:
      totalTokens > 0
        ? Math.round((outsideTokens / totalTokens) * 1000) / 10
        : 0,
    medianTokensPerUser: Math.round(median(tokenValues)),
    meanTokensPerUser: Math.round(mean(tokenValues)),
  };
}

function buildDirectorateBenchmark(
  users: TokenUsageUserRow[],
): DirectorateBenchmark {
  const events = users.reduce((sum, user) => sum + user.events, 0);
  const totalTokens = users.reduce((sum, user) => sum + user.totalTokens, 0);
  const costUsd =
    Math.round(users.reduce((sum, user) => sum + user.costUsd, 0) * 100) / 100;
  const outsideEvents = users.reduce(
    (sum, user) => sum + user.outsideEvents,
    0,
  );

  return {
    users: users.length,
    meanTokensPerUser: Math.round(mean(users.map((u) => u.totalTokens))),
    medianTokensPerUser: Math.round(median(users.map((u) => u.totalTokens))),
    meanEventsPerUser: Math.round(mean(users.map((u) => u.events))),
    meanCostUsdPerUser:
      Math.round(mean(users.map((u) => u.costUsd)) * 100) / 100,
    meanOutsidePct:
      Math.round(mean(users.map((u) => u.outsidePct)) * 10) / 10,
    totalTokens,
    events,
    costUsd,
    outsidePct:
      events > 0 ? Math.round((outsideEvents / events) * 1000) / 10 : 0,
  };
}

function buildOutliersAgainstRest(
  teamUsers: TokenUsageUserRow[],
  directorateUsers: TokenUsageUserRow[],
): { high: TokenUsageOutlier[]; low: TokenUsageOutlier[] } {
  const directorateTokens = directorateUsers.map((user) => user.totalTokens);
  const sorted = [...directorateTokens].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = Math.max(q3 - q1, 0);
  const highFence = q3 + 1.5 * iqr;
  const lowFence = Math.max(q1 - 1.5 * iqr, 0);
  const medianTokens = median(directorateTokens);
  const meanTokens = mean(directorateTokens);
  const deviation =
    directorateTokens.length < 2
      ? 0
      : Math.sqrt(
          directorateTokens.reduce(
            (sum, value) => sum + (value - meanTokens) ** 2,
            0,
          ) /
            (directorateTokens.length - 1),
        );

  const high: TokenUsageOutlier[] = teamUsers
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
      reason: `Acima do Q3+1.5·IQR da Diretoria de TI (${formatFence(highFence)})`,
    }));

  const low: TokenUsageOutlier[] = [...teamUsers]
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
          ? `Abaixo do Q1−1.5·IQR da Diretoria de TI (${formatFence(lowFence)})`
          : "Muito abaixo da mediana da Diretoria de TI (<15%)",
    }));

  return { high, low };
}

/**
 * Token usage dos liderados, com benchmark = toda a Diretoria de TI.
 */
export async function getTeamTokenUsageData(
  leaderEmailInput: string,
  dateRangeInput: TokenUsageDateRangeInput = {},
): Promise<TeamTokenUsageData> {
  const leaderEmail = leaderEmailInput.trim().toLowerCase();
  const leaderPerson = await findPersonByEmail(leaderEmail);
  const leaderName = leaderPerson?.name ?? leaderEmail;

  const reports = await getOrganogramDescendants(leaderEmail);
  const teamEmails = new Set(reports.map((person) => person.email));
  const full = await getMembersTokenUsageData(dateRangeInput);

  if (teamEmails.size === 0) {
    return emptyTeamPayload(
      leaderEmail,
      leaderName,
      reports,
      "no_reports",
      full.upload,
      full.dateRange,
    );
  }

  if (!full.upload || !full.summary) {
    return emptyTeamPayload(
      leaderEmail,
      leaderName,
      reports,
      "no_usage",
      full.upload,
      full.dateRange,
    );
  }

  const teamUsers = full.users.filter((user) => teamEmails.has(user.email));
  const directorateUsers = full.users;

  if (teamUsers.length === 0) {
    return {
      ...emptyTeamPayload(
        leaderEmail,
        leaderName,
        reports,
        "no_usage",
        full.upload,
        full.dateRange,
      ),
      directorate:
        directorateUsers.length > 0
          ? buildDirectorateBenchmark(directorateUsers)
          : null,
    };
  }

  const summary = buildSummaryFromUsers(teamUsers, {
    periodStartUtc: full.summary.periodStartUtc,
    periodEndUtc: full.summary.periodEndUtc,
    periodStartBrt: full.summary.periodStartBrt,
    periodEndBrt: full.summary.periodEndBrt,
    periodDays: full.summary.periodDays,
  });

  const { high: outliersHigh, low: outliersLow } = buildOutliersAgainstRest(
    teamUsers,
    directorateUsers,
  );

  const outsideHeavyUsers = [...teamUsers]
    .filter((user) => user.outsideEvents >= 10 && user.outsidePct >= 15)
    .sort(
      (a, b) =>
        b.outsideEvents - a.outsideEvents || b.outsidePct - a.outsidePct,
    )
    .slice(0, 12);

  // Agregados de charts: filtrar eventos do time a partir dos usuários.
  // Reusa daily/hourly/heatmap do full recalculando proporção via queries seria ideal;
  // aqui reprocessamos daily a partir dos users não é possível — usamos getMembers
  // filtrando com query scoped via re-fetch of aggregates for team emails only.
  const scoped = await getScopedChartsForEmails(
    full.upload.id,
    [...teamEmails],
    full.dateRange,
  );

  const teamTokenTotal = summary.totalTokens || 1;
  const byKind = scoped.byKind;
  const byModel = scoped.byModel.map((model) => ({
    ...model,
    sharePct:
      Math.round((model.totalTokens / teamTokenTotal) * 1000) / 10,
  }));

  return {
    upload: full.upload,
    dateRange: full.dateRange,
    summary,
    byKind,
    byModel,
    users: teamUsers,
    topUsers: teamUsers.slice(0, 10),
    daily: scoped.daily,
    hourly: scoped.hourly,
    heatmap: scoped.heatmap,
    workWindows: scoped.workWindows,
    outliersHigh,
    outliersLow,
    outsideHeavyUsers,
    leader: { email: leaderEmail, name: leaderName },
    organogramReports: reports.length,
    reports,
    directorate:
      directorateUsers.length > 0
        ? buildDirectorateBenchmark(directorateUsers)
        : null,
    emptyReason: null,
  };
}

export async function getTeamTokenUsageUserDetail(
  leaderEmail: string,
  memberEmail: string,
  dateRangeInput: TokenUsageDateRangeInput = {},
): Promise<MembersTokenUsageUserDetail | null> {
  const reports = await getOrganogramDescendants(leaderEmail);
  const teamEmails = new Set(reports.map((person) => person.email));
  const member = memberEmail.trim().toLowerCase();

  if (!teamEmails.has(member)) {
    throw new Error("Membro fora da hierarquia do líder");
  }

  const full = await getMembersTokenUsageData(dateRangeInput);
  const directorateEmails = new Set(
    full.users.map((user) => user.email),
  );

  return getMembersTokenUsageUserDetail(member, {
    dateRange: dateRangeInput,
    compareEmails:
      directorateEmails.size > 0 ? directorateEmails : undefined,
    rankAmongEmails: teamEmails,
  });
}

async function getScopedChartsForEmails(
  uploadId: number,
  emails: string[],
  dateRange: TokenUsageDateRangeMeta,
): Promise<
  Pick<
    MembersTokenUsageData,
    "daily" | "hourly" | "heatmap" | "workWindows" | "byKind" | "byModel"
  >
> {
  const { query } = await import("./sqlite");
  const {
    WORKDAY_END_HOUR,
    WORKDAY_START_HOUR,
  } = await import("./membersTokenUsageConstants");

  const EVENT_BRT = `datetime(replace(substr(event_at, 1, 19), 'T', ' '), '-3 hours')`;
  const EVENT_BRT_DATE = `date(${EVENT_BRT})`;
  const EVENT_BRT_HOUR = `CAST(strftime('%H', ${EVENT_BRT}) AS INTEGER)`;
  const EVENT_BRT_DOW = `CAST(strftime('%w', ${EVENT_BRT}) AS INTEGER)`;
  const IS_OUTSIDE_HOURS = `(${EVENT_BRT_HOUR} < ${WORKDAY_START_HOUR} OR ${EVENT_BRT_HOUR} >= ${WORKDAY_END_HOUR})`;

  if (emails.length === 0) {
    return {
      daily: [],
      hourly: [],
      heatmap: [],
      workWindows: [],
      byKind: [],
      byModel: [],
    };
  }

  const range = tokenUsageRangeParams(dateRange);
  const placeholders = emails.map((_, index) => `$${index + 4}`).join(", ");
  const params: unknown[] = [uploadId, ...range.params, ...emails];
  const emailFilter = `upload_id = $1 AND ${range.sql} AND user_email IN (${placeholders})`;

  const dailyResult = await query(
    `
    SELECT
      ${EVENT_BRT_DATE} AS day,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events,
      COUNT(DISTINCT user_email) AS unique_users
    FROM cursor_token_usage_events
    WHERE ${emailFilter}
    GROUP BY day
    ORDER BY day ASC
  `,
    params,
  );

  const daily = (dailyResult.rows as Record<string, unknown>[]).map((row) => {
    const dayEvents = Number(row.events ?? 0);
    const dayOutside = Number(row.outside_events ?? 0);
    return {
      date: String(row.day ?? ""),
      events: dayEvents,
      totalTokens: Math.round(Number(row.total_tokens ?? 0)),
      outsideEvents: dayOutside,
      outsidePct:
        dayEvents > 0
          ? Math.round((dayOutside / dayEvents) * 1000) / 10
          : 0,
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
    WHERE ${emailFilter}
    GROUP BY hour
    ORDER BY hour ASC
  `,
    params,
  );
  const hourlyMap = new Map<
    number,
    { hour: number; events: number; totalTokens: number; outside: boolean }
  >();
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
      totalTokens: Math.round(Number(row.total_tokens ?? 0)),
      outside: hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR,
    });
  }

  const heatResult = await query(
    `
    SELECT
      ${EVENT_BRT_DOW} AS weekday,
      ${EVENT_BRT_HOUR} AS hour,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens
    FROM cursor_token_usage_events
    WHERE ${emailFilter}
    GROUP BY weekday, hour
  `,
    params,
  );

  const windowResult = await query(
    `
    SELECT
      ${EVENT_BRT_DATE} AS day,
      MIN(${EVENT_BRT_HOUR}) AS first_hour,
      MAX(${EVENT_BRT_HOUR}) AS last_hour,
      COUNT(*) AS events,
      COALESCE(SUM(CASE WHEN ${IS_OUTSIDE_HOURS} THEN 1 ELSE 0 END), 0) AS outside_events
    FROM cursor_token_usage_events
    WHERE ${emailFilter}
    GROUP BY day
    ORDER BY day ASC
  `,
    params,
  );

  const kindResult = await query(
    `
    SELECT
      kind,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN cost_type = 'usd' THEN cost ELSE 0 END), 0) AS cost_usd
    FROM cursor_token_usage_events
    WHERE ${emailFilter}
    GROUP BY kind
    ORDER BY total_tokens DESC, events DESC
  `,
    params,
  );

  const modelResult = await query(
    `
    SELECT
      model,
      COUNT(*) AS events,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COUNT(DISTINCT user_email) AS users
    FROM cursor_token_usage_events
    WHERE ${emailFilter}
    GROUP BY model
    ORDER BY total_tokens DESC, events DESC
  `,
    params,
  );

  return {
    daily,
    hourly: Array.from(hourlyMap.values()),
    heatmap: (heatResult.rows as Record<string, unknown>[]).map((row) => ({
      weekday: Number(row.weekday ?? 0),
      hour: Number(row.hour ?? 0),
      events: Number(row.events ?? 0),
      totalTokens: Math.round(Number(row.total_tokens ?? 0)),
    })),
    workWindows: (windowResult.rows as Record<string, unknown>[]).map(
      (row) => {
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
      },
    ),
    byKind: (kindResult.rows as Record<string, unknown>[]).map((row) => ({
      kind: String(row.kind || "—"),
      events: Number(row.events ?? 0),
      totalTokens: Math.round(Number(row.total_tokens ?? 0)),
      costUsd: Math.round(Number(row.cost_usd ?? 0) * 100) / 100,
    })),
    byModel: (modelResult.rows as Record<string, unknown>[]).map((row) => ({
      model: String(row.model || "—"),
      events: Number(row.events ?? 0),
      totalTokens: Math.round(Number(row.total_tokens ?? 0)),
      users: Number(row.users ?? 0),
      sharePct: 0,
    })),
  };
}
