/**
 * weatherService — fetches weather with:
 * 1. Local AsyncStorage cache (3hr TTL, works offline)
 * 2. Server proxy at /api/weather (server-side 30min cache)
 * 3. Direct Open-Meteo fallback if server unavailable
 */
import { getCachedWeather, saveWeatherCache } from './storageService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchWeather(lat, lon) {
  // Try server proxy first
  try {
    const res = await fetch(`${API_URL}/api/weather?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const raw = await res.json();
      const parsed = parseWeatherData(raw);
      await saveWeatherCache(lat, lon, parsed);
      return parsed;
    }
  } catch (_) {}

  // Fall back to direct Open-Meteo
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation,wave_height` +
    `&hourly=temperature_2m,windspeed_10m,precipitation_probability,weathercode,wave_height` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,sunrise,sunset,precipitation_sum` +
    `&forecast_days=3&timezone=auto&windspeed_unit=knots`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const raw = await res.json();
  const parsed = parseWeatherData(raw);
  await saveWeatherCache(lat, lon, parsed);
  return parsed;
}

export async function getWeatherWithCache(lat, lon) {
  const cached = await getCachedWeather(lat, lon);
  if (cached) return cached;
  return fetchWeather(lat, lon);
}

function parseWeatherData(raw) {
  const { current, hourly, daily } = raw;
  if (!current) throw new Error('Invalid weather response');

  const currentConditions = {
    temp:          Math.round(current.temperature_2m),
    windSpeed:     Math.round(current.windspeed_10m),
    windDir:       current.winddirection_10m,
    windDirLabel:  degreesToCardinal(current.winddirection_10m),
    precipitation: current.precipitation,
    weatherCode:   current.weathercode,
    condition:     wmoToCondition(current.weathercode),
    waveHeight:    current.wave_height || 0,
    timestamp:     new Date().toISOString(),
  };

  const now = new Date();
  const hourlyForecast = [];
  for (let i = 0; i < Math.min(hourly.time.length, 24); i++) {
    if (new Date(hourly.time[i]) >= now) {
      hourlyForecast.push({
        time:       hourly.time[i],
        temp:       Math.round(hourly.temperature_2m[i]),
        windSpeed:  Math.round(hourly.windspeed_10m[i]),
        precipProb: hourly.precipitation_probability[i],
        condition:  wmoToCondition(hourly.weathercode[i]),
        waveHeight: hourly.wave_height?.[i] || 0,
      });
      if (hourlyForecast.length >= 8) break;
    }
  }

  const dailyForecast = (daily.time || []).map((date, i) => ({
    date,
    condition:     wmoToCondition(daily.weathercode[i]),
    tempMax:       Math.round(daily.temperature_2m_max[i]),
    tempMin:       Math.round(daily.temperature_2m_min[i]),
    windMax:       Math.round(daily.windspeed_10m_max[i]),
    precipitation: Math.round(daily.precipitation_sum?.[i] || 0),
    sunrise:       daily.sunrise[i],
    sunset:        daily.sunset[i],
  }));

  const safetyScore = calcSafetyScore(currentConditions);
  const bestHour = hourlyForecast.find(h => h.windSpeed <= 15 && h.precipProb <= 30);

  return {
    current:       currentConditions,
    hourly:        hourlyForecast,
    daily:         dailyForecast,
    safetyScore,
    safetyLabel:   safetyScore >= 80 ? 'Excellent' : safetyScore >= 60 ? 'Good' : safetyScore >= 40 ? 'Moderate' : 'Challenging',
    safetyColor:   safetyScore >= 80 ? '#3a6a4a' : safetyScore >= 60 ? '#4a6a8a' : safetyScore >= 40 ? '#8a6a2a' : '#8a4a3a',
    weatherWindow: bestHour
      ? { label: `Best: ${new Date(bestHour.time).getHours()}:00`, color: '#3a6a4a', time: bestHour.time }
      : { label: 'No ideal window today', color: '#8a6a2a' },
    fetchedAt: Date.now(),
  };
}

function calcSafetyScore(c) {
  let score = 100;
  if (c.windSpeed > 25)      score -= 45;
  else if (c.windSpeed > 20) score -= 30;
  else if (c.windSpeed > 15) score -= 15;
  else if (c.windSpeed > 10) score -= 5;
  if (c.waveHeight > 2)      score -= 30;
  else if (c.waveHeight > 1) score -= 15;
  else if (c.waveHeight > 0.5) score -= 5;
  const sev = c.condition.severity;
  if (sev === 'severe')      score -= 30;
  else if (sev === 'moderate') score -= 15;
  else if (sev === 'light')  score -= 5;
  return Math.max(0, Math.min(100, score));
}

function degreesToCardinal(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function wmoToCondition(code) {
  if (code === 0) return { label: 'Clear',         icon: '☀️',  severity: 'none' };
  if (code <= 3)  return { label: 'Partly Cloudy', icon: '⛅',  severity: 'none' };
  if (code <= 9)  return { label: 'Foggy',         icon: '🌫️', severity: 'light' };
  if (code <= 29) return { label: 'Drizzle',       icon: '🌦️', severity: 'light' };
  if (code <= 39) return { label: 'Rain',          icon: '🌧️', severity: 'moderate' };
  if (code <= 59) return { label: 'Drizzle',       icon: '🌦️', severity: 'light' };
  if (code <= 69) return { label: 'Rain',          icon: '🌧️', severity: 'moderate' };
  if (code <= 79) return { label: 'Snow',          icon: '❄️',  severity: 'moderate' };
  if (code <= 84) return { label: 'Rain Showers',  icon: '🌦️', severity: 'moderate' };
  return { label: 'Thunderstorm', icon: '⛈️', severity: 'severe' };
}
