export const validPoint = (point) =>
  Array.isArray(point) &&
  point.length >= 2 &&
  point.every(Number.isFinite) &&
  Math.abs(point[0]) <= 90 &&
  Math.abs(point[1]) <= 180;

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const value =
    Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 +
    Math.cos(a[0] * rad) *
      Math.cos(b[0] * rad) *
      Math.sin(((b[1] - a[1]) * rad) / 2) ** 2;
  return (
    6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
  );
}
export function trackDistance(points) {
  return points.reduce(
    (sum, point, index) =>
      index ? sum + distanceKm(points[index - 1], point) : 0,
    0,
  );
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(date, count) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}
export function formatHours(hours) {
  const minutes = Math.round(hours * 60);
  return (
    `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? ` ${minutes % 60}m` : ""}`.trim() ||
    "0m"
  );
}
