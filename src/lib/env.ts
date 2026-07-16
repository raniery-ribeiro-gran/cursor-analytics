import fs from "fs";
import path from "path";

let cachedFileEnv: Record<string, string> | null = null;
let cachedMtimeMs = 0;

function envFilePath(): string {
  return path.join(process.cwd(), ".env");
}

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    vars[key] = value;
  }

  return vars;
}

function readEnvFile(): Record<string, string> {
  const filePath = envFilePath();

  if (!fs.existsSync(filePath)) {
    return {};
  }

  const stat = fs.statSync(filePath);
  if (cachedFileEnv && cachedMtimeMs === stat.mtimeMs) {
    return cachedFileEnv;
  }

  cachedFileEnv = parseEnvFile(envFilePath());
  cachedMtimeMs = stat.mtimeMs;
  return cachedFileEnv;
}

/**
 * Lê variáveis do `.env` no disco (prioridade) e cai para `process.env`.
 * Em dev com volume montado, evita ficar preso a valores antigos do container.
 */
export function getEnv(key: string): string | undefined {
  const fromFile = readEnvFile()[key];
  if (fromFile !== undefined && fromFile !== "") {
    return fromFile;
  }

  return process.env[key];
}

export function invalidateEnvCache(): void {
  cachedFileEnv = null;
  cachedMtimeMs = 0;
}
