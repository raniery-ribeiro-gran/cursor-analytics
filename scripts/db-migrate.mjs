import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const sqlitePath =
  process.env.SQLITE_PATH ?? path.join(root, "data", "cursor-analytics.db");
const migrationsDir = path.join(root, "supabase", "migrations");

fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
const db = new Database(sqlitePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function migrationApplied(key) {
  try {
    const row = db
      .prepare(`SELECT 1 AS ok FROM app_metadata WHERE key = ?`)
      .get(key);
    return Boolean(row);
  } catch {
    return false;
  }
}

function markMigrationApplied(key) {
  db.prepare(
    `INSERT INTO app_metadata (key, value) VALUES (?, 'applied') ON CONFLICT(key) DO NOTHING`,
  ).run(key);
}

try {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const key = `schema_migration:${file}`;
    if (file !== "001_initial_schema.sql" && migrationApplied(key)) {
      console.log(`Skip ${file} (já aplicada).`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    if (file !== "001_initial_schema.sql") {
      markMigrationApplied(key);
    }
    console.log(`Migration aplicada: ${file}`);
  }

  console.log(`SQLite pronto em ${sqlitePath}`);
} catch (error) {
  console.error("Falha ao aplicar migrations:", error);
  process.exitCode = 1;
} finally {
  db.close();
}
