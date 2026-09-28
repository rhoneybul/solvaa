import test from "node:test";
import assert from "node:assert/strict";
import { assessExperience, recommendNearby } from "../src/lib/onboarding.mjs";
import { cloudPayload, reconcileWorkspace } from "../src/lib/workspace.mjs";
import { exportGpx, canExportGpx } from "../src/lib/planner.mjs";
const profile = {
  homeCoords: { lat: 57.412, lon: -6.195 },
  travelRadiusKm: 25,
  level: "beginner",
  dailyDistanceKm: 8,
  paceKmh: 3.5,
};
test("experience assessment needs rescue and navigation evidence, not just distance", () => {
  assert.equal(
    assessExperience({
      frequency: "regular",
      water: "coastal",
      distanceKm: 100,
    }).level,
    "beginner",
  );
  assert.equal(
    assessExperience({ frequency: "sometimes", rescue: true }).level,
    "intermediate",
  );
  assert.equal(
    assessExperience({
      frequency: "regular",
      water: "coastal",
      rescue: true,
      navigation: true,
    }).level,
    "advanced",
  );
});
test("nearby ideas respect home, experience and endurance; unsupported homes never pretend to be local", () => {
  const local = recommendNearby(profile);
  assert.ok(local.nearby.some((route) => route.id === "portree"));
  assert.ok(
    local.nearby.every(
      (route) =>
        route.distanceFromHomeKm <= 25 &&
        route.difficulty === "easy" &&
        route.distanceKm <= 8,
    ),
  );
  const london = recommendNearby({
    ...profile,
    homeCoords: { lat: 51.5, lon: -0.12 },
  });
  assert.equal(london.nearby.length, 0);
  assert.ok(london.further.every((route) => route.distanceFromHomeKm > 25));
  assert.equal(
    recommendNearby({ ...profile, homeCoords: { lat: 91, lon: 0 } })
      .hasLocation,
    false,
  );
});
test("cloud reconciliation preserves local media, handles interrupted saves and surfaces conflicts", () => {
  const local = {
    profile: { name: "Device" },
    plans: [],
    photos: ["photo"],
    activities: ["session"],
    cloudPending: true,
    cloudRevision: 2,
  };
  assert.deepEqual(cloudPayload(local), { profile: local.profile, plans: [] });
  assert.equal(
    reconcileWorkspace(local, {
      revision: 2,
      payload: { profile: { name: "Old" }, plans: [] },
    }).pending,
    true,
  );
  const conflict = reconcileWorkspace(local, {
    revision: 3,
    payload: { profile: { name: "Remote" }, plans: [] },
  });
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.state.profile.name, "Device");
  const accepted = reconcileWorkspace(local, {
    revision: 3,
    payload: cloudPayload(local),
  });
  assert.equal(accepted.state.cloudPending, false);
  assert.deepEqual(accepted.state.photos, ["photo"]);
  const fresh = reconcileWorkspace(
    { ...local, cloudPending: false },
    { revision: 3, payload: { profile: { name: "Remote" }, plans: [] } },
  );
  assert.equal(fresh.state.profile.name, "Remote");
  assert.deepEqual(fresh.state.activities, ["session"]);
});
test("GPX export requires water validation on every track and never connects separate days", () => {
  const fixture = {
    name: "Fixture & route",
    geometryStatus: "water-validated",
    waterValidation: { source: "test fixture", checkedAt: "2026-09-28" },
    waypoints: [
      [57, -6],
      [57.01, -6],
    ],
  };
  assert.equal(canExportGpx({ ...fixture, waterValidation: null }), false);
  assert.equal(
    canExportGpx({
      ...fixture,
      waypoints: [
        [91, 0],
        [0, 0],
      ],
    }),
    false,
  );
  const plan = {
    title: "Two days",
    days: [{ route: fixture }, { route: fixture }],
  };
  assert.equal((exportGpx(plan).match(/<trk>/g) || []).length, 2);
  assert.ok(exportGpx(plan).includes("Fixture &amp; route"));
  assert.throws(
    () =>
      exportGpx({
        ...plan,
        days: [
          { route: fixture },
          { route: { ...fixture, geometryStatus: "outline" } },
        ],
      }),
    /water-geometry/,
  );
});
