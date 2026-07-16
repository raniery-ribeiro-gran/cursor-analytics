import {
  type OrganogramEntry,
  OrganogramIndex,
} from "./organogram";
import { ensureSchema, query } from "./sqlite";

let cachedIndex: OrganogramIndex | null = null;

function mapTechRow(record: Record<string, unknown>): OrganogramEntry {
  const tribe = String(record.tribe ?? "");
  const leaderName = String(record.leaderName ?? "");
  const leaderEmail = String(record.leaderEmail ?? "");

  return {
    level: 0,
    name: String(record.name ?? ""),
    email: String(record.email ?? ""),
    department: tribe,
    managerName: leaderName,
    managerEmail: leaderEmail,
    roleTitle: String(record.roleTitle ?? ""),
    tribe,
    legacyManagerName: String(record.legacyManagerName ?? ""),
  };
}

/** Garante schema/migrations aplicadas (seed do organograma vem da migration). */
export async function ensureOrganogramLoaded(): Promise<void> {
  await ensureSchema();
}

export async function getOrganogramIndex(): Promise<OrganogramIndex> {
  if (cachedIndex) return cachedIndex;

  await ensureOrganogramLoaded();

  const result = await query(
    `
    SELECT
      email,
      name,
      role_title AS roleTitle,
      leader_name AS leaderName,
      leader_email AS leaderEmail,
      tribe,
      legacy_manager_name AS legacyManagerName
    FROM tech_organogram
    ORDER BY tribe ASC, name ASC
  `,
  );

  const rows = result.rows.map((row) =>
    mapTechRow(row as Record<string, unknown>),
  );

  cachedIndex = new OrganogramIndex(rows);
  return cachedIndex;
}

export async function findPersonByEmail(
  email: string,
): Promise<OrganogramEntry | null> {
  const index = await getOrganogramIndex();
  return index.findByEmail(email);
}

export async function listTechOrganogram(): Promise<OrganogramEntry[]> {
  const index = await getOrganogramIndex();
  return index.all();
}

export function clearOrganogramCache(): void {
  cachedIndex = null;
}
