const test = require("node:test");
const assert = require("node:assert/strict");
const { createAiGuard, callAi, limits } = require("../src/lib/ai");
const {
  validateScreenshot,
  normalizeReading,
} = require("../src/routes/onboarding");
const { validateWorkspace } = require("../src/routes/account");

const verified = {
  id: "00000000-0000-0000-0000-000000000001",
  email_confirmed_at: "2026-09-28",
};
async function guarded({
  user = verified,
  enabled = true,
  result = { data: { allowed: true } },
  throws = false,
} = {}) {
  let calls = 0,
    next = 0,
    args;
  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
  };
  await createAiGuard({
    enabled: () => enabled,
    database: {
      async rpc(name, parameters) {
        calls++;
        args = { name, parameters };
        if (throws) throw Error("offline");
        return result;
      },
    },
  })({ user, ip: "192.0.2.5" }, res, () => next++);
  return { calls, next, args, res };
}
test("AI never reaches the provider for guests, unverified accounts, or disabled AI", async () => {
  for (const [options, status] of [
    [{ user: null }, 401],
    [{ user: { id: verified.id } }, 403],
    [{ enabled: false }, 503],
  ]) {
    const outcome = await guarded(options);
    assert.equal(outcome.res.statusCode, status);
    assert.equal(outcome.calls, 0);
    assert.equal(outcome.next, 0);
  }
});
test("AI reserves durable shared quotas using a hashed IP before continuing", async () => {
  const outcome = await guarded();
  assert.equal(outcome.next, 1);
  assert.equal(outcome.calls, 1);
  assert.equal(outcome.args.name, "consume_ai_quota");
  assert.equal(outcome.args.parameters.p_user, verified.id);
  assert.match(outcome.args.parameters.p_ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(outcome.args.parameters.p_global_month, limits().globalMonth);
});
test("exhaustion returns retry information; missing or failed quotas always block paid calls", async () => {
  const denied = await guarded({
    result: { data: { allowed: false, retryAfter: 120 } },
  });
  assert.equal(denied.res.statusCode, 429);
  assert.equal(denied.res.headers["Retry-After"], "120");
  assert.equal(denied.next, 0);
  for (const options of [
    { result: { data: null } },
    { result: { data: { allowed: true }, error: { message: "fail" } } },
    { throws: true },
  ]) {
    const outcome = await guarded(options);
    assert.equal(outcome.res.statusCode, 503);
    assert.equal(outcome.next, 0);
  }
});
test("paid request has bounded output and provider errors are not automatically retried", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      callAi(
        "system",
        [{ role: "user", content: "question" }],
        async (url, options) => {
          calls++;
          assert.equal(JSON.parse(options.body).max_tokens, 768);
          return { ok: false };
        },
      ),
    /unavailable/,
  );
  assert.equal(calls, 1);
});
test("screenshot reader rejects excess input and never accepts invented/non-numeric evidence", () => {
  assert.throws(() =>
    validateScreenshot({ image: "data:text/html;base64,AAAA" }),
  );
  assert.throws(() =>
    validateScreenshot({
      image: "data:image/jpeg;base64," + "A".repeat(950001),
    }),
  );
  const result = normalizeReading(
    '{"sport":"Running","distanceKm":"100","durationMinutes":99999,"name":"Run"}',
  );
  assert.equal(result.sport, "Other");
  assert.equal(result.distanceKm, null);
  assert.equal(result.durationMinutes, null);
});
test("cloud payload validates home coordinates, limits and structure and excludes local uploads", () => {
  const valid = {
    profile: {
      name: "Test",
      home: "Portree",
      homeCoords: { lat: 57, lon: -6 },
      level: "beginner",
      skills: [],
      dailyDistanceKm: 8,
      paceKmh: 3.5,
    },
    plans: [],
    photos: ["private"],
    activities: ["private"],
  };
  assert.deepEqual(Object.keys(validateWorkspace(valid)), ["profile", "plans"]);
  assert.throws(() =>
    validateWorkspace({
      ...valid,
      profile: { ...valid.profile, homeCoords: { lat: 95, lon: 0 } },
    }),
  );
  assert.throws(() => validateWorkspace({ ...valid, plans: [{}] }));
  assert.throws(() =>
    validateWorkspace({
      ...valid,
      profile: { ...valid.profile, bio: "a".repeat(500001) },
    }),
  );
});
test("legacy AI coordinate generation is disabled and every other paid entry requires auth", async (t) => {
  const app = require("../src/index");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(
    (
      await fetch(`${base}/api/planning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    422,
  );
  for (const path of [
    "/api/planning/ask",
    "/api/planning/local-knowledge",
    "/api/planning/local-knowledge/ask",
    "/api/onboarding/read-screenshot",
    "/api/account/workspace",
  ]) {
    const response = await fetch(base + path, {
      method: path.includes("workspace") ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.ok([401, 503].includes(response.status), `${path} must fail closed`);
  }
  const config = await (await fetch(base + "/api/config")).json();
  assert.deepEqual(Object.keys(config).sort(), [
    "aiEnabled",
    "aiLimits",
    "auth",
    "authRequired",
    "geocodingEnabled",
  ]);
  if (config.auth)
    assert.deepEqual(Object.keys(config.auth).sort(), ["publicKey", "url"]);
});
