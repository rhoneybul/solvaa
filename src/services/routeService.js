import { SKILL_LEVELS } from './stravaService';

/**
 * Kayak Route Planning Engine
 * Based on real kayaking best practices:
 * - Wind: Paddle into headwind going out, downwind return when tired
 * - Tides: Use tidal streams, avoid tide races
 * - Distance: 3-4 km/h average paddling speed
 * - Safety: Always stay within swim-to-shore distance for beginners
 */

const ROUTE_TEMPLATES = {
  // Flat water / lake routes
  flat_water_circuit: {
    type: 'flat_water',
    name: 'Sheltered Lake Circuit',
    pattern: 'circular',
    terrain: 'lake',
    challenges: ['none'],
    tips: [
      'Stick to the sheltered side in any wind',
      'Take breaks at the far shore',
      'Watch for motorboat wakes',
    ],
  },
  coastal_there_back: {
    type: 'coastal',
    name: 'Coastal Out & Back',
    pattern: 'out_and_back',
    terrain: 'sea',
    challenges: ['wind', 'waves', 'tides'],
    tips: [
      'Paddle into the wind first while fresh',
      'Hug the coastline for shelter',
      'Check tide times before departure',
      'Keep visual on landing beaches',
    ],
  },
  river_downstream: {
    type: 'river',
    name: 'River Downstream Paddle',
    pattern: 'point_to_point',
    terrain: 'river',
    challenges: ['current', 'obstacles'],
    tips: [
      'Scout rapids before running them',
      'Read the current to find fastest water',
      'Eddy hop to control pace',
      'Arrange shuttle vehicle at takeout',
    ],
  },
  island_hop: {
    type: 'island_hopping',
    name: 'Island Hopping Adventure',
    pattern: 'multi_point',
    terrain: 'sea',
    challenges: ['crossings', 'wind', 'tides'],
    tips: [
      'Plan crossings for slack tide',
      'Never cross in winds over 15 knots',
      'Each island is a bail-out point',
      'Time crossings for calm morning windows',
    ],
  },
  sea_expedition: {
    type: 'sea_expedition',
    name: 'Coastal Expedition',
    pattern: 'multi_day',
    terrain: 'sea',
    challenges: ['open_water', 'weather', 'camping'],
    tips: [
      'File a float plan with a contact ashore',
      'Carry VHF radio and flares',
      'Camp above high-tide line',
      'Have emergency bailout routes planned',
    ],
  },
};

/**
 * Generate route recommendations based on conditions and skill
 */
export function generateRoutes({ tripType, skillLevel, weather, location, durationDays = 1 }) {
  const skill = SKILL_LEVELS[skillLevel.key?.toUpperCase()] || skillLevel;
  const windKnots = weather.current.windSpeed;
  const waveM = weather.current.waveHeight;
  const isSafe = windKnots <= skill.maxWindKnots && waveM <= skill.maxWaveM;

  const routes = [];

  // Determine appropriate route types
  const eligibleTypes = skill.preferredRouteTypes;

  eligibleTypes.forEach(routeType => {
    const template = getTemplateForType(routeType);
    if (!template) return;

    const distKm = calcRecommendedDistance(skill, durationDays, windKnots);
    const durationHours = calcDuration(distKm, windKnots);

    // Generate waypoints (descriptive, real map integration via Claude Code)
    const waypoints = generateWaypoints(template.pattern, distKm, location);

    routes.push({
      id: `route_${routeType}_${Date.now()}`,
      template,
      name: template.name,
      distanceKm: distKm,
      durationHours,
      durationDays,
      waypoints,
      difficulty: getDifficulty(windKnots, waveM, skill),
      suitability: calcSuitability(windKnots, waveM, skill, template),
      weatherWindow: getWeatherWindow(weather),
      tideConsideration: template.terrain === 'sea' ? getTideAdvice(weather) : null,
      packingList: generatePackingList(durationDays, weather),
      safetyBriefing: generateSafetyBriefing(skill, weather, template),
      tips: template.tips,
      breakpoints: generateBreakpoints(waypoints, distKm),
      emergencyExits: generateEmergencyExits(template.terrain),
    });
  });

  // Sort by suitability score
  routes.sort((a, b) => b.suitability - a.suitability);
  return routes.slice(0, 3); // Top 3 options
}

function getTemplateForType(type) {
  const map = {
    flat_water: ROUTE_TEMPLATES.flat_water_circuit,
    sheltered_bay: ROUTE_TEMPLATES.flat_water_circuit,
    coastal: ROUTE_TEMPLATES.coastal_there_back,
    lake_crossing: ROUTE_TEMPLATES.flat_water_circuit,
    river: ROUTE_TEMPLATES.river_downstream,
    open_water: ROUTE_TEMPLATES.island_hop,
    sea_kayak: ROUTE_TEMPLATES.island_hop,
    expedition: ROUTE_TEMPLATES.sea_expedition,
    surf_zone: ROUTE_TEMPLATES.coastal_there_back,
  };
  return map[type];
}

function calcRecommendedDistance(skill, days, windKnots) {
  const baseDaily = skill.maxDistKm * 0.7; // 70% of max for comfortable day
  const windPenalty = Math.max(0, (windKnots - 5) * 0.8); // Each knot over 5 costs distance
  const adjusted = Math.max(3, baseDaily - windPenalty);
  return Math.round(adjusted * days);
}

function calcDuration(distKm, windKnots) {
  const paddleSpeed = Math.max(2, 4 - windKnots * 0.1); // km/h, slows in wind
  const paddleTime = distKm / paddleSpeed;
  const breakTime = Math.floor(distKm / 10) * 0.25; // 15 min break every 10km
  return Math.round((paddleTime + breakTime) * 10) / 10;
}

function generateWaypoints(pattern, distKm, location) {
  // Descriptive waypoints - in real app these come from a marine charts API
  const base = location || { lat: 51.5, lon: -0.1 };
  const step = distKm / 1000 * 0.009; // rough degree per km

  switch (pattern) {
    case 'circular':
      return [
        { name: 'Launch Point', lat: base.lat, lon: base.lon, type: 'start' },
        { name: 'East Shore Rest', lat: base.lat + step, lon: base.lon + step * 0.5, type: 'waypoint' },
        { name: 'Far Point', lat: base.lat + step * 1.5, lon: base.lon, type: 'waypoint' },
        { name: 'Return', lat: base.lat, lon: base.lon, type: 'finish' },
      ];
    case 'out_and_back':
      return [
        { name: 'Launch Beach', lat: base.lat, lon: base.lon, type: 'start' },
        { name: 'Midpoint Rest', lat: base.lat + step, lon: base.lon + step * 0.3, type: 'waypoint' },
        { name: 'Turnaround Point', lat: base.lat + step * 2, lon: base.lon + step * 0.6, type: 'turnaround' },
        { name: 'Launch Beach', lat: base.lat, lon: base.lon, type: 'finish' },
      ];
    case 'point_to_point':
      return [
        { name: 'Put-in', lat: base.lat, lon: base.lon, type: 'start' },
        { name: 'Mid Section', lat: base.lat + step, lon: base.lon - step * 0.2, type: 'waypoint' },
        { name: 'Take-out', lat: base.lat + step * 2.5, lon: base.lon - step * 0.5, type: 'finish' },
      ];
    default:
      return [
        { name: 'Start', lat: base.lat, lon: base.lon, type: 'start' },
        { name: 'End', lat: base.lat + step, lon: base.lon + step, type: 'finish' },
      ];
  }
}

function getDifficulty(windKnots, waveM, skill) {
  if (windKnots > 20 || waveM > 1.2) return { label: 'Challenging', color: '#FF4D6D', stars: 5 };
  if (windKnots > 15 || waveM > 0.8) return { label: 'Moderate', color: '#FFB347', stars: 3 };
  if (windKnots > 10 || waveM > 0.4) return { label: 'Easy-Moderate', color: '#FFD166', stars: 2 };
  return { label: 'Easy', color: '#00D4AA', stars: 1 };
}

function calcSuitability(windKnots, waveM, skill, template) {
  let score = 100;
  if (windKnots > skill.maxWindKnots) score -= (windKnots - skill.maxWindKnots) * 5;
  if (waveM > skill.maxWaveM) score -= (waveM - skill.maxWaveM) * 20;
  // Terrain matching
  if (skill.key === 'beginner' && template.terrain === 'sea') score -= 20;
  if (skill.key === 'expert' && template.terrain === 'lake') score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getWeatherWindow(weather) {
  // Find best 4-hour window in next 12 hours
  const good = weather.hourly.filter(h => h.windSpeed <= 15 && h.precipProb <= 30);
  if (good.length === 0) return { label: 'No ideal window', color: '#FF4D6D' };
  const first = new Date(good[0].time);
  const hour = first.getHours();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour || 12;
  return { label: `Best: ${displayHour}:00 ${ampm}`, color: '#00D4AA', time: good[0].time };
}

function getTideAdvice(weather) {
  // Simplified - in production this uses real tide API
  return {
    advice: 'Check local tide tables. Plan crossings at slack water.',
    link: 'https://tidesandcurrents.noaa.gov',
  };
}

function generatePackingList(days, weather) {
  const base = [
    '🛶 Kayak + paddle + spare paddle',
    '🦺 PFD (life jacket) — mandatory',
    '🪣 Bilge pump',
    '🧭 Compass + waterproof map',
    '📱 Charged phone in dry bag',
    '💧 2L water minimum per person',
    '🍫 High-energy snacks',
    '🩹 First aid kit',
    '🌡️ Wetsuit or drysuit (water temp dependent)',
    '🧢 Sun hat + sunscreen SPF 50+',
    '👓 Polarized sunglasses',
    '📡 Whistle + signal mirror',
  ];

  if (days > 1) {
    base.push(
      '⛺ Tent + sleeping system',
      '🍳 Camp stove + meals',
      '🔦 Headlamp',
      '📻 VHF marine radio',
      '🔥 Emergency flares',
      '🗺️ Float plan filed with contact ashore',
    );
  }

  if (weather.current.condition.severity !== 'none') {
    base.push('🧤 Neoprene gloves', '🌂 Waterproof jacket', '🥾 Wetsuit boots');
  }

  return base;
}

function generateSafetyBriefing(skill, weather, template) {
  const points = [];
  const wind = weather.current.windSpeed;

  if (wind > 15) points.push(`⚠️ Wind at ${wind} knots — conditions are above beginner threshold. Reassess at launch.`);
  if (template.terrain === 'sea') points.push('🌊 Coastal paddling: Always stay within sight of shore unless experienced.');
  if (skill.key === 'beginner') {
    points.push('🆘 Never paddle alone. Stay within 200m of shore.');
    points.push('📞 Tell someone your plan and expected return time.');
  }
  points.push('🔄 If conditions deteriorate, turn back immediately — ego kills.');
  points.push('💧 Hypothermia risk: dress for the water temperature, not air temperature.');

  return points;
}

function generateBreakpoints(waypoints, distKm) {
  const interval = Math.round(distKm / 3);
  return waypoints
    .filter(w => w.type === 'waypoint')
    .map(w => ({ ...w, restDuration: '10-15 min', note: 'Hydrate, snack, check conditions' }));
}

function generateEmergencyExits(terrain) {
  switch (terrain) {
    case 'sea':
      return ['Head to nearest beach immediately', 'Call Coastguard: VHF Ch 16', 'Activate PLB if life-threatening'];
    case 'river':
      return ['Eddy out to bank', 'Scout hazards from shore', 'Call emergency services'];
    default:
      return ['Paddle to nearest shore', 'Call emergency services if needed'];
  }
}

/**
 * Real-time condition assessment during paddle
 */
export function assessRealTimeConditions(currentWeather, routeProgress, skillLevel) {
  const skill = SKILL_LEVELS[skillLevel?.key?.toUpperCase()] || skillLevel;
  const warnings = [];
  const recommendations = [];

  const wind = currentWeather.windSpeed;
  const wave = currentWeather.waveHeight;

  // Wind change assessment
  if (wind > skill.maxWindKnots * 0.9) {
    warnings.push({
      severity: 'high',
      message: `Wind approaching your limit (${wind} knots). Consider heading to shore.`,
      icon: '💨',
    });
  }

  // Deteriorating conditions
  if (currentWeather.condition.severity === 'severe') {
    warnings.push({
      severity: 'critical',
      message: 'Severe weather. Land immediately at nearest safe point.',
      icon: '⛈️',
    });
  }

  // Progress-based recommendations
  const progress = routeProgress?.percentComplete || 0;
  if (progress < 50 && wind > skill.maxWindKnots * 0.7) {
    recommendations.push({
      type: 'turn_back',
      message: 'Conditions worsening before halfway. Recommend returning now.',
      icon: '↩️',
    });
  }

  if (routeProgress?.distanceFromStart > 0) {
    const etaMinutes = (routeProgress.distanceRemaining / 3) * 60;
    recommendations.push({
      type: 'info',
      message: `~${Math.round(etaMinutes)} min to finish at current pace`,
      icon: '⏱️',
    });
  }

  return { warnings, recommendations };
}
