import type { MapManifest, Rect } from './MapManifest';

/** Whether the point (x,z) lies within the axis-aligned rectangle. */
function contains(rect: Rect, x: number, z: number): boolean {
  return (
    Math.abs(x - rect.x) <= rect.width / 2 && Math.abs(z - rect.z) <= rect.depth / 2
  );
}

/**
 * Speed limit (km/h) that applies at a point. The last matching speed zone
 * wins (so a smaller zone listed after a larger one overrides it), falling back
 * to the map's default limit when the point is in no zone.
 */
export function resolveSpeedLimit(map: MapManifest, x: number, z: number): number {
  let limit = map.defaultLimitKmh;
  for (const zone of map.speedZones) {
    if (contains(zone, x, z)) limit = zone.limitKmh;
  }
  return limit;
}
