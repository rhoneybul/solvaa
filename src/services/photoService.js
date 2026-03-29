// ── Photo service ─────────────────────────────────────────────────────────────
// Asks the backend to use Claude to generate water-focused Wikimedia Commons
// search queries, then returns landscape photos of the route's waterway.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch up to 3 water-focused photos for a route via the backend.
 * Returns [{ label, photos: [{ url, title }] }]
 */
export async function fetchWaypointPhotos(route) {
  try {
    const res = await fetch(`${BASE_URL}/api/planning/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    if (photos.length === 0) return [];
    return [{ label: route.name || 'Route Area', photos }];
  } catch (e) {
    console.warn('[photoService] fetchWaypointPhotos failed:', e?.message);
    return [];
  }
}

/** Flat photo list for any future callers. */
export async function fetchRoutePhotos(route) {
  const groups = await fetchWaypointPhotos(route);
  return groups.flatMap(g => g.photos);
}
