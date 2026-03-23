const express = require('express');
const router = express.Router();

// Claude API service — moved from frontend to avoid CORS
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';

/** Default request timeout in ms (30 seconds). */
const REQUEST_TIMEOUT_MS = 30000;

/** Maximum number of retries on timeout or malformed JSON. */
const MAX_RETRIES = 2;

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

Always prioritize safety and realistic planning.`;

async function callClaudeAPI(messages, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${errBody?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

function parseRoutesResponse(text) {
  // Parse the JSON response from Claude
  try {
    const parsed = JSON.parse(text);
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
      return res.json(JSON.parse(responseText.replace(/```json|```/g, '').trim()));
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

    res.json(result);
  } catch (error) {
    console.error('Planning error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;