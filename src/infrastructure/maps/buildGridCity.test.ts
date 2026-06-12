import { describe, expect, it } from 'vitest';
import { resolveSpeedLimit } from '@domain/map/resolveSpeedLimit';
import type { Rect } from '@domain/map/MapManifest';
import { buildGridCity } from './buildGridCity';

const contains = (r: Rect, x: number, z: number) =>
  Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.depth / 2;

describe('buildGridCity', () => {
  it('produces a non-empty, well-formed manifest', () => {
    const map = buildGridCity();
    expect(map.defaultLimitKmh).toBe(50);
    expect(map.roads.length).toBeGreaterThan(0);
    expect(map.buildings.length).toBe(9); // 3x3 blocks
    expect(map.speedZones.some((z) => z.limitKmh === 30)).toBe(true);
  });

  it('spawns the vehicle on a road', () => {
    const map = buildGridCity();
    const onRoad = map.roads.some((r) => contains(r, map.spawn.x, map.spawn.z));
    expect(onRoad).toBe(true);
  });

  it('the spawn avenue runs north through the 30 km/h band', () => {
    const map = buildGridCity();
    // At spawn the limit is the 50 default; ahead (z = 0) it drops to 30.
    expect(resolveSpeedLimit(map, map.spawn.x, map.spawn.z)).toBe(50);
    expect(resolveSpeedLimit(map, map.spawn.x, 0)).toBe(30);
  });
});
