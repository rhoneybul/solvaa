const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { Client } = require("pg");
const { runMigrations, connectionOptions } = require("../src/lib/migrations");
const { temporaryPostgres } = require("./helpers/postgres");

test("real startup migrations serialize, preserve data, roll back failures and detect changed history", async (t) => {
  const clients = [];
  t.after(async () => {
    for (const client of clients) await client.end().catch(() => {});
  });
  const env = await temporaryPostgres(t);
  const client = new Client(connectionOptions(env));
  clients.push(client);
  await client.connect();
  const sql = (query) => client.query(query);
  await sql(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)",
  );
  const starts = await Promise.all(
    Array.from({ length: 6 }, () => runMigrations({ env })),
  );
  assert.equal(
    starts.reduce((count, result) => count + result.applied.length, 0),
    1,
  );
  assert.equal(
    (await sql("SELECT count(*)::int n FROM solvaa_internal.schema_migrations"))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await sql("SELECT to_regclass('public.profiles') AS legacy")).rows[0]
      .legacy,
    null,
  );
  await assert.rejects(
    sql(
      "SET ROLE authenticated; SELECT * FROM solvaa_internal.schema_migrations",
    ),
    /permission denied/,
  );
  await sql("RESET ROLE");
  await assert.rejects(
    sql("SET ROLE anon; SELECT * FROM public.web_workspaces"),
    /permission denied/,
  );
  await sql("RESET ROLE");
  const user = "00000000-0000-0000-0000-000000000001";
  await sql(
    `INSERT INTO auth.users VALUES ('${user}'); INSERT INTO public.web_workspaces(user_id,payload,revision) VALUES ('${user}','{"profile":{"name":"Keep me"}}',7)`,
  );
  assert.deepEqual((await runMigrations({ env })).applied, []);

  const directory = await mkdtemp(
    path.join(tmpdir(), "solvaa-migrations-fixture-"),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseline = "003_web_accounts_and_ai_budget.sql";
  const original = await readFile(
    path.join(__dirname, "../supabase/migrations", baseline),
    "utf8",
  );
  await writeFile(path.join(directory, baseline), original);
  const manifest = [baseline, "004_first_change.sql", "005_second_change.sql"];
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  await writeFile(
    path.join(directory, manifest[1]),
    "CREATE TABLE public.migration_probe(id integer); INSERT INTO public.migration_probe VALUES (1)",
  );
  await writeFile(
    path.join(directory, manifest[2]),
    "INSERT INTO public.migration_probe VALUES (2); SELECT * FROM intentionally_missing_table",
  );
  await assert.rejects(
    runMigrations({ env, directory }),
    /intentionally_missing_table/,
  );
  assert.equal(
    (await sql("SELECT to_regclass('public.migration_probe') AS probe")).rows[0]
      .probe,
    null,
    "whole pending batch rolls back",
  );
  assert.equal(
    (await sql("SELECT count(*)::int n FROM solvaa_internal.schema_migrations"))
      .rows[0].n,
    1,
  );
  await writeFile(
    path.join(directory, manifest[2]),
    "INSERT INTO public.migration_probe VALUES (2)",
  );
  const retried = await Promise.all(
    Array.from({ length: 6 }, () => runMigrations({ env, directory })),
  );
  assert.equal(
    retried.reduce((count, result) => count + result.applied.length, 0),
    2,
  );
  assert.deepEqual(
    (await sql("SELECT id FROM public.migration_probe ORDER BY id")).rows,
    [{ id: 1 }, { id: 2 }],
  );
  await writeFile(
    path.join(directory, baseline),
    original + "\n-- changed history",
  );
  await assert.rejects(runMigrations({ env, directory }), {
    code: "MIGRATION_CHECKSUM_MISMATCH",
  });
  await writeFile(path.join(directory, baseline), original);
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify([baseline, manifest[2]]),
  );
  await assert.rejects(runMigrations({ env, directory }), {
    code: "MIGRATION_HISTORY_MISMATCH",
  });
  assert.equal(
    (await sql("SELECT revision FROM public.web_workspaces")).rows[0].revision,
    7,
  );

  await sql("BEGIN; SELECT pg_advisory_xact_lock(72461824)");
  await assert.rejects(runMigrations({ env }), { code: "55P03" });
  await sql("ROLLBACK");
  assert.deepEqual(
    (await runMigrations({ env })).applied,
    [],
    "lock failure is retryable without replaying SQL",
  );

  // Simulate a project where 003 was already applied by hand before this runner existed.
  await sql("CREATE DATABASE manually_migrated");
  const manualEnv = {
    ...env,
    DATABASE_URL: env.DATABASE_URL.replace(/\/postgres$/, "/manually_migrated"),
  };
  const manual = new Client(connectionOptions(manualEnv));
  clients.push(manual);
  await manual.connect();
  await manual.query(
    "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)",
  );
  await manual.query(original);
  await manual.query(
    `INSERT INTO auth.users VALUES ('${user}'); INSERT INTO public.web_workspaces(user_id,revision) VALUES ('${user}',9)`,
  );
  assert.deepEqual((await runMigrations({ env: manualEnv })).applied, [
    baseline,
  ]);
  assert.equal(
    (await manual.query("SELECT revision FROM public.web_workspaces")).rows[0]
      .revision,
    9,
  );

  // The actual Vercel entrypoint must await a fresh database before reporting healthy.
  await sql("CREATE DATABASE api_boot");
  const apiEnv = {
    ...env,
    DATABASE_URL: env.DATABASE_URL.replace(/\/postgres$/, "/api_boot"),
  };
  const apiDb = new Client(connectionOptions(apiEnv));
  clients.push(apiDb);
  await apiDb.connect();
  await apiDb.query(
    "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)",
  );
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = apiEnv.DATABASE_URL;
  const app = require("../../api/index.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`,
    );
    assert.equal(response.status, 200);
    assert.equal(
      (
        await apiDb.query(
          "SELECT count(*)::int n FROM solvaa_internal.schema_migrations",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
