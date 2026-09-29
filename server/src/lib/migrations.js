const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { Client } = require("pg");

const migrationDirectory = path.join(__dirname, "../../supabase/migrations");
const STARTUP_TIMEOUT_MS = 15000;

function migrationError(code) {
  return Object.assign(new Error("Database initialization failed."), { code });
}

function connectionOptions(env = process.env) {
  if (!env.DATABASE_URL) throw migrationError("DATABASE_URL_MISSING");
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw migrationError("DATABASE_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
    throw migrationError("DATABASE_URL_INVALID");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const production = env.NODE_ENV === "production" || env.VERCEL === "1";
  const ssl =
    local && !production
      ? false
      : {
          rejectUnauthorized: true,
          ...(env.DATABASE_CA_CERT
            ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, "\n") }
            : {}),
        };
  // Parse fields ourselves: pg connection-string SSL options can override TLS verification.
  return {
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1) || "postgres"),
    ssl,
    application_name: "solvaa-migrations",
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    query_timeout: 12000,
  };
}

async function loadMigrations(directory = migrationDirectory) {
  // An explicit manifest excludes historical native-app migrations 001/002.
  const filenames = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  if (!Array.isArray(filenames) || !filenames.length)
    throw migrationError("MIGRATION_MANIFEST_INVALID");
  let previous = 0;
  const migrations = [];
  for (const filename of filenames) {
    if (
      typeof filename !== "string" ||
      !/^\d{3}_[a-z0-9_]+\.sql$/.test(filename)
    )
      throw migrationError("MIGRATION_MANIFEST_INVALID");
    const version = Number(filename.slice(0, 3));
    if (version <= previous) throw migrationError("MIGRATION_MANIFEST_INVALID");
    previous = version;
    const sql = await readFile(path.join(directory, filename), "utf8");
    migrations.push({
      filename,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  return migrations;
}

async function runMigrations({
  env = process.env,
  directory = migrationDirectory,
} = {}) {
  const migrations = await loadMigrations(directory);
  const client = new Client(connectionOptions(env));
  let failure,
    timedOut = false;
  // Covers connection, lock waits and the complete batch, not just one statement.
  const timeout = setTimeout(() => {
    timedOut = true;
    void client.end().catch(() => {});
  }, STARTUP_TIMEOUT_MS);
  client.on("error", () => {}); // Query/connect rejection is handled below; never log credentials.
  const applied = [];
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    // Transaction lock serializes cold starts, including creation of the ledger itself.
    await client.query("SELECT pg_advisory_xact_lock(72461824)");
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS solvaa_internal;
      REVOKE ALL ON SCHEMA solvaa_internal FROM PUBLIC, anon, authenticated;
      CREATE TABLE IF NOT EXISTS solvaa_internal.schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      REVOKE ALL ON solvaa_internal.schema_migrations FROM PUBLIC, anon, authenticated;
    `);
    const { rows } = await client.query(
      "SELECT filename, checksum FROM solvaa_internal.schema_migrations",
    );
    const existing = new Map(rows.map((row) => [row.filename, row.checksum]));
    const lastVersion = Number(migrations.at(-1).filename.slice(0, 3));
    const names = new Set(migrations.map((migration) => migration.filename));
    // Older releases may coexist with newer migrations, but known history cannot disappear.
    for (const row of rows) {
      if (
        Number(row.filename.slice(0, 3)) <= lastVersion &&
        !names.has(row.filename)
      )
        throw migrationError("MIGRATION_HISTORY_MISMATCH");
    }
    const appliedVersion = Math.max(
      0,
      ...rows.map((row) => Number(row.filename.slice(0, 3))),
    );
    // Check all known history before applying anything from the new release.
    for (const migration of migrations) {
      if (
        existing.has(migration.filename) &&
        existing.get(migration.filename) !== migration.checksum
      )
        throw migrationError("MIGRATION_CHECKSUM_MISMATCH");
    }
    for (const migration of migrations) {
      if (existing.has(migration.filename)) continue;
      if (Number(migration.filename.slice(0, 3)) <= appliedVersion)
        throw migrationError("MIGRATION_ORDER_MISMATCH");
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO solvaa_internal.schema_migrations (filename, checksum) VALUES ($1, $2)",
        [migration.filename, migration.checksum],
      );
      applied.push(migration.filename);
    }
    if (applied.length) await client.query("NOTIFY pgrst, 'reload schema'");
    await client.query("COMMIT");
  } catch (error) {
    failure = error;
    // Ending the connection also rolls back if the timeout interrupted the query.
    if (!timedOut) await client.query("ROLLBACK").catch(() => {});
  } finally {
    clearTimeout(timeout);
    await client.end().catch(() => {});
  }
  if (timedOut) throw migrationError("MIGRATION_TIMEOUT");
  if (failure) throw failure;
  return { applied };
}

function createDatabaseReadiness({
  env = process.env,
  run = runMigrations,
  now = Date.now,
  log = console.error,
} = {}) {
  let pending,
    retryAt = 0;
  return function ensureReady() {
    // Keep the existing offline local preview; configured and production APIs must migrate.
    if (
      !env.DATABASE_URL &&
      env.NODE_ENV !== "production" &&
      env.VERCEL !== "1"
    )
      return Promise.resolve({ skipped: true });
    if (!pending || (retryAt && now() >= retryAt)) {
      retryAt = 0;
      pending = Promise.resolve()
        .then(() => run({ env }))
        .catch((error) => {
          retryAt = now() + 30000;
          const code = /^[A-Z0-9_]{3,40}$/.test(error?.code || "")
            ? error.code
            : "MIGRATION_FAILED";
          log("Database initialization failed:", code);
          throw error;
        });
    }
    return pending;
  };
}

function readinessMiddleware(ensureReady) {
  return async (_req, res, next) => {
    try {
      await ensureReady();
      next();
    } catch {
      res.set("Retry-After", "30").status(503).json({
        error: "The database is not ready yet. Please try again shortly.",
      });
    }
  };
}

const ensureDatabaseReady = createDatabaseReadiness();
module.exports = {
  connectionOptions,
  loadMigrations,
  runMigrations,
  createDatabaseReadiness,
  readinessMiddleware,
  ensureDatabaseReady,
};
