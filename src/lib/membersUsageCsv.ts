import { CURSOR_DATASETS } from "./cursorDatasets";

export interface ParsedUsageAmount {
  value: number | null;
  raw: string;
  capped: boolean;
}

export interface MembersUsageRow {
  name: string;
  email: string;
  role: string;
  seatType: string;
  includedUsage: ParsedUsageAmount;
  freeUsage: ParsedUsageAmount;
  onDemandUsage: ParsedUsageAmount;
}

export interface MembersUsageFilenameMeta {
  sourceTeamId: string | null;
  cycleDate: string | null;
}

export function parseUsageAmount(rawInput: string): ParsedUsageAmount {
  const raw = (rawInput ?? "").trim();
  if (!raw) {
    return { value: null, raw: "", capped: false };
  }

  // Ex.: "$20+" = teto/unknown no painel Cursor
  if (/\$?\d+(\.\d+)?\+$/i.test(raw) || /\+$/.test(raw)) {
    const numeric = raw.replace(/[^0-9.]/g, "");
    return {
      value: numeric ? Number(numeric) : null,
      raw,
      capped: true,
    };
  }

  const normalized = raw.replace(/[$,\s]/g, "");
  const value = Number(normalized);
  if (Number.isFinite(value)) {
    return { value, raw, capped: false };
  }

  return { value: null, raw, capped: false };
}

export function parseMembersUsageFilename(
  filename: string,
): MembersUsageFilenameMeta {
  const match = filename.match(
    /team-members-(\d+)-(\d{4}-\d{2}-\d{2})/i,
  );
  if (!match) {
    return { sourceTeamId: null, cycleDate: null };
  }
  return {
    sourceTeamId: match[1] ?? null,
    cycleDate: match[2] ?? null,
  };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

export function parseMembersUsageCsv(content: string): MembersUsageRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV vazio ou sem dados");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const expected = CURSOR_DATASETS.members_usage.expectedHeaders;
  const missing = expected.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(
      `Cabeçalhos esperados não encontrados: ${missing.join(", ")}`,
    );
  }

  const indexOf = (name: string) => headers.indexOf(name);

  const rows: MembersUsageRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const email = (cols[indexOf("Email")] ?? "").trim().toLowerCase();
    const name = (cols[indexOf("Name")] ?? "").trim();
    if (!email && !name) continue;
    if (!email) {
      throw new Error(`Linha sem e-mail: ${name || line.slice(0, 40)}`);
    }

    rows.push({
      name: name || email,
      email,
      role: (cols[indexOf("Role")] ?? "").trim(),
      seatType: (cols[indexOf("Seat Type")] ?? "").trim(),
      includedUsage: parseUsageAmount(cols[indexOf("Included Usage")] ?? ""),
      freeUsage: parseUsageAmount(cols[indexOf("Free Usage")] ?? ""),
      onDemandUsage: parseUsageAmount(cols[indexOf("On-Demand Usage")] ?? ""),
    });
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma linha válida no CSV");
  }

  return rows;
}
