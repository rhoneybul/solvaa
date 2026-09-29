const cache = new Map();
const TTL = 24 * 60 * 60 * 1000;
const plain = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .slice(0, 300);
const https = (value) => {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

function normalizePoint(point) {
  const lat = Array.isArray(point) ? point[0] : point?.lat;
  const lon = Array.isArray(point) ? point[1] : (point?.lon ?? point?.lng);
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
    ? [lat, lon]
    : null;
}

function rankPhotos(pages, routeName = "") {
  const words = routeName
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  return Object.values(pages || {})
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const title = plain(page.title)
        .replace(/^File:/, "")
        .replace(/\.[^.]+$/, "")
        .replaceAll("_", " ");
      const license = plain(meta.LicenseShortName?.value);
      if (
        !info ||
        !["image/jpeg", "image/png", "image/webp"].includes(info.mime) ||
        info.width < 600 ||
        info.width < info.height ||
        !/CC|public domain|PD|CC0/i.test(license)
      )
        return [];
      if (/\b(map|diagram|logo|coat of arms|flag|drawing)\b/i.test(title))
        return [];
      const url = https(info.thumburl || info.url);
      const sourceUrl =
        https(info.descriptionurl) ||
        `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`;
      if (!url) return [];
      return [
        {
          id: page.pageid,
          url,
          title,
          commonsUrl: sourceUrl,
          sourceUrl,
          author: plain(meta.Artist?.value) || "Wikimedia Commons contributor",
          license,
          licenseUrl: https(meta.LicenseUrl?.value),
          relevance:
            "Photographed near the route; not proof of conditions or access.",
          score:
            words.filter((word) => title.toLowerCase().includes(word)).length *
              4 +
            (/loch|lake|water|coast|bay|harbour|sea|shore/i.test(title)
              ? 3
              : 0),
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

async function fetchRoutePhotos(route, fetcher = fetch) {
  const points = (route.waypoints || []).map(normalizePoint).filter(Boolean);
  const location = normalizePoint(route.locationCoords);
  if (!points.length && location) points.push(location);
  if (!points.length) return { photos: [], status: "no_location" };
  const anchors = [points[0], points[Math.floor(points.length / 2)]];
  const key = JSON.stringify([
    route.name,
    anchors.map((point) => point.map((value) => value.toFixed(3))),
  ]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const results = await Promise.allSettled(
    anchors.map(async (point) => {
      const params = new URLSearchParams({
        action: "query",
        generator: "geosearch",
        ggscoord: point.join("|"),
        ggsradius: "8000",
        ggsnamespace: "6",
        ggslimit: "24",
        prop: "imageinfo",
        iiprop: "url|dimensions|mime|extmetadata",
        iiurlwidth: "960",
        iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
        format: "json",
      });
      const response = await fetcher(
        `https://commons.wikimedia.org/w/api.php?${params}`,
        {
          signal: AbortSignal.timeout(9000),
          headers: {
            "User-Agent":
              "Solvaa/2.0 (route planning; Wikimedia photo attribution)",
          },
        },
      );
      if (!response.ok) throw new Error("Photo provider unavailable");
      const result = await response.json();
      if (result.error) throw new Error("Photo provider unavailable");
      return rankPhotos(result.query?.pages, route.name);
    }),
  );
  const unique = new Map();
  results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .forEach((photo) => unique.set(photo.id, photo));
  const photos = [...unique.values()]
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 4);
  const value = {
    photos,
    status: photos.length
      ? "ready"
      : results.every((result) => result.status === "rejected")
        ? "unavailable"
        : "no_matches",
  };
  if (value.status !== "unavailable") {
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
  }
  return value;
}
module.exports = { fetchRoutePhotos, rankPhotos, normalizePoint };
