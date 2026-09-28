import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRequest,
  planRoutes,
  exportGpx,
  prepareRoute,
} from "../src/lib/planner.mjs";
import { addDays } from "../src/lib/geo.mjs";
const profile = { level: "beginner", dailyDistanceKm: 8 };

test("easy two-hour request honours today, skill, time and location", () => {
  const request = parseRequest(
    "Find me an easy route for today which is around 2 hours",
    { location: "Isle of Skye", days: 1 },
    "2026-10-24",
  );
  const plan = planRoutes(request, profile);
  assert.equal(request.startDate, "2026-10-24");
  assert.equal(request.hours, 2);
  assert.equal(plan.status, "ready");
  assert.ok(plan.routes.length);
  assert.ok(
    plan.routes.every(
      (route) =>
        route.difficulty === "easy" && route.timeMatch && route.distanceKm <= 8,
    ),
  );
});
test("four days on Skye creates four dated outings, three overnights and blocks unvalidated GPX", () => {
  const request = parseRequest(
    "Find a route in the isle of skye for four days, including places to stay, eat, and camp",
    { location: "Cairngorms" },
    "2026-10-24",
  );
  const plan = planRoutes(request, profile);
  assert.equal(plan.status, "ready");
  assert.equal(plan.days.length, 4);
  assert.deepEqual(
    plan.days.map((day) => day.date),
    ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"],
  );
  assert.equal(new Set(plan.days.map((day) => day.route.id)).size, 4);
  assert.equal(plan.days.filter((day) => day.overnight).length, 3);
  assert.throws(() => exportGpx(plan), /water-geometry validation/);
  assert.ok(
    plan.days.slice(1).every((day) => day.transfer.includes("by road")),
  );
});
test("unsupported destination never falls back silently to Skye", () => {
  const request = parseRequest("A route in Norway for 4 days", {
    location: "Isle of Skye",
  });
  assert.equal(request.location, "Norway");
  assert.equal(planRoutes(request, profile).status, "no_matches");
});
test("oversized trips, invalid dates and non-finite durations are rejected", () => {
  assert.throws(() => parseRequest("18 days in Skye"), /1 and 14/);
  assert.throws(
    () => parseRequest("", { startDate: "2026-02-30" }),
    /valid start date/,
  );
  assert.throws(() => parseRequest("", { hours: "abc" }), /30 minutes/);
});
test("tomorrow, minutes, weekends and continuous expeditions have explicit semantics", () => {
  assert.equal(
    parseRequest("90 minutes tomorrow", {}, "2026-12-31").startDate,
    "2027-01-01",
  );
  assert.equal(parseRequest("90 minutes tomorrow").hours, 1.5);
  assert.equal(parseRequest("A weekend in Skye").days, 2);
  assert.equal(
    planRoutes(
      parseRequest("A continuous expedition in Skye for 4 days"),
      profile,
    ).status,
    "unsupported",
  );
});
test("does not invent or repeat routes to fill an unsupported duration", () => {
  assert.equal(
    planRoutes(parseRequest("7 days in Skye"), profile).status,
    "not_enough_days",
  );
});
test("profile endurance limit removes overlong outings", () => {
  assert.equal(
    planRoutes(parseRequest("A paddle in Skye"), {
      ...profile,
      dailyDistanceKm: 1,
    }).status,
    "no_matches",
  );
});
test("distance and time are calculated from geometry and personal pace", () => {
  const route = {
    waypoints: [
      [0, 0],
      [0, 0.01],
    ],
  };
  assert.equal(prepareRoute(route).distanceKm, 1.1);
  assert.ok(
    prepareRoute(route, { paceKmh: 2.5 }).durationHours >
      prepareRoute(route, { paceKmh: 5 }).durationHours,
  );
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
});

// Form edits are explicit refinements of the original natural-language request.
test("manual controls override conflicting free text and still validate", () => {
  const prompt =
    "An easy trip in Skye for 4 days, 2 hours today, with food and camping";
  const request = parseRequest(prompt, {}, "2026-09-28", {
    days: 2,
    hours: 3,
    startDate: "2026-10-02",
    location: "Loch Lomond",
    difficulty: "moderate",
    camp: false,
    food: false,
  });
  assert.equal(request.days, 2);
  assert.equal(request.hours, 3);
  assert.equal(request.startDate, "2026-10-02");
  assert.equal(request.location, "Loch Lomond");
  assert.equal(request.difficulty, "moderate");
  assert.equal(request.camp, false);
  assert.equal(request.food, false);
  assert.throws(
    () => parseRequest(prompt, {}, "2026-09-28", { days: 0 }),
    /1 and 14/,
  );
  assert.throws(
    () => parseRequest(prompt, {}, "2026-09-28", { hours: 0 }),
    /30 minutes/,
  );
});
