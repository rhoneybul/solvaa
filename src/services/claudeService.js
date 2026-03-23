/**
 * Claude API service
 * Reads EXPO_PUBLIC_CLAUDE_API_KEY from .env
 */

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '';

const SYSTEM_PROMPT = `You are a kayaking trip planner assistant built into the Paddle app.

When a user describes a paddle they want to do, extract and respond with a structured JSON plan. Parse natural language like:
- Location (explicit or implied)
- Duration (hours, days, weekend, week)
- Trip type (day paddle, multi-day, camping)
- Access (own transport, car, public transport)
- Skill level if mentioned
- Any preferences (coastal, river, lake, sheltered, challenging)

Respond ONLY with a valid JSON object (no markdown, no backticks, no preamble) in this exact structure:
{
  "understood": "One sentence confirming what you understood",
  "location": {
    "base": "City/town they are in or near",
    "searchRadius": "how far they can travel in km as a number",
    "transport": "own car | public transport | unknown"
  },
  "trip": {
    "type": "day_paddle | weekend | week | multi_day",
    "durationHours": number or null,
    "durationDays": number or null,
    "paddlingHoursPerDay": number
  },
  "conditions": {
    "skillLevel": "beginner | intermediate | advanced | unknown",
    "terrainPreference": "coastal | river | lake | any",
    "sheltered": true or false
  },
  "routes": [
    {
      "name": "Route name",
      "location": "Specific place name",
      "distanceKm": number,
      "durationHours": number,
      "terrain": "coastal | river | lake | estuary",
      "difficulty": "easy | moderate | challenging",
      "why": "One sentence why this suits them",
      "travelFromBase": "How to get there",
      "travelTimeMin": number,
      "highlights": ["highlight 1", "highlight 2"],
      "launchPoint": "Specific beach/slipway/put-in name",
      "bestConditions": "Wind/tide advice specific to this spot"
    }
  ],
  "campsites": [
    {
      "name": "Campsite name",
      "nearRoute": "Route name it is near",
      "distanceFromWaterKm": number,
      "type": "beach | formal | wild",
      "notes": "Brief useful note"
    }
  ],
  "weatherNote": "General seasonal weather note for the area and time of year",
  "packingHighlights": ["item 1", "item 2", "item 3", "item 4", "item 5"],
  "safetyNote": "One specific safety note relevant to these routes"
}

Be specific with real place names. If in the UK, suggest real UK paddling spots.
If they mention Axminster, suggest the River Axe estuary, Lyme Bay, Seaton.
If they mention London with a car, suggest Chichester Harbour, Norfolk Broads, River Wye, Lyme Regis.
If Bristol, suggest Pembrokeshire, Gower Peninsula, River Wye.
Give genuinely useful, accurate local knowledge.`;

/**
 * Plan a paddle trip from a natural language prompt
 * @param {string} userPrompt - The user's free text description
 * @returns {Promise<Object>} - Parsed trip plan
 */
export async function planPaddle(userPrompt) {
  if (!CLAUDE_API_KEY || CLAUDE_API_KEY === 'sk-ant-your-key-here') {
    throw new Error('CLAUDE_API_KEY not set. Add EXPO_PUBLIC_CLAUDE_API_KEY to your .env file.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Strip any accidental markdown fences
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse trip plan. Try rephrasing your request.');
  }
}

export const hasApiKey = () =>
  !!CLAUDE_API_KEY && CLAUDE_API_KEY !== 'sk-ant-your-key-here';
