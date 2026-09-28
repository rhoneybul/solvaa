const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { refineRouteWaypoints } = require('../lib/waterRouting');

const { authMiddleware } = require('../middleware/auth');
const { createAiGuard } = require('../lib/ai');
// Photo lookup is public and free. Every paid legacy endpoint shares one durable budget.
router.use((req, res, next) => {
  if (req.method !== 'POST' || req.path === '/photos') return next();
  if (req.path === '/') return res.status(422).json({
    error: 'AI-generated navigation coordinates are disabled until a water-only routing provider is configured. Use planning outlines for exploration, not navigation.',
  });
  if (JSON.stringify(req.body || {}).length > 18000)
    return res.status(413).json({ error: 'Keep the AI request shorter.' });
  authMiddleware(req, res, () => createAiGuard()(req, res, next));
});

// Claude API service — moved from frontend to avoid CORS
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';

// ── GPX helpers ───────────────────────────────────────────────────────────────

function generateGpx(name, waypoints) {
  const safeName = (name || 'Route')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const trkpts = (waypoints || [])
    .filter(p => Array.isArray(p) && p.length >= 2)
    .map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Paddle App" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${safeName}</name><trkseg>\n${trkpts}\n  </trkseg></trk>
</gpx>`;
}

async function uploadRouteGpx(name, waypoints, idx) {
  try {
    const slug     = (name || `route-${idx}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const fileName = `routes/${Date.now()}-${idx}-${slug}.gpx`;
    const gpxContent = generateGpx(name, waypoints);

    const { data, error } = await supabase.storage
      .from('gpx-routes')
      .upload(fileName, Buffer.from(gpxContent, 'utf-8'), {
        contentType: 'application/gpx+xml',
        upsert: false,
      });

    if (error || !data) return null;
    const { data: urlData } = supabase.storage.from('gpx-routes').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch {
    return null;
  }
}


// ── Skill-level description block used inside the system prompt ──────────────
const SKILL_LEVELS = {
  BEGINNER: {
    key: 'beginner',
    label: 'Beginner',
    description: 'New to kayaking, basic skills',
    maxWindKnots: 10,
    maxWaveM: 0.5,
    maxDistKm: 5,
  },
  INTERMEDIATE: {
    key: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with basic paddling, some experience',
    maxWindKnots: 15,
    maxWaveM: 1.0,
    maxDistKm: 15,
  },
  ADVANCED: {
    key: 'advanced',
    label: 'Advanced',
    description: 'Experienced paddler, handles varied conditions',
    maxWindKnots: 20,
    maxWaveM: 1.5,
    maxDistKm: 25,
  },
  EXPERT: {
    key: 'expert',
    label: 'Expert',
    description: 'Highly skilled, expedition-ready',
    maxWindKnots: 25,
    maxWaveM: 2.0,
    maxDistKm: 50,
  },
};

const SKILL_LEVEL_CONTEXT = Object.values(SKILL_LEVELS)
  .map(
    (s) =>
      `- ${s.key}: ${s.description} (max wind ${s.maxWindKnots} kt, max wave ${s.maxWaveM} m, max distance ${s.maxDistKm} km)`,
  )
  .join('\n');

// ── System prompt for three-route weather-aware planning ─────────────────────
const SYSTEM_PROMPT_THREE_ROUTES = `You are a kayaking trip planner assistant built into the Paddle app.

You help users plan safe, enjoyable kayaking trips by generating 3 distinct route options that match their preferences and current weather conditions.

For each route, provide:
- A unique name and engaging description
- Difficulty rating (beginner/intermediate/advanced/expert) based on conditions
- Estimated duration in hours
- GPX waypoints for navigation
- Weather impact summary
- Distance in km
- Terrain type (coastal/river/lake/estuary)
- Why this route suits the request
- Travel details from base location
- Key highlights
- Launch point
- Best conditions

Use the skill level context provided in the user prompt to ensure routes are appropriate.

WAYPOINT RULES — NON-NEGOTIABLE:
- Every single coordinate MUST be placed in open, navigable water. No exceptions whatsoever.
- NEVER place a point on land, beach, sand, rocks, cliffs, buildings, roads, or any surface a kayaker cannot paddle on.
- Coastal routes: place waypoints 100–300 m offshore from headlands, beaches, and cliffs — not touching the shore.
- River routes: place waypoints in the centre of the river channel, away from banks.
- Lake routes: place waypoints at least 50 m from the shoreline.
- Harbours / estuaries: stay in the navigable channel; avoid mud flats and shallow margins.
- First point = the water immediately adjacent to the launch slip. Last point = the water immediately adjacent to the take-out.
- Intermediate points: only where the route must change direction, placed firmly in open water.

SELF-CHECK (mandatory before returning JSON):
For every coordinate you generate, ask yourself: "If I plotted this on Google Maps satellite view, would I see open water?" If the answer is no or uncertain, move the point further offshore/into the water until the answer is yes.

Always prioritize safety and realistic planning.`;

async function callClaudeAPI(messages, systemPrompt) {
  if (JSON.stringify(messages).length > 12000 || String(systemPrompt).length > 6000)
    throw new Error('Keep the AI request shorter.');
  return require('../lib/ai').callAi(systemPrompt, messages);
}

/** Attempt to repair common JSON defects: trailing commas, truncated brackets/strings. */
function repairJson(s) {
  // 1. Remove trailing commas before ] or }
  s = s.replace(/,\s*([\]}])/g, '$1');

  // 2. Close any unclosed strings / arrays / objects caused by truncation
  const stack = [];
  let inString = false;
  let escape = false;
  let i = 0;

  for (; i < s.length; i++) {
    const c = s[i];
    if (escape)         { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"')      { inString = !inString; continue; }
    if (inString)       continue;
    if (c === '{')      stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
    }
  }

  // If we're still inside a string, close it
  if (inString) s += '"';

  // Close any open containers in reverse order
  while (stack.length) s += stack.pop();

  return s;
}

function extractJson(text) {
  const stripped = text.replace(/```json|```/g, '');
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start === -1) throw new Error('No JSON object found in Claude response');

  // Use last } if present, otherwise repair will close it
  const candidate = end !== -1 ? stripped.slice(start, end + 1) : stripped.slice(start);

  try {
    return JSON.parse(candidate);
  } catch {
    // Try repairing truncated / malformed JSON
    return JSON.parse(repairJson(candidate));
  }
}

function parseRoutesResponse(text) {
  try {
    const parsed = extractJson(text);
    if (!parsed.routes || !Array.isArray(parsed.routes)) {
      throw new Error('Invalid response format: missing routes array');
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse Claude response:', text);
    throw new Error('Invalid JSON response from Claude API');
  }
}

// POST /api/planning — plan a paddle trip
router.post('/', async (req, res) => {
  try {
    const { prompt, proficiency, tripType, systemPrompt, userMessage } = req.body;

    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    // If the client sends a pre-built system + user message (e.g. weather-aware planning),
    // use those directly instead of the legacy prompt construction below.
    if (systemPrompt && userMessage) {
      const responseText = await callClaudeAPI(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
      );
      const plan = extractJson(responseText);

      // Refine waypoints to navigable water, then upload GPX (both best-effort, in parallel)
      if (Array.isArray(plan.routes)) {
        await Promise.all(plan.routes.map(async (route, i) => {
          if (Array.isArray(route.waypoints) && route.waypoints.length > 0) {
            route.waypoints = refineRouteWaypoints(route.waypoints);
            route.gpx_url   = await uploadRouteGpx(route.name, route.waypoints, i);
          }
        }));
      }

      return res.json(plan);
    }

    let enrichedPrompt = prompt;
    if (proficiency) {
      enrichedPrompt = `${prompt}\n\nPaddler proficiency: ${proficiency}`;
    }
    if (tripType) {
      enrichedPrompt += `\nTrip type: ${tripType}`;
    }

    const messages = [
      {
        role: 'user',
        content: `${enrichedPrompt}\n\nSkill levels:\n${SKILL_LEVEL_CONTEXT}\n\nPlease provide 3 distinct route options in JSON format with the specified schema.`,
      },
    ];

    const responseText = await callClaudeAPI(messages, SYSTEM_PROMPT_THREE_ROUTES);
    const result = parseRoutesResponse(responseText);

    if (Array.isArray(result.routes)) {
      result.routes.forEach(route => {
        if (Array.isArray(route.waypoints) && route.waypoints.length > 0) {
          route.waypoints = refineRouteWaypoints(route.waypoints);
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Planning error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/planning/ask — ask a safety/weather question about routes
router.post('/ask', async (req, res) => {
  try {
    const { question, weather, routes } = req.body;

    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const systemPrompt = `You are a kayaking safety and weather assistant built into the Solvaa app.
The user has planned a paddle and wants a quick answer about safety, weather, or conditions.
Keep answers concise — 2-4 sentences maximum. Be direct and practical.
If conditions look dangerous for the routes shown, say so clearly.
If you don't have enough information to answer confidently, say so.`;

    const routeSummary = Array.isArray(routes) && routes.length > 0
      ? `\n\nRoutes being considered:\n${routes.map((r, i) => `${i+1}. ${r.name || 'Route'} — ${r.distanceKm || '?'} km, ${r.difficulty_rating || r.difficulty || '?'} difficulty, launch: ${r.launchPoint || 'unknown'}`).join('\n')}`
      : '';

    const weatherSummary = weather
      ? `\n\nCurrent conditions:\n- Wind: ${weather.windSpeed ?? '?'} kt from ${weather.windDirLabel ?? weather.windDir ?? '?'}\n- Waves: ${weather.waveHeight ?? '?'} m\n- Temp: ${weather.temp ?? '?'}°C\n- Condition: ${weather.condition?.label ?? '?'}\n- Safety score: ${weather.safetyScore ?? '?'}/100`
      : '';

    const userMessage = `${question}${routeSummary}${weatherSummary}`;

    const answer = await callClaudeAPI(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
    );

    res.json({ answer });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/planning/local-knowledge — generate local paddling knowledge for a route
router.post('/local-knowledge', async (req, res) => {
  try {
    const { route } = req.body;

    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }
    if (!route) {
      return res.status(400).json({ error: 'route is required' });
    }

    const systemPrompt = `You are a local coastal and waterway expert for kayakers. Given a paddle route, provide concise, practical local knowledge.

Respond ONLY with a valid JSON object (no markdown, no backticks, no preamble) in this exact structure:
{
  "summary": "2-3 sentence overview of the area for paddlers",
  "tides": {
    "pattern": "Flood/ebb timing and direction",
    "key_times": "Critical tidal windows to know",
    "cautions": "Main tidal hazards"
  },
  "currents": {
    "main_flows": "Primary current patterns",
    "races": "Any tidal races or overfalls",
    "cautions": "Current hazards to watch for"
  },
  "winds": {
    "prevailing": "Prevailing wind direction and strength",
    "local_effects": "Funnelling or wind-shadow areas",
    "cautions": "Wind hazards specific to this area"
  },
  "waves": {
    "typical": "Normal sea state",
    "swell_exposure": "Swell exposure level"
  },
  "hazards": ["Each hazard as a short plain-language string — max 5 items"],
  "emergency": {
    "coastguard": "Local coastguard contact",
    "rnli": "Nearest lifeboat station",
    "vhf_channel": "Primary VHF channel"
  },
  "navigation_rules": {
    "shipping_lanes": "Any shipping lanes, separation schemes or TSS zones that affect the route — null if none",
    "restricted_areas": "Harbour authority limits, MOD zones, nature reserves or other access restrictions — null if none",
    "right_of_way": "Key right-of-way rules relevant here (e.g. give way to commercial vessels, ferry crossings)",
    "vhf_working": "VHF working channel for the area (harbour operations, marina, coastguard traffic) — null if not applicable",
    "speed_limits": "Any speed limits or wash restrictions on this water — null if none",
    "notices": "Any local bylaws, permits or registration requirements a paddler must know — null if none"
  },
  "wildlife": "Notable marine wildlife in one sentence",
  "recommended_skills": "Minimum skills needed in one sentence"
}`;

    const coords = route.locationCoords
      ? `${route.locationCoords.lat}, ${route.locationCoords.lng}`
      : (Array.isArray(route.waypoints) && route.waypoints[0])
        ? `${route.waypoints[0][0]}, ${route.waypoints[0][1]}`
        : 'unknown';

    const userMessage = `Route: ${route.name || 'Unnamed'}
Location: ${route.location || route.launchPoint || 'unknown'}
Coordinates: ${coords}
Distance: ${route.distanceKm || '?'} km
Terrain: ${route.terrain || 'coastal'}
Launch point: ${route.launchPoint || 'unknown'}
Description: ${route.description || ''}

Generate comprehensive local knowledge for a kayaker planning this paddle.`;

    const answer = await callClaudeAPI(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
    );

    const data = extractJson(answer);
    res.json(data);
  } catch (error) {
    console.error('Local knowledge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/planning/local-knowledge/ask — ask a follow-up question about local knowledge
router.post('/local-knowledge/ask', async (req, res) => {
  try {
    const { question, localKnowledge, route } = req.body;

    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const systemPrompt = `You are a local coastal and waterway expert for kayakers.
You have already researched a specific paddle route and have detailed local knowledge available.
Answer the user's question using that knowledge. Be concise and practical — 2–4 sentences maximum.
Focus on safety-relevant details. If the question is outside your knowledge, say so honestly.`;

    const routeContext = route
      ? `Route: ${route.name || 'Unnamed'} — ${route.distanceKm || '?'} km, ${route.terrain || 'coastal'}, launch: ${route.launchPoint || 'unknown'}`
      : '';

    const knowledgeContext = localKnowledge
      ? `\n\nLocal knowledge already gathered:\n${JSON.stringify(localKnowledge, null, 2)}`
      : '';

    const userMessage = `${routeContext}${knowledgeContext}\n\nQuestion: ${question}`;

    const answer = await callClaudeAPI(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
    );

    res.json({ answer });
  } catch (error) {
    console.error('Local knowledge ask error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Coordinate-grounded photos with attribution; no generated landmark guesses.
router.post('/photos', async (req, res, next) => {
  try {
    const { route } = req.body;
    if (!route || !Array.isArray(route.waypoints) || route.waypoints.length > 1000) {
      return res.status(400).json({ error: 'A route with up to 1000 waypoints is required.' });
    }
    res.json(await require('../lib/routePhotos').fetchRoutePhotos(route));
  } catch (error) { next(error); }
});

module.exports = router;
