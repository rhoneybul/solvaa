require('dotenv').config();
// Reuse the public Supabase settings from the former Expo/Vercel deployment.
if (!process.env.SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!process.env.SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors    = require('cors');

const tripsRouter       = require('./routes/trips');
const paddlesRouter     = require('./routes/paddles');
const campsitesRouter   = require('./routes/campsites');
const weatherRouter     = require('./routes/weather');
const usersRouter       = require('./routes/users');
const planningRouter    = require('./routes/planning');
const savedRoutesRouter = require('./routes/savedRoutes');
const poisRouter        = require('./routes/pois');

const { authMiddleware } = require('./middleware/auth');
const { ensureDatabaseReady, readinessMiddleware } = require('./lib/migrations');

const app  = express();
const PORT = process.env.PORT || 3008;
const authRequired = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || process.env.AUTH_REQUIRED === 'true';

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS;
app.use(cors({ origin: !allowedOrigins || allowedOrigins === '*' ? '*' : allowedOrigins.split(',') }));
// Exact proxy-hop count is deployment-specific; never trust arbitrary forwarded headers.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || false);
// Vercel cold starts wait here; concurrent requests share one startup promise.
app.use(readinessMiddleware(ensureDatabaseReady));
app.use(express.json({ limit: '1100kb' }));

// Public API usage is bounded without requiring an account.
const windows = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of windows) if (value.until < now) windows.delete(key);
  const key = require("./lib/clientIp").clientIp(req);
  const entry = windows.get(key) || { until: now + 60000, count: 0 };
  entry.count += 1; windows.set(key, entry);
  if (entry.count > 90) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  next();
});

// ── Health check (no auth needed) ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Production has one authentication boundary for all application APIs.
app.use('/api', (req, res, next) => {
  if (req.path === '/config' || !authRequired) return next();
  return authMiddleware(req, res, next);
});

// ── Protected routes ──────────────────────────────────────────────────────────
app.use('/api/users',         authMiddleware, usersRouter);
app.use('/api/trips',         authMiddleware, tripsRouter);
app.use('/api/paddles',       authMiddleware, paddlesRouter);
app.use('/api/saved-routes',  authMiddleware, savedRoutesRouter);
app.use('/api/campsites', campsitesRouter);  // public — no auth needed
app.use('/api/weather',   weatherRouter);    // public — proxies Open-Meteo
app.use('/api/planning', planningRouter); // Photos public; paid endpoints authenticated and quota-limited.
app.use('/api/pois',     poisRouter);      // public — POI search via Overpass
app.use('/api/explore', require('./routes/explore').router);
app.use('/api/explore', require('./routes/mapPoints').router);
app.use('/api/onboarding', require('./routes/onboarding').router);
app.use('/api/account', authMiddleware, require('./routes/account').router);
app.get('/api/config', (_req, res) => {
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const { aiEnabled, limits } = require('./lib/ai');
  res.json({
    authRequired,
    geocodingEnabled: !!process.env.NOMINATIM_BASE_URL,
    auth: process.env.SUPABASE_URL && publicKey ? { url: process.env.SUPABASE_URL, publicKey } : null,
    aiEnabled: aiEnabled(), aiLimits: { perDay: limits().userDay, perMonth: limits().userMonth },
  });
});

const webDirectory = path.resolve(__dirname, '../../dist');
if (fs.existsSync(path.join(webDirectory, 'index.html'))) {
  app.use(express.static(webDirectory));
  app.get('*', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(webDirectory, 'index.html')));
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('API request failed:', err.status || 500, err.code || 'request_error');
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  ensureDatabaseReady().then(() => app.listen(PORT, () => {
    console.log(`Solvaa website and API running on http://localhost:${PORT}`);
  })).catch(() => {
    console.error('Database initialization failed. Check DATABASE_URL, database permissions and migration history.');
    process.exitCode = 1;
  });
}
module.exports = app;
