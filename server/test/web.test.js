const test = require("node:test");
const assert = require("node:assert/strict");
const { refineRouteWaypoints } = require("../src/lib/waterRouting");
const { rankPhotos, fetchRoutePhotos } = require("../src/lib/routePhotos");
const { coordinates } = require("../src/routes/explore");

test("inland and coastal coordinates are never silently moved", () => {
  const points = [
    [57.16, -3.7],
    [57.17, -3.71],
  ];
  assert.deepEqual(refineRouteWaypoints(points), points);
  assert.throws(
    () =>
      refineRouteWaypoints([
        [91, 0],
        [0, 0],
      ]),
    /invalid/,
  );
});
test("POI coordinates allow zero but reject query injection and invalid ranges", () => {
  assert.deepEqual(coordinates({ lat: "0", lon: "0" }), [0, 0]);
  assert.throws(
    () => coordinates({ lat: "1);out;", lon: "1" }),
    /Valid latitude/,
  );
  assert.throws(() => coordinates({ lat: "100", lon: "1" }), /Valid latitude/);
});
test("photos require usable licences, valid images and credit, excluding unrelated graphics", () => {
  const photo = (title, license = "CC BY-SA 4.0") => ({
    pageid: title.length,
    title,
    imageinfo: [
      {
        mime: "image/jpeg",
        width: 1200,
        height: 800,
        thumburl: "https://upload.wikimedia.org/test.jpg",
        descriptionurl: "https://commons.wikimedia.org/wiki/Test",
        extmetadata: {
          Artist: { value: "<a>Photographer</a>" },
          LicenseShortName: { value: license },
        },
      },
    ],
  });
  const result = rankPhotos(
    {
      a: photo("File:Loch Portree coast.jpg"),
      b: photo("File:Portree map.jpg"),
      c: photo("File:Portree photo.jpg", "All rights reserved"),
    },
    "Portree",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].author, "Photographer");
  assert.ok(result[0].sourceUrl);
  assert.ok(result[0].license);
});
test("provider failure does not invent photos or claim a successful empty response", async () => {
  const response = await fetchRoutePhotos(
    {
      name: "Failure test",
      waypoints: [
        [57, -6],
        [57.1, -6],
      ],
    },
    async () => {
      throw new Error("Offline");
    },
  );
  assert.equal(response.status, "unavailable");
  assert.deepEqual(response.photos, []);
});
test("server starts without cloud credentials; public planning works and account routes fail closed", async (t) => {
  const app = require("../src/index");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const response = await fetch(`${base}/api/explore/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "4 days in Skye",
      profile: { level: "beginner", dailyDistanceKm: 8 },
    }),
  });
  const plan = await response.json();
  assert.equal(plan.days.length, 4);
  assert.ok([401, 503].includes((await fetch(`${base}/api/users/me`)).status));
});
