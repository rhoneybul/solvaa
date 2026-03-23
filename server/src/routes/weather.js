const express = require('express');
const router  = express.Router();

// Simple in-memory cache — keyed by "lat,lon", TTL 30 minutes
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

// GET /api/weather?lat=51.5&lon=-0.1
router.get('/', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

    const key   = `${(+lat).toFixed(3)},${(+lon).toFixed(3)}`;
    const entry = cache.get(key);

    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      return res.json({ ...entry.data, cached: true });
    }

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation,wave_height` +
      `&hourly=temperature_2m,windspeed_10m,precipitation_probability,weathercode,wave_height` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,sunrise,sunset,precipitation_sum` +
      `&forecast_days=3&timezone=auto&windspeed_unit=knots`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`);

    const data = await resp.json();
    cache.set(key, { data, ts: Date.now() });
    res.json({ ...data, cached: false });
  } catch (err) { next(err); }
});

module.exports = router;
