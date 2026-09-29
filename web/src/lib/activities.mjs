import { XMLParser, XMLValidator } from "fast-xml-parser";
import Papa from "papaparse";
import { distanceKm, validPoint } from "./geo.mjs";

const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const positive = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const paddling = (type) => /kayak|canoe|paddl|rowing/i.test(type || "");
export function fingerprint(activity) {
  return `${activity.date || "undated"}:${activity.name.toLowerCase()}:${activity.distanceKm.toFixed(2)}:${Math.round(activity.durationSeconds)}`;
}
function finish(activity) {
  if (!activity.distanceKm && !activity.durationSeconds)
    throw new Error("This activity has no usable distance or duration.");
  if (activity.distanceKm > 2000 || activity.durationSeconds > 30 * 86400)
    throw new Error("This activity has implausible totals. Check its units.");
  const result = {
    ...activity,
    distanceKm: Math.round(activity.distanceKm * 100) / 100,
    isPaddling: paddling(activity.type),
    source: "import",
  };
  return { ...result, id: fingerprint(result) };
}

export function parseActivityFile(text, filename, defaultType = "Kayaking") {
  if (/\.csv$/i.test(filename)) return parseCsv(text);
  if (!/\.(gpx|tcx)$/i.test(filename))
    throw new Error("Use GPX, TCX or a Strava activities CSV file.");
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
    throw new Error(
      "The activity XML is invalid. Export it again from Strava or your device.",
    );
  const doc = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  }).parse(text);
  if (/\.gpx$/i.test(filename)) {
    if (!doc.gpx) throw new Error("This file is not a GPX activity.");
    return array(doc.gpx.trk).map((track, index) => {
      const segments = array(track.trkseg).map((segment) =>
        array(segment.trkpt),
      );
      return fromSegments(
        segments.map((segment) =>
          segment.map((point) => ({
            point: [Number(point["@_lat"]), Number(point["@_lon"])],
            time: point.time,
          })),
        ),
        {
          name: String(
            track.name ||
              filename.replace(/\.gpx$/i, "") + (index ? ` ${index + 1}` : ""),
          ),
          type:
            typeof track.type === "string" && !/^\d+$/.test(track.type)
              ? track.type
              : defaultType,
        },
      );
    });
  }
  return array(doc.TrainingCenterDatabase?.Activities?.Activity).map(
    (activity) => {
      const laps = array(activity.Lap);
      return fromSegments(
        laps.flatMap((lap) =>
          array(lap.Track).map((track) =>
            array(track.Trackpoint).map((point) => ({
              point: [
                Number(point.Position?.LatitudeDegrees),
                Number(point.Position?.LongitudeDegrees),
              ],
              time: point.Time,
            })),
          ),
        ),
        {
          name: String(activity.Notes || filename.replace(/\.tcx$/i, "")),
          type:
            activity["@_Sport"] === "Other"
              ? defaultType
              : activity["@_Sport"] || defaultType,
          date: activity.Id,
          fallbackDistance: laps.reduce(
            (sum, lap) => sum + positive(lap.DistanceMeters) / 1000,
            0,
          ),
          fallbackDuration: laps.reduce(
            (sum, lap) => sum + positive(lap.TotalTimeSeconds),
            0,
          ),
        },
      );
    },
  );
}

function fromSegments(segments, info) {
  let distance = 0,
    duration = 0,
    firstTime;
  const track = [];
  for (const segment of segments) {
    let previous = null;
    for (const item of segment) {
      const time = Date.parse(item.time);
      if (Number.isFinite(time) && firstTime == null) firstTime = time;
      if (!validPoint(item.point)) {
        previous = null;
        continue;
      }
      if (previous) {
        const gap = distanceKm(previous.point, item.point);
        if (gap > 30)
          throw new Error(
            "The GPS track contains a jump over 30 km. Please check the source file.",
          );
        distance += gap;
        if (
          Number.isFinite(time) &&
          Number.isFinite(previous.time) &&
          time > previous.time
        )
          duration += (time - previous.time) / 1000;
      }
      track.push(item.point);
      previous = { point: item.point, time };
    }
  }
  return finish({
    name: info.name.slice(0, 200),
    type: info.type,
    date:
      firstTime != null ? new Date(firstTime).toISOString() : info.date || null,
    distanceKm: distance || info.fallbackDistance || 0,
    durationSeconds: duration || info.fallbackDuration || 0,
    track: track.filter(
      (_, index) => index % Math.max(1, Math.ceil(track.length / 3000)) === 0,
    ),
  });
}

function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  if (result.errors.some((error) => error.code !== "UndetectableDelimiter"))
    throw new Error(
      "The CSV columns could not be read. Use the original Strava activities.csv export.",
    );
  if (!result.meta.fields?.includes("Activity Name"))
    throw new Error(
      "Use the activities.csv file from your Strava data export.",
    );
  if (result.data.length > 5000)
    throw new Error("Import up to 5,000 activities at a time.");
  return result.data.map((row) => {
    // Strava's duplicate detailed Distance column is metres. The summary column
    // is kilometres in the metric export. Explicitly named unit columns win.
    const metres = row["Distance (m)"] ?? row.Distance_1;
    const distance =
      metres != null && metres !== ""
        ? positive(metres) / 1000
        : positive(row["Distance (km)"] ?? row.Distance);
    const date = Date.parse(row["Activity Date"]);
    return finish({
      name: String(row["Activity Name"] || "Imported activity").slice(0, 200),
      type: row["Activity Type"] || "Unknown",
      distanceKm: distance,
      durationSeconds: positive(row["Moving Time"] || row["Elapsed Time"]),
      date: Number.isFinite(date) ? new Date(date).toISOString() : null,
      track: [],
    });
  });
}

export function summarizeActivities(activities) {
  const paddles = activities.filter((activity) => activity.isPaddling);
  const distanceKm = paddles.reduce(
    (sum, activity) => sum + activity.distanceKm,
    0,
  );
  const durationSeconds = paddles.reduce(
    (sum, activity) => sum + activity.durationSeconds,
    0,
  );
  const timed = paddles.filter(
    (activity) => activity.durationSeconds > 0 && activity.distanceKm > 0,
  );
  const pace = timed.length
    ? timed.reduce((sum, item) => sum + item.distanceKm, 0) /
      (timed.reduce((sum, item) => sum + item.durationSeconds, 0) / 3600)
    : null;
  return {
    count: paddles.length,
    distanceKm,
    durationSeconds,
    longestKm: Math.max(0, ...paddles.map((activity) => activity.distanceKm)),
    paceKmh:
      pace && pace >= 1 && pace <= 12 ? Math.round(pace * 10) / 10 : null,
    suggestion:
      paddles.length >= 5
        ? "You have a useful base of session evidence. Review your comfortable distance and skills below."
        : "Add paddling sessions to build a clearer picture of your endurance.",
  };
}
