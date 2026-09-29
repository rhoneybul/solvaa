// Explicit integration run: node --test server/test/ai-quota-postgres.integration.js
// Requires local PostgreSQL binaries. Creates an isolated, temporary cluster.
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const net = require("node:net");
const run = promisify(execFile);

test("PostgreSQL migration enforces durable atomic AI budgets and private account storage", async (t) => {
  let sql, restart;
  const context = process.env.SOLVAA_TEST_DOCKER;
  if (context) {
    const docker = (...args) =>
      run("docker", ["--context", context, ...args], {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 120000,
      });
    const name = `solvaa-quota-test-${process.pid}`;
    await docker(
      "run",
      "--rm",
      "-d",
      "--network",
      "none",
      "--name",
      name,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    );
    t.after(() => docker("rm", "-fv", name));
    async function ready() {
      for (let attempt = 0; attempt < 40; attempt++) {
        try {
          await docker("exec", name, "pg_isready", "-U", "postgres");
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      throw Error("Temporary PostgreSQL did not become ready");
    }
    await ready();
    sql = async (query) =>
      (
        await docker(
          "exec",
          name,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-X",
          "-At",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          query,
        )
      ).stdout.trim();
    restart = async () => {
      await docker("restart", name);
      await ready();
    };
  } else {
    const directory = await mkdtemp(path.join(tmpdir(), "solvaa-quota-"));
    const data = path.join(directory, "data");
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    let started = false;
    t.after(async () => {
      if (started)
        await run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
      await rm(directory, { recursive: true, force: true });
    });
    await run("initdb", [
      "-D",
      data,
      "-A",
      "trust",
      "--no-locale",
      "-U",
      "solvaa_test",
    ]);
    await run("pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -k ${directory}`,
      "-w",
      "start",
    ]);
    started = true;
    sql = async (query) =>
      (
        await run("psql", [
          "-h",
          "127.0.0.1",
          "-p",
          String(port),
          "-U",
          "solvaa_test",
          "-d",
          "postgres",
          "-X",
          "-At",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          query,
        ])
      ).stdout.trim();
    restart = () =>
      run("pg_ctl", [
        "-D",
        data,
        "-w",
        "restart",
        "-l",
        path.join(directory, "postgres.log"),
      ]);
  }
  await sql(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);",
  );
  await sql(
    await readFile(
      path.join(
        __dirname,
        "../supabase/migrations/003_web_accounts_and_ai_budget.sql",
      ),
      "utf8",
    ),
  );
  const id = (index) =>
    `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;
  const quota = (
    user,
    {
      ip = "ip",
      ud = 3,
      um = 10,
      ipd = 10,
      gd = 20,
      gm = 100,
      cooldown = 60,
    } = {},
  ) =>
    sql(
      `select public.consume_ai_quota('${id(user)}','${ip}',${ud},${um},${ipd},${gd},${gm},${cooldown});`,
    ).then(JSON.parse);
  assert.equal((await quota(1)).allowed, true);
  assert.equal((await quota(1)).allowed, false, "cooldown is durable");
  await restart();
  assert.equal(
    (await quota(1)).allowed,
    false,
    "restart must not clear the quota",
  );
  await sql("truncate public.ai_usage_events");
  const concurrent = await Promise.all(
    Array.from({ length: 12 }, (_, index) => quota(index + 1, { gd: 3 })),
  );
  assert.equal(
    concurrent.filter((row) => row.allowed).length,
    3,
    "global cap cannot be raced",
  );
  assert.equal(await sql("select count(*) from public.ai_usage_events"), "3");
  await sql("truncate public.ai_usage_events");
  const sameUser = await Promise.all(Array.from({ length: 8 }, () => quota(1)));
  assert.equal(
    sameUser.filter((row) => row.allowed).length,
    1,
    "same-user simultaneous requests obey cooldown",
  );
  await sql("truncate public.ai_usage_events");
  assert.equal((await quota(1, { ipd: 1 })).allowed, true);
  assert.equal(
    (await quota(2, { ipd: 1 })).allowed,
    false,
    "IP cap applies across accounts",
  );
  await sql(
    `truncate public.ai_usage_events; insert into public.ai_usage_events(user_id,ip_hash,created_at) select '${id(1)}','other',clock_timestamp()-interval '2 minutes' from generate_series(1,3);`,
  );
  assert.equal((await quota(1)).allowed, false, "user daily cap");
  await sql("truncate public.ai_usage_events");
  assert.equal((await quota(1, { gm: 1 })).allowed, true);
  assert.equal(
    (await quota(2, { gm: 1 })).allowed,
    false,
    "global monthly cap",
  );
  await sql(
    `truncate public.ai_usage_events; insert into public.ai_usage_events(user_id,ip_hash,created_at) values('${id(1)}','other',clock_timestamp()-interval '2 minutes');`,
  );
  assert.equal((await quota(1, { um: 1 })).allowed, false, "user monthly cap");
  await assert.rejects(
    () =>
      sql(
        `set role authenticated; select public.consume_ai_quota('${id(1)}','ip',3,10,10,20,100,60);`,
      ),
    /permission denied/,
  );
  await assert.rejects(
    () => sql("set role anon; select * from public.web_workspaces"),
    /permission denied/,
  );
  await assert.rejects(
    () => sql("set role authenticated; select * from public.ai_usage_events"),
    /permission denied/,
  );
  await sql(
    `insert into auth.users values('${id(1)}'),('${id(2)}'); insert into public.web_workspaces(user_id,payload) values('${id(1)}','{"profile":{"name":"A"}}'),('${id(2)}','{"profile":{"name":"B"}}');`,
  );
  assert.equal(
    await sql(
      `update public.web_workspaces set revision=2 where user_id='${id(1)}' and revision=1 returning user_id`,
    ),
    `${id(1)}\nUPDATE 1`,
  );
  assert.equal(
    await sql(
      `update public.web_workspaces set revision=3 where user_id='${id(1)}' and revision=1 returning user_id`,
    ),
    "UPDATE 0",
    "stale writes conflict",
  );
  assert.equal(
    await sql(
      `select payload->'profile'->>'name' from public.web_workspaces where user_id='${id(2)}'`,
    ),
    "B",
  );
});
