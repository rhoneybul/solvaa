const express = require("express");
const router = express.Router();
const { coordinates } = require("./explore");
const cache = new Map();
const inFlight = new Map();
function mapPlaces(elements) {
  return elements
    .filter(
      (item) => item.tags && !["private", "no"].includes(item.tags.access),
    )
    .map((item) => {
      const tags = item.tags;
      const launch = tags.leisure === "slipway" || tags.canoe === "put_in";
      const type = launch
        ? "launch"
        : /^(camp_site|caravan_site)$/.test(tags.tourism)
          ? "camp"
          : tags.tourism
            ? "stay"
            : "food";
      return {
        id: `${item.type}/${item.id}`,
        name: tags.name || (launch ? "Mapped launch point" : null),
        type,
        lat: item.lat ?? item.center?.lat,
        lon: item.lon ?? item.center?.lon,
        source: "OpenStreetMap",
        url: `https://www.openstreetmap.org/${item.type}/${item.id}`,
        hours: tags.opening_hours || null,
        note: launch
          ? "Mapped access point. Check permissions, local restrictions and shore conditions."
          : null,
      };
    })
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
router.get("/points", async (req, res, next) => {
  try {
    const [lat, lon] = coordinates(req.query);
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 3600000) return res.json(hit.data);
    if (!inFlight.has(key)) {
      const task = (async () => {
        const query = `[out:json][timeout:12];(nwr["leisure"="slipway"](around:25000,${lat},${lon});nwr["canoe"="put_in"](around:25000,${lat},${lon});nwr["tourism"~"^(hotel|guest_house|hostel|camp_site|caravan_site)$"](around:25000,${lat},${lon});nwr["amenity"~"^(restaurant|cafe|pub)$"](around:25000,${lat},${lon}););out center 200;`;
        const response = await fetch(
          process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              "User-Agent": "Solvaa/2.0 (+https://paddle-kayak.vercel.app)",
            },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error(
            "Nearby places are temporarily unavailable. You can still explore the map and plot your route.",
          );
        const body = await response.json();
        if (body.remark)
          throw new Error(
            "The place search timed out. Try searching a different area.",
          );
        const data = {
          places: mapPlaces(body.elements || []),
          fetchedAt: new Date().toISOString(),
        };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { at: Date.now(), data });
        return data;
      })();
      inFlight.set(key, task);
    }
    try {
      res.json(await inFlight.get(key));
    } finally {
      inFlight.delete(key);
    }
  } catch (error) {
    if (["AbortError", "TimeoutError"].includes(error.name))
      error = new Error(
        "Nearby places took too long to respond. Try again, or keep plotting on the map.",
      );
    error.status ||= 502;
    next(error);
  }
});
module.exports = { router, mapPlaces };
