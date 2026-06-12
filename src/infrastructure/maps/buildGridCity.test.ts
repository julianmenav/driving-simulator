import { describe, expect, it } from 'vitest';
import { elevationAt } from '@domain/map/elevation';
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
    expect(map.buildings.length).toBe(25); // 5x5 blocks
    expect(map.speedZones.some((z) => z.limitKmh === 30)).toBe(true);
  });

  it('scales the building grid with the blocks option', () => {
    expect(buildGridCity({ blocks: 3 }).buildings.length).toBe(9);
  });

  it('places zebra crossings on the spawn avenue', () => {
    const map = buildGridCity();
    expect(map.crossings.length).toBeGreaterThan(0);
    expect(map.crossings.every((c) => c.x === map.spawn.x)).toBe(true);
  });

  it('places northbound traffic lights along the spawn avenue', () => {
    const map = buildGridCity();
    expect(map.trafficLights.length).toBeGreaterThan(0);
    expect(map.trafficLights.every((l) => l.axis === 'z' && l.travelSign === 1)).toBe(true);
    // The spawn avenue lane band contains the spawn x.
    expect(map.trafficLights.every((l) => l.laneMin <= map.spawn.x && map.spawn.x <= l.laneMax)).toBe(true);
  });

  it('spawns the vehicle on a road', () => {
    const map = buildGridCity();
    const onRoad = map.roads.some((r) => contains(r, map.spawn.x, map.spawn.z));
    expect(onRoad).toBe(true);
  });

  it('terrain levels never step more than one between adjacent cells', () => {
    const { levels } = buildGridCity().terrain;
    for (let iz = 0; iz < levels.length; iz++) {
      for (let ix = 0; ix < levels[iz].length; ix++) {
        if (ix > 0) expect(Math.abs(levels[iz][ix] - levels[iz][ix - 1])).toBeLessThanOrEqual(1);
        if (iz > 0) expect(Math.abs(levels[iz][ix] - levels[iz - 1][ix])).toBeLessThanOrEqual(1);
      }
    }
  });

  it('spawns on near-flat ground (no slope under the starting car)', () => {
    const map = buildGridCity();
    const here = elevationAt(map.terrain, map.spawn.x, map.spawn.z);
    const ahead = elevationAt(map.terrain, map.spawn.x, map.spawn.z + 5);
    expect(Math.abs(ahead - here)).toBeLessThan(0.2);
  });

  it('the spawn avenue runs north through the 30 km/h band', () => {
    const map = buildGridCity();
    // At spawn the limit is the 50 default; ahead (z = 0) it drops to 30.
    expect(resolveSpeedLimit(map, map.spawn.x, map.spawn.z)).toBe(50);
    expect(resolveSpeedLimit(map, map.spawn.x, 0)).toBe(30);
  });
});
