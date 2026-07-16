import { CURSOR_DATASETS } from "./cursorDatasets";

export type TokenCostType = "dash" | "free" | "usd" | "unknown";

export interface MembersTokenUsageEvent {
  eventAt: string;
  userEmail: string;
  cloudAgentId: string;
  automationId: string;
  kind: string;
  model: string;
  maxMode: boolean;
  inputCacheWrite: number | null;
  inputNoCacheWrite: number | null;
  cacheRead: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  costRaw: string;
  costType: TokenCostType;
}

export interface MembersTokenUsageFilenameMeta {
  sourceTeamId: string | null;
  cycleDate: string | null;
}

export function parseMembersTokenUsageFilename(
  filename: string,
): MembersTokenUsageFilenameMeta {
  const match = filename.match(
    /team-usage-events-(\d+)-(\d{4}-\d{2}-\d{2})/i,
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

function parseOptionalNumber(rawInput: string): number | null {
  const raw = (rawInput ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/[$,\s]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseTokenCost(rawInput: string): {
  value: number | null;
  raw: string;
  type: TokenCostType;
} {
  const raw = (rawInput ?? "").trim();
  if (!raw) return { value: null, raw: "", type: "unknown" };
  if (raw === "-") return { value: null, raw, type: "dash" };
  if (/^free$/i.test(raw)) return { value: 0, raw, type: "free" };
  const value = parseOptionalNumber(raw);
  if (value !== null) return { value, raw, type: "usd" };
  return { value: null, raw, type: "unknown" };
}

export function parseMembersTokenUsageCsv(
  content: string,
): MembersTokenUsageEvent[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV vazio ou sem dados");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const expected = CURSOR_DATASETS.members_token_usage.expectedHeaders;
  const missing = expected.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(
      `Cabeçalhos esperados não encontrados: ${missing.join(", ")}`,
    );
  }

  const indexOf = (name: string) => headers.indexOf(name);
  const events: MembersTokenUsageEvent[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const userEmail = (cols[indexOf("User")] ?? "").trim().toLowerCase();
    const eventAt = (cols[indexOf("Date")] ?? "").trim();
    if (!userEmail && !eventAt) continue;
    if (!userEmail) {
      throw new Error(`Linha sem usuário: ${line.slice(0, 60)}`);
    }
    if (!eventAt) {
      throw new Error(`Linha sem data: ${userEmail}`);
    }

    const cost = parseTokenCost(cols[indexOf("Cost")] ?? "");
    const maxModeRaw = (cols[indexOf("Max Mode")] ?? "").trim().toLowerCase();

    events.push({
      eventAt,
      userEmail,
      cloudAgentId: (cols[indexOf("Cloud Agent ID")] ?? "").trim(),
      automationId: (cols[indexOf("Automation ID")] ?? "").trim(),
      kind: (cols[indexOf("Kind")] ?? "").trim(),
      model: (cols[indexOf("Model")] ?? "").trim(),
      maxMode: maxModeRaw === "yes" || maxModeRaw === "true" || maxModeRaw === "1",
      inputCacheWrite: parseOptionalNumber(
        cols[indexOf("Input (w/ Cache Write)")] ?? "",
      ),
      inputNoCacheWrite: parseOptionalNumber(
        cols[indexOf("Input (w/o Cache Write)")] ?? "",
      ),
      cacheRead: parseOptionalNumber(cols[indexOf("Cache Read")] ?? ""),
      outputTokens: parseOptionalNumber(cols[indexOf("Output Tokens")] ?? ""),
      totalTokens: parseOptionalNumber(cols[indexOf("Total Tokens")] ?? ""),
      cost: cost.value,
      costRaw: cost.raw,
      costType: cost.type,
    });
  }

  if (events.length === 0) {
    throw new Error("Nenhuma linha válida no CSV");
  }

  return events;
}
