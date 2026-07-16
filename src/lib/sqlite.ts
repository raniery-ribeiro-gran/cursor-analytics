import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getEnv } from "./env";

export type SqliteRow = Record<string, unknown>;

export interface QueryResult<T extends SqliteRow = SqliteRow> {
  rows: T[];
  rowCount: number;
}

const globalForSqlite = globalThis as typeof globalThis & {
  __sqliteDb?: Database.Database;
  __sqliteSchemaReady?: Promise<void>;
};

let dbInstance: Database.Database | null = null;
let schemaReady: Promise<void> | null = null;

export function getSqlitePath(): string {
  return (
    getEnv("SQLITE_PATH") ??
    path.join(process.cwd(), "data", "cursor-analytics.db")
  );
}

function convertPgPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?");
}

function createDb(): Database.Database {
  const sqlitePath = getSqlitePath();
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDb(): Database.Database {
  if (process.env.NODE_ENV !== "production") {
    if (!globalForSqlite.__sqliteDb) {
      globalForSqlite.__sqliteDb = createDb();
    }
    return globalForSqlite.__sqliteDb;
  }

  if (!dbInstance) {
    dbInstance = createDb();
  }
  return dbInstance;
}

export async function query<T extends SqliteRow = SqliteRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  await ensureSchema();
  const sql = convertPgPlaceholders(text);
  const stmt = getDb().prepare(sql);

  if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
    const rows = stmt.all(...params) as T[];
    return { rows, rowCount: rows.length };
  }

  const info = stmt.run(...params);
  return { rows: [], rowCount: info.changes };
}

export async function withTransaction<T>(fn: (db: Database.Database) => T): Promise<T> {
  await ensureSchema();
  const db = getDb();
  return db.transaction(() => fn(db))();
}

function schemaAlreadyExists(): boolean {
  const row = getDb()
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_metadata'`,
    )
    .get() as { name?: string } | undefined;
  return Boolean(row?.name);
}

async function runMigrations(): Promise<void> {
  const db = getDb();

  if (!schemaAlreadyExists()) {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "001_initial_schema.sql",
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Arquivo de migration não encontrado: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    db.exec(sql);
  }

  await runPendingMigrations();
}

async function runPendingMigrations(): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && file !== "001_initial_schema.sql")
    .sort();

  const db = getDb();

  for (const file of files) {
    const key = `schema_migration:${file}`;
    const applied = db
      .prepare(`SELECT 1 AS exists_flag FROM app_metadata WHERE key = ?`)
      .get(key) as { exists_flag?: number } | undefined;
    if (applied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare(
      `INSERT INTO app_metadata (key, value) VALUES (?, 'applied') ON CONFLICT(key) DO NOTHING`,
    ).run(key);
  }
}

export async function ensureSchema(): Promise<void> {
  // Primeira carga aplica 001 + pendentes; chamadas seguintes
  // reavaliam pendentes (ex.: migration adicionada com o server já no ar).
  if (process.env.NODE_ENV !== "production") {
    if (!globalForSqlite.__sqliteSchemaReady) {
      globalForSqlite.__sqliteSchemaReady = runMigrations();
    }
    await globalForSqlite.__sqliteSchemaReady;
    await runPendingMigrations();
    return;
  }

  if (!schemaReady) {
    schemaReady = runMigrations();
  }
  await schemaReady;
  await runPendingMigrations();
}

export async function closeDb(): Promise<void> {
  const active =
    process.env.NODE_ENV !== "production"
      ? globalForSqlite.__sqliteDb
      : dbInstance;

  if (active) {
    active.close();
  }

  dbInstance = null;
  schemaReady = null;
  globalForSqlite.__sqliteDb = undefined;
  globalForSqlite.__sqliteSchemaReady = undefined;
}
