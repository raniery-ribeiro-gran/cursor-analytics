import { ensureSchema, query } from "./sqlite";
import {
  getMembersUsageUploadForCycle,
  listMembersUsageCycles,
  type DataUploadLog,
} from "./dataUploadsDb";

export interface MembersUsageMember {
  name: string;
  email: string;
  role: string;
  seatType: string;
  includedUsage: number;
  freeUsage: number;
  freeUsageRaw: string;
  freeUsageCapped: boolean;
  onDemandUsage: number;
}

export interface MembersUsageSummary {
  members: number;
  includedTotal: number;
  freeTotal: number;
  onDemandTotal: number;
  freeCapped: number;
  withOnDemand: number;
  atIncludedCap: number;
  idle: number;
  seats: Record<string, number>;
  roles: Record<string, number>;
}

export interface MembersUsageCycleData {
  upload: DataUploadLog | null;
  summary: MembersUsageSummary | null;
  members: MembersUsageMember[];
  topOnDemand: MembersUsageMember[];
  cycles: DataUploadLog[];
}

function emptySummary(): MembersUsageSummary {
  return {
    members: 0,
    includedTotal: 0,
    freeTotal: 0,
    onDemandTotal: 0,
    freeCapped: 0,
    withOnDemand: 0,
    atIncludedCap: 0,
    idle: 0,
    seats: {},
    roles: {},
  };
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function mapMember(row: Record<string, unknown>): MembersUsageMember {
  return {
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? ""),
    seatType: String(row.seat_type ?? ""),
    includedUsage: money(row.included_usage),
    freeUsage: money(row.free_usage),
    freeUsageRaw: String(row.free_usage_raw ?? "0.00"),
    freeUsageCapped: Number(row.free_usage_capped ?? 0) === 1,
    onDemandUsage: money(row.on_demand_usage),
  };
}

export async function getMembersUsageCycleData(
  usageCycleId?: number,
): Promise<MembersUsageCycleData> {
  await ensureSchema();

  const cycles = await listMembersUsageCycles();
  const upload = await getMembersUsageUploadForCycle(usageCycleId);
  if (!upload) {
    return {
      upload: null,
      summary: null,
      members: [],
      topOnDemand: [],
      cycles,
    };
  }

  const aggResult = await query(
    `
    SELECT
      COUNT(*) AS members,
      COALESCE(SUM(included_usage), 0) AS included_total,
      COALESCE(SUM(free_usage), 0) AS free_total,
      COALESCE(SUM(on_demand_usage), 0) AS on_demand_total,
      COALESCE(SUM(CASE WHEN free_usage_capped = 1 THEN 1 ELSE 0 END), 0) AS free_capped,
      COALESCE(SUM(CASE WHEN on_demand_usage > 0 THEN 1 ELSE 0 END), 0) AS with_on_demand,
      COALESCE(SUM(CASE WHEN included_usage >= 20 THEN 1 ELSE 0 END), 0) AS at_included_cap,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(included_usage, 0) = 0
            AND COALESCE(on_demand_usage, 0) = 0
            AND COALESCE(free_usage, 0) = 0
          THEN 1 ELSE 0
        END
      ), 0) AS idle
    FROM cursor_members_usage
    WHERE upload_id = $1
  `,
    [upload.id],
  );

  const agg = (aggResult.rows[0] ?? {}) as Record<string, unknown>;
  const summary: MembersUsageSummary = {
    ...emptySummary(),
    members: Number(agg.members ?? 0),
    includedTotal: money(agg.included_total),
    freeTotal: money(agg.free_total),
    onDemandTotal: money(agg.on_demand_total),
    freeCapped: Number(agg.free_capped ?? 0),
    withOnDemand: Number(agg.with_on_demand ?? 0),
    atIncludedCap: Number(agg.at_included_cap ?? 0),
    idle: Number(agg.idle ?? 0),
  };

  const seatsResult = await query(
    `
    SELECT seat_type, COUNT(*) AS total
    FROM cursor_members_usage
    WHERE upload_id = $1
    GROUP BY seat_type
    ORDER BY total DESC
  `,
    [upload.id],
  );
  for (const row of seatsResult.rows as Record<string, unknown>[]) {
    const key = String(row.seat_type || "—");
    summary.seats[key] = Number(row.total ?? 0);
  }

  const rolesResult = await query(
    `
    SELECT role, COUNT(*) AS total
    FROM cursor_members_usage
    WHERE upload_id = $1
    GROUP BY role
    ORDER BY total DESC
  `,
    [upload.id],
  );
  for (const row of rolesResult.rows as Record<string, unknown>[]) {
    const key = String(row.role || "—");
    summary.roles[key] = Number(row.total ?? 0);
  }

  const membersResult = await query(
    `
    SELECT
      name, email, role, seat_type,
      included_usage, free_usage, free_usage_raw, free_usage_capped,
      on_demand_usage
    FROM cursor_members_usage
    WHERE upload_id = $1
    ORDER BY on_demand_usage DESC, included_usage DESC, name ASC
  `,
    [upload.id],
  );

  const members = (membersResult.rows as Record<string, unknown>[]).map(
    mapMember,
  );
  const topOnDemand = members
    .filter((member) => member.onDemandUsage > 0)
    .slice(0, 5);

  return { upload, summary, members, topOnDemand, cycles };
}
