/**
 * Normalize coordinates without silently relocating a route.
 * A coarse sea mask cannot validate inland water or the segments between points.
 * Geometry must remain an unverified outline until backed by a routing provider.
 */
function refineRouteWaypoints(waypoints) {
  if (!Array.isArray(waypoints))
    throw new Error("Route waypoints must be an array");
  const points = waypoints.map((point) =>
    Array.isArray(point)
      ? [Number(point[0]), Number(point[1])]
      : [Number(point?.lat), Number(point?.lon ?? point?.lng)],
  );
  if (
    points.length < 2 ||
    points.length > 1000 ||
    points.some(
      (point) =>
        !point.every(Number.isFinite) ||
        Math.abs(point[0]) > 90 ||
        Math.abs(point[1]) > 180,
    )
  ) {
    throw new Error("Route contains invalid coordinates");
  }
  return points;
}
module.exports = { refineRouteWaypoints };
