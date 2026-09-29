const express = require("express");
const router = express.Router();
const cache = new Map();
function coordinates(query) {
  const lat = Number(query.lat),
    lon = Number(query.lon);
  if (
    query.lat == null ||
    query.lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    const error = new Error("Valid latitude and longitude are required.");
    error.status = 400;
    throw error;
  }
  return [lat, lon];
}
async function cached(key, ttl, load) {
  const previous = cache.get(key);
  if (previous && Date.now() - previous.at < ttl) return previous.value;
  const value = await load();
  if (cache.size >= 300) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
  return value;
}

router.get("/places", async (req, res, next) => {
  try {
    const [lat, lon] = coordinates(req.query);
    const result = await cached(
      `places:${lat.toFixed(3)},${lon.toFixed(3)}`,
      3600000,
      async () => {
        const query = `[out:json][timeout:12];(nwr["tourism"~"^(hotel|guest_house|hostel|camp_site|caravan_site)$"](around:12000,${lat},${lon});nwr["amenity"~"^(restaurant|cafe|pub)$"](around:12000,${lat},${lon}););out center 150;`;
        const response = await fetch(
          "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error("Places could not be loaded. Please try again.");
        const data = await response.json();
        if (data.remark)
          throw new Error("The place search timed out. Please try again.");
        const places = (data.elements || [])
          .filter((item) => item.tags?.name)
          .map((item) => ({
            id: `${item.type}/${item.id}`,
            name: item.tags.name,
            type: /camp|caravan/.test(item.tags.tourism)
              ? "camp"
              : item.tags.tourism
                ? "stay"
                : "food",
            lat: item.lat ?? item.center?.lat,
            lon: item.lon ?? item.center?.lon,
            website: /^https?:\/\//.test(item.tags.website || "")
              ? item.tags.website
              : null,
            url: `https://www.openstreetmap.org/${item.type}/${item.id}`,
            hours: item.tags.opening_hours || null,
            source: "OpenStreetMap",
          }))
          .filter(
            (item) => Number.isFinite(item.lat) && Number.isFinite(item.lon),
          );
        return {
          places,
          fetchedAt: new Date().toISOString(),
          note: "Mapped places, not live availability. Check opening times, access and bookings with the provider.",
        };
      },
    );
    res.json(result);
  } catch (error) {
    error.status ||= 502;
    next(error);
  }
});

router.get("/conditions", async (req, res, next) => {
  try {
    const [lat, lon] = coordinates(req.query);
    const result = await cached(
      `weather:${lat.toFixed(2)},${lon.toFixed(2)}`,
      1800000,
      async () => {
        const params = new URLSearchParams({
          latitude: lat,
          longitude: lon,
          daily:
            "temperature_2m_max,wind_speed_10m_max,precipitation_probability_max",
          wind_speed_unit: "kn",
          timezone: "auto",
          forecast_days: "14",
        });
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!response.ok)
          throw new Error(
            "Forecast unavailable. Check your usual marine forecast before paddling.",
          );
        const data = await response.json();
        return {
          daily: data.daily,
          fetchedAt: new Date().toISOString(),
          source: "Open-Meteo",
          note: "Land forecast only. Tides, currents and sea state are not included.",
        };
      },
    );
    res.json(result);
  } catch (error) {
    error.status ||= 502;
    next(error);
  }
});

router.post("/search", async (req, res, next) => {
  try {
    const { prompt = "", options = {}, profile = {} } = req.body;
    if (typeof prompt !== "string" || prompt.length > 2000)
      return res
        .status(400)
        .json({ error: "Keep the route request under 2,000 characters." });
    const { parseRequest, planRoutes } = await import(
      "../../../web/src/lib/planner.mjs"
    );
    const request = parseRequest(prompt, options);
    res.json(planRoutes(request, profile));
  } catch (error) {
    error.status ||= 400;
    next(error);
  }
});
module.exports = { router, coordinates };
