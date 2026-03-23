const express = require('express');
const router  = express.Router();

const RIDB_KEY = process.env.RIDB_API_KEY || '';

// GET /api/campsites?lat=51.5&lon=-0.1&radius=30
// Fetches from Recreation.gov (US) and OpenStreetMap Overpass (global)
router.get('/', async (req, res, next) => {
  try {
    const { lat, lon, radius = 30 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

    const results = await Promise.allSettled([
      fetchRIDB(lat, lon, radius),
      fetchOverpass(lat, lon, radius),
    ]);

    const campsites = [
      ...(results[0].status === 'fulfilled' ? results[0].value : []),
      ...(results[1].status === 'fulfilled' ? results[1].value : []),
    ];

    res.json(campsites);
  } catch (err) { next(err); }
});

async function fetchRIDB(lat, lon, radiusKm) {
  if (!RIDB_KEY) return [];
  const radiusMiles = Math.round(radiusKm * 0.621371);
  const url = `https://ridb.recreation.gov/api/v1/facilities?latitude=${lat}&longitude=${lon}&radius=${radiusMiles}&activity=CAMPING&apikey=${RIDB_KEY}&limit=20`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const json = await resp.json();

  return (json.RECDATA || []).map(f => ({
    id:           `ridb_${f.FacilityID}`,
    source:       'Recreation.gov',
    name:         f.FacilityName,
    lat:          f.FacilityLatitude,
    lon:          f.FacilityLongitude,
    description:  f.FacilityDescription?.replace(/<[^>]+>/g, '').slice(0, 200),
    url:          `https://www.recreation.gov/camping/campgrounds/${f.FacilityID}`,
    beach_access: f.FacilityName?.toLowerCase().includes('beach') || false,
    water:        true, // RIDB facilities generally have water
    type:         'formal',
  }));
}

async function fetchOverpass(lat, lon, radiusKm) {
  const radiusM = radiusKm * 1000;
  const query = `
    [out:json][timeout:15];
    (
      node["tourism"="camp_site"](around:${radiusM},${lat},${lon});
      way["tourism"="camp_site"](around:${radiusM},${lat},${lon});
    );
    out center 20;
  `;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!resp.ok) return [];
  const json = await resp.json();

  return (json.elements || []).map(el => {
    const c = el.center || el;
    return {
      id:           `osm_${el.id}`,
      source:       'OpenStreetMap',
      name:         el.tags?.name || 'Unnamed campsite',
      lat:          c.lat,
      lon:          c.lon,
      description:  el.tags?.description,
      url:          el.tags?.website || el.tags?.url,
      beach_access: el.tags?.access === 'yes' || !!el.tags?.beach,
      water:        el.tags?.drinking_water === 'yes',
      type:         el.tags?.access === 'private' ? 'wild' :
                    el.tags?.fee === 'yes' ? 'formal' : 'wild',
    };
  });
}

module.exports = router;
