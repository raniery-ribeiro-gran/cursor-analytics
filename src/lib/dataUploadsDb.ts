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
    };
  }

  const created = await query<{ id: number }>(
    `
    INSERT INTO data_upload_logs (
      dataset, filename, uploaded_by_email, row_count, status,
      error_message, source_team_id, cycle_date, uploaded_at
    ) VALUES (
      'members_usage', $1, $2, $3, 'success',
      NULL, $4, $5, datetime('now')
    )
    RETURNING id
  `,
    [
      options.filename,
      options.uploadedByEmail,
      rows.length,
      sourceTeamId,
      cycleDate,
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
    };
  }

  const created = await query<{ id: number }>(
    `
    INSERT INTO data_upload_logs (
      dataset, filename, uploaded_by_email, row_count, status,
      error_message, source_team_id, cycle_date, uploaded_at
    ) VALUES (
      'members_token_usage', $1, $2, $3, 'success',
      NULL, $4, $5, datetime('now')
    )
    RETURNING id
  `,
    [
      options.filename,
      options.uploadedByEmail,
      events.length,
      sourceTeamId,
      cycleDate,
    ],
  );

  const uploadId = Number(created.rows[0]?.id);
  insertTokenUsageEvents(uploadId, events);

  const latest = await query(
    `SELECT * FROM data_upload_logs WHERE id = $1`,
    [uploadId],
  );
  return mapLog(latest.rows[0] as Record<string, unknown>);
}
