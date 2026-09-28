import test from "node:test";
import assert from "node:assert/strict";
import {
  parseActivityFile,
  summarizeActivities,
} from "../src/lib/activities.mjs";
const gpx = `<?xml version="1.0"?><gpx><trk><name>Morning paddle</name><trkseg><trkpt lat="57" lon="-6"><time>2026-09-01T10:00:00Z</time></trkpt><trkpt lat="57.01" lon="-6"><time>2026-09-01T10:30:00Z</time></trkpt></trkseg><trkseg><trkpt lat="57.1" lon="-6"><time>2026-09-01T12:00:00Z</time></trkpt><trkpt lat="57.11" lon="-6"><time>2026-09-01T12:30:00Z</time></trkpt></trkseg></trk></gpx>`;
test("GPX preserves segment breaks instead of adding a false journey across a gap", () => {
  const [activity] = parseActivityFile(gpx, "test.gpx");
  assert.equal(activity.durationSeconds, 3600);
  assert.equal(activity.distanceKm, 2.22);
  assert.equal(activity.isPaddling, true);
  assert.equal(parseActivityFile(gpx, "again.gpx")[0].id, activity.id);
});
test("non-paddling sessions cannot inflate paddling evidence", () => {
  const sessions = parseActivityFile(
    "Activity Name,Activity Date,Activity Type,Distance,Elapsed Time\nRun,2026-01-01,Run,10,3600\nPaddle,2026-01-02,Kayaking,5,7200",
    "activities.csv",
  );
  const stats = summarizeActivities(sessions);
  assert.equal(stats.count, 1);
  assert.equal(stats.distanceKm, 5);
  assert.equal(stats.paceKmh, 2.5);
});
test("Strava duplicate distance uses detailed metres with correct conversion", () => {
  const [activity] = parseActivityFile(
    "Activity Name,Activity Type,Distance,Elapsed Time,Distance\nPaddle,Kayaking,6.2,7200,6200",
    "activities.csv",
  );
  assert.equal(activity.distanceKm, 6.2);
});
test("TCX without GPS can import measured lap totals without inventing coordinates", () => {
  const [activity] = parseActivityFile(
    '<TrainingCenterDatabase><Activities><Activity Sport="Other"><Id>2026-01-01T10:00:00Z</Id><Lap><DistanceMeters>4000</DistanceMeters><TotalTimeSeconds>3600</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>',
    "paddle.tcx",
  );
  assert.equal(activity.distanceKm, 4);
  assert.equal(activity.durationSeconds, 3600);
  assert.equal(activity.track.length, 0);
});
test("invalid, unsafe XML and unsupported formats are rejected", () => {
  assert.throws(
    () =>
      parseActivityFile(
        '<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///tmp/test">]><gpx/>',
        "a.gpx",
      ),
    /invalid/,
  );
  assert.throws(() => parseActivityFile("<gpx>", "a.gpx"), /invalid/);
  assert.throws(() => parseActivityFile("anything", "a.fit"), /GPX, TCX/);
});
