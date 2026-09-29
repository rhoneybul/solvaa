const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");
const {
  connectionOptions,
  createDatabaseReadiness,
  readinessMiddleware,
} = require("../src/lib/migrations");

test("cold-start requests share initialization; successful warm requests do not rerun it", async () => {
  let calls = 0,
    finish;
  const ready = createDatabaseReadiness({
    env: { NODE_ENV: "production" },
    run: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const first = ready(),
    second = ready();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({ applied: ["003"] });
  await Promise.all([first, second]);
  await ready();
  assert.equal(calls, 1);
});

test("a failed boot blocks traffic, hides secrets and retries once after a cooldown", async (t) => {
  let clock = 0,
    calls = 0;
  const logs = [];
  const ready = createDatabaseReadiness({
    env: { VERCEL: "1" },
    now: () => clock,
    log: (...args) => logs.push(args),
    run: async () => {
      calls++;
      if (calls === 1)
        throw new Error("postgres://admin:SECRET@database/private");
      return { applied: [] };
    },
  });
  const app = express();
  app.use(readinessMiddleware(ready));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/health`;
  for (const response of await Promise.all([fetch(url), fetch(url)])) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "30");
    assert.doesNotMatch(await response.text(), /SECRET|postgres:/);
  }
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|postgres:/);
  clock = 30000;
  assert.equal((await fetch(url)).status, 200);
  assert.equal(calls, 2);
});

test("only unconfigured local development skips migrations", async () => {
  let calls = 0;
  const run = async ({ env }) => {
    calls++;
    connectionOptions(env);
  };
  const log = () => {};
  assert.deepEqual(await createDatabaseReadiness({ env: {}, run, log })(), {
    skipped: true,
  });
  assert.equal(calls, 0);
  for (const env of [{ VERCEL: "1" }, { NODE_ENV: "production" }]) {
    await assert.rejects(createDatabaseReadiness({ env, run, log })(), {
      code: "DATABASE_URL_MISSING",
    });
  }
  await createDatabaseReadiness({
    env: { DATABASE_URL: "postgresql://test@localhost/db" },
    run,
    log,
  })();
  assert.equal(calls, 3);
});

test("remote SQL connections verify TLS regardless of URL SSL overrides", () => {
  const options = connectionOptions({
    DATABASE_URL:
      "postgresql://postgres.ref:p%40ss@pooler.example:5432/postgres?sslmode=disable",
    DATABASE_CA_CERT: "line1\\nline2",
  });
  assert.equal(options.user, "postgres.ref");
  assert.equal(options.password, "p@ss");
  assert.deepEqual(options.ssl, {
    rejectUnauthorized: true,
    ca: "line1\nline2",
  });
  assert.equal(
    connectionOptions({ DATABASE_URL: "postgres://test@127.0.0.1/db" }).ssl,
    false,
  );
  assert.deepEqual(
    connectionOptions({
      DATABASE_URL: "postgres://test@localhost/db",
      VERCEL: "1",
    }).ssl,
    { rejectUnauthorized: true },
  );
  assert.throws(
    () => connectionOptions({ DATABASE_URL: "https://example.com" }),
    { code: "DATABASE_URL_INVALID" },
  );
});

test("standalone production refuses to listen without migration credentials", async () => {
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      [path.join(__dirname, "../src/index.js")],
      {
        timeout: 5000,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "",
          PORT: "0",
        },
      },
    ),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /DATABASE_URL_MISSING/);
      assert.doesNotMatch(error.stdout, /running on/);
      return true;
    },
  );
});
