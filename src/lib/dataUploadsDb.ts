import { ensureSchema, getDb, query } from "./sqlite";
import type { CursorDatasetKey } from "./cursorDatasets";
import {
  parseMembersUsageCsv,
  parseMembersUsageFilename,
  type MembersUsageRow,
} from "./membersUsageCsv";
import {
  parseMembersTokenUsageCsv,
  parseMembersTokenUsageFilename,
  type MembersTokenUsageEvent,
} from "./membersTokenUsageCsv";

export interface DataUploadLog {
  id: number;
  dataset: string;
  filename: string;
  uploadedAt: string;
  uploadedByEmail: string | null;
  rowCount: number;
  status: "success" | "error";
  errorMessage: string | null;
  sourceTeamId: string | null;
  cycleDate: string | null;
  parsedRowCount: number;
  ignoredRowCount: number;
  usageCycleId: number | null;
}

function mapLog(row: Record<string, unknown>): DataUploadLog {
  return {
    id: Number(row.id),
    dataset: String(row.dataset),
    filename: String(row.filename),
    uploadedAt: String(row.uploaded_at),
    uploadedByEmail: (row.uploaded_by_email as string | null) ?? null,
    rowCount: Number(row.row_count ?? 0),
    status: (row.status as "success" | "error") ?? "success",
    errorMessage: (row.error_message as string | null) ?? null,
    sourceTeamId: (row.source_team_id as string | null) ?? null,
    cycleDate: (row.cycle_date as string | null) ?? null,
    parsedRowCount: Number(row.parsed_row_count ?? row.row_count ?? 0),
    ignoredRowCount: Number(row.ignored_row_count ?? 0),
    usageCycleId:
      row.usage_cycle_id == null ? null : Number(row.usage_cycle_id),
  };
}

export async function getLatestUploadByDataset(
  dataset: CursorDatasetKey,
): Promise<DataUploadLog | null> {
  const result = await query(
    `
    SELECT *
    FROM data_upload_logs
    WHERE dataset = $1 AND status = 'success'
    ORDER BY uploaded_at DESC, id DESC
    LIMIT 1
  `,
    [dataset],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapLog(row) : null;
}

export async function listMembersUsageCycles(): Promise<DataUploadLog[]> {
  const result = await query(
    `
    SELECT *
    FROM (
      SELECT
        logs.*,
        ROW_NUMBER() OVER (
          PARTITION BY usage_cycle_id
          ORDER BY uploaded_at DESC, id DESC
        ) AS cycle_rank
      FROM data_upload_logs logs
      WHERE dataset = 'members_usage'
        AND status = 'success'
        AND usage_cycle_id IS NOT NULL
    )
    WHERE cycle_rank = 1
    ORDER BY usage_cycle_id DESC
  `,
  );
  return (result.rows as Record<string, unknown>[]).map(mapLog);
}

export async function getMembersUsageUploadForCycle(
  usageCycleId?: number,
): Promise<DataUploadLog | null> {
  if (usageCycleId == null) {
    return getLatestUploadByDataset("members_usage");
  }
  const result = await query(
    `
    SELECT *
    FROM data_upload_logs
    WHERE dataset = 'members_usage'
      AND status = 'success'
      AND usage_cycle_id = $1
    ORDER BY uploaded_at DESC, id DESC
    LIMIT 1
  `,
    [usageCycleId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapLog(row) : null;
}

export async function listLatestUploads(): Promise<
  Partial<Record<CursorDatasetKey, DataUploadLog>>
> {
  const [members, tokenUsage] = await Promise.all([
    getLatestUploadByDataset("members_usage"),
    getLatestUploadByDataset("members_token_usage"),
  ]);
  return {
    members_usage: members ?? undefined,
    members_token_usage: tokenUsage ?? undefined,
  };
}

function insertMembersRows(
  uploadId: number,
  rows: MembersUsageRow[],
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO cursor_members_usage (
      upload_id, name, email, role, seat_type,
      included_usage, included_usage_raw,
      free_usage, free_usage_raw, free_usage_capped,
      on_demand_usage, on_demand_usage_raw
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  const run = db.transaction((items: MembersUsageRow[]) => {
    for (const row of items) {
      stmt.run(
        uploadId,
        row.name,
        row.email,
        row.role,
        row.seatType,
        row.includedUsage.value,
        row.includedUsage.raw,
        row.freeUsage.value,
        row.freeUsage.raw,
        row.freeUsage.capped ? 1 : 0,
        row.onDemandUsage.value,
        row.onDemandUsage.raw,
      );
    }
  });

  run(rows);
}

function usageTotal(row: MembersUsageRow): number {
  return (
    (row.includedUsage.value ?? 0) +
    (row.freeUsage.value ?? 0) +
    (row.onDemandUsage.value ?? 0)
  );
}

async function detectMembersUsageCycle(rows: MembersUsageRow[]): Promise<number> {
  const previous = await getLatestUploadByDataset("members_usage");
  if (!previous) return 1;

  const previousRows = await query(
    `
    SELECT email, included_usage, free_usage, on_demand_usage
    FROM cursor_members_usage
    WHERE upload_id = $1
  `,
    [previous.id],
  );

  const previousByEmail = new Map<string, number>();
  let previousAggregate = 0;
  for (const raw of previousRows.rows as Record<string, unknown>[]) {
    const total =
      Number(raw.included_usage ?? 0) +
      Number(raw.free_usage ?? 0) +
      Number(raw.on_demand_usage ?? 0);
    previousByEmail.set(String(raw.email).toLowerCase(), total);
    previousAggregate += total;
  }

  let comparable = 0;
  let decreased = 0;
  let currentAggregate = 0;
  for (const row of rows) {
    const current = usageTotal(row);
    currentAggregate += current;
    const prior = previousByEmail.get(row.email);
    if (prior == null || prior <= 0) continue;
    comparable += 1;
    // Pequenas oscilações/ajustes não caracterizam reinício.
    if (current < prior * 0.5) decreased += 1;
  }

  const majorityReset =
    comparable >= 3 && decreased / comparable >= 0.6;
  const aggregateReset =
    previousAggregate > 0 && currentAggregate < previousAggregate * 0.7;
  const previousCycle = previous.usageCycleId ?? 1;

  return majorityReset && aggregateReset
    ? previousCycle + 1
    : previousCycle;
}

export async function importMembersUsageCsv(options: {
  filename: string;
  content: string;
  uploadedByEmail: string | null;
}): Promise<DataUploadLog> {
  await ensureSchema();

  const { sourceTeamId, cycleDate } = parseMembersUsageFilename(
    options.filename,
  );
  let rows: MembersUsageRow[];

  try {
    rows = parseMembersUsageCsv(options.content);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao ler CSV";
    const failed = await query<{ id: number }>(
      `
      INSERT INTO data_upload_logs (
        dataset, filename, uploaded_by_email, row_count, status,
        error_message, source_team_id, cycle_date, uploaded_at
      ) VALUES (
        'members_usage', $1, $2, 0, 'error',
        $3, $4, $5, datetime('now')
      )
      RETURNING id
    `,
      [
        options.filename,
        options.uploadedByEmail,
        message,
        sourceTeamId,
        cycleDate,
      ],
    );

    return {
      id: Number(failed.rows[0]?.id ?? 0),
      dataset: "members_usage",
      filename: options.filename,
      uploadedAt: new Date().toISOString(),
      uploadedByEmail: options.uploadedByEmail,
      rowCount: 0,
      status: "error",
      errorMessage: message,
      sourceTeamId,
      cycleDate,
      parsedRowCount: 0,
      ignoredRowCount: 0,
      usageCycleId: null,
    };
  }

  const usageCycleId = await detectMembersUsageCycle(rows);
  const created = await query<{ id: number }>(
    `
    INSERT INTO data_upload_logs (
      dataset, filename, uploaded_by_email, row_count, status,
      error_message, source_team_id, cycle_date, uploaded_at,
      parsed_row_count, ignored_row_count, usage_cycle_id
    ) VALUES (
      'members_usage', $1, $2, $3, 'success',
      NULL, $4, $5, datetime('now'), $3, 0, $6
    )
    RETURNING id
  `,
    [
      options.filename,
      options.uploadedByEmail,
      rows.length,
      sourceTeamId,
      cycleDate,
      usageCycleId,
    ],
  );

  const uploadId = Number(created.rows[0]?.id);
  insertMembersRows(uploadId, rows);

  const latest = await query(
    `SELECT * FROM data_upload_logs WHERE id = $1`,
    [uploadId],
  );
  return mapLog(latest.rows[0] as Record<string, unknown>);
}

export async function countMembersUsageRows(
  uploadId: number,
): Promise<number> {
  const result = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM cursor_members_usage WHERE upload_id = $1`,
    [uploadId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

function insertTokenUsageEvents(
  uploadId: number,
  events: MembersTokenUsageEvent[],
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO cursor_token_usage_events (
      upload_id, event_at, user_email, cloud_agent_id, automation_id,
      kind, model, max_mode,
      input_cache_write, input_no_cache_write, cache_read,
      output_tokens, total_tokens,
      cost, cost_raw, cost_type
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `);

  const run = db.transaction((items: MembersTokenUsageEvent[]) => {
    for (const event of items) {
      stmt.run(
        uploadId,
        event.eventAt,
        event.userEmail,
        event.cloudAgentId,
        event.automationId,
        event.kind,
        event.model,
        event.maxMode ? 1 : 0,
        event.inputCacheWrite,
        event.inputNoCacheWrite,
        event.cacheRead,
        event.outputTokens,
        event.totalTokens,
        event.cost,
        event.costRaw,
        event.costType,
      );
    }
  });

  run(events);
}

function tokenEventDayBrt(eventAt: string): string {
  const instant = new Date(eventAt);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Data de evento inválida: ${eventAt}`);
  }
  return new Date(instant.getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function prepareIncrementalTokenEvents(
  events: MembersTokenUsageEvent[],
  sourceTeamId: string | null,
): Promise<{
  previousUploadId: number | null;
  eventsToInsert: MembersTokenUsageEvent[];
  ignoredCount: number;
}> {
  const previous = await getLatestUploadByDataset("members_token_usage");
  const sameSource =
    previous &&
    (previous.sourceTeamId === sourceTeamId ||
      (!previous.sourceTeamId && !sourceTeamId));

  if (!previous || !sameSource) {
    return {
      previousUploadId: null,
      eventsToInsert: events,
      ignoredCount: 0,
    };
  }

  const result = await query<{ event_day: string }>(
    `
    SELECT DISTINCT
      date(datetime(replace(substr(event_at, 1, 19), 'T', ' '), '-3 hours'))
        AS event_day
    FROM cursor_token_usage_events
    WHERE upload_id = $1
  `,
    [previous.id],
  );
  const existingDays = new Set(
    result.rows.map((row) => String(row.event_day)),
  );
  const eventsToInsert = events.filter(
    (event) => !existingDays.has(tokenEventDayBrt(event.eventAt)),
  );

  return {
    previousUploadId: previous.id,
    eventsToInsert,
    ignoredCount: events.length - eventsToInsert.length,
  };
}

function copyTokenUsageSnapshot(
  sourceUploadId: number,
  targetUploadId: number,
): void {
  getDb()
    .prepare(
      `
      INSERT INTO cursor_token_usage_events (
        upload_id, event_at, user_email, cloud_agent_id, automation_id,
        kind, model, max_mode,
        input_cache_write, input_no_cache_write, cache_read,
        output_tokens, total_tokens, cost, cost_raw, cost_type
      )
      SELECT
        ?, event_at, user_email, cloud_agent_id, automation_id,
        kind, model, max_mode,
        input_cache_write, input_no_cache_write, cache_read,
        output_tokens, total_tokens, cost, cost_raw, cost_type
      FROM cursor_token_usage_events
      WHERE upload_id = ?
    `,
    )
    .run(targetUploadId, sourceUploadId);
}

export async function importMembersTokenUsageCsv(options: {
  filename: string;
  content: string;
  uploadedByEmail: string | null;
}): Promise<DataUploadLog> {
  await ensureSchema();

  const { sourceTeamId, cycleDate } = parseMembersTokenUsageFilename(
    options.filename,
  );
  let events: MembersTokenUsageEvent[];

  try {
    events = parseMembersTokenUsageCsv(options.content);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao ler CSV";
    const failed = await query<{ id: number }>(
      `
      INSERT INTO data_upload_logs (
        dataset, filename, uploaded_by_email, row_count, status,
        error_message, source_team_id, cycle_date, uploaded_at
      ) VALUES (
        'members_token_usage', $1, $2, 0, 'error',
        $3, $4, $5, datetime('now')
      )
      RETURNING id
    `,
      [
        options.filename,
        options.uploadedByEmail,
        message,
        sourceTeamId,
        cycleDate,
      ],
    );

    return {
      id: Number(failed.rows[0]?.id ?? 0),
      dataset: "members_token_usage",
      filename: options.filename,
      uploadedAt: new Date().toISOString(),
      uploadedByEmail: options.uploadedByEmail,
      rowCount: 0,
      status: "error",
      errorMessage: message,
      sourceTeamId,
      cycleDate,
      parsedRowCount: 0,
      ignoredRowCount: 0,
      usageCycleId: null,
    };
  }

  const incremental = await prepareIncrementalTokenEvents(
    events,
    sourceTeamId,
  );
  const created = await query<{ id: number }>(
    `
    INSERT INTO data_upload_logs (
      dataset, filename, uploaded_by_email, row_count, status,
      error_message, source_team_id, cycle_date, uploaded_at,
      parsed_row_count, ignored_row_count
    ) VALUES (
      'members_token_usage', $1, $2, $3, 'success',
      NULL, $4, $5, datetime('now'), $6, $7
    )
    RETURNING id
  `,
    [
      options.filename,
      options.uploadedByEmail,
      incremental.eventsToInsert.length,
      sourceTeamId,
      cycleDate,
      events.length,
      incremental.ignoredCount,
    ],
  );

  const uploadId = Number(created.rows[0]?.id);
  if (incremental.previousUploadId != null) {
    copyTokenUsageSnapshot(incremental.previousUploadId, uploadId);
  }
  insertTokenUsageEvents(uploadId, incremental.eventsToInsert);

  const latest = await query(
    `SELECT * FROM data_upload_logs WHERE id = $1`,
    [uploadId],
  );
  return mapLog(latest.rows[0] as Record<string, unknown>);
}
