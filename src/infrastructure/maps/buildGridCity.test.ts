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

  it('spreads traffic lights across many streets, on both axes and directions', () => {
    const map = buildGridCity();
    const vertical = map.trafficLights.filter((l) => l.axis === 'z');
    const horizontal = map.trafficLights.filter((l) => l.axis === 'x');
    expect(new Set(vertical.map((l) => Math.round((l.laneMin + l.laneMax) / 2))).size).toBeGreaterThan(2);
    expect(new Set(horizontal.map((l) => Math.round((l.laneMin + l.laneMax) / 2))).size).toBeGreaterThan(2);
    expect(map.trafficLights.some((l) => l.travelSign === -1)).toBe(true);
  });

  it('controls a junction with all its approaches, N-S and E-W in opposite phases', () => {
    const map = buildGridCity();
    const byJunction = new Map<string, typeof map.trafficLights>();
    for (const l of map.trafficLights) {
      const key = l.id.split('-').slice(1, 3).join('-');
      byJunction.set(key, [...(byJunction.get(key) ?? []), l]);
    }
    // Interior controlled junctions have exactly 4 approaches.
    const interior = [...byJunction.values()].filter((ls) => ls.length === 4);
    expect(interior.length).toBeGreaterThan(0);
    for (const lights of interior) {
      const ns = lights.filter((l) => l.axis === 'z');
      const ew = lights.filter((l) => l.axis === 'x');
      expect(ns).toHaveLength(2);
      expect(ew).toHaveLength(2);
      expect(Math.abs(ew[0].phaseOffset - ns[0].phaseOffset)).toBeCloseTo(9); // half cycle
    }
  });

  it('leaves some junctions uncontrolled (streets are not homogeneous)', () => {
    const map = buildGridCity();
    const controlledJunctions = new Set(map.trafficLights.map((l) => l.id.split('-').slice(1, 3).join('-')));
    const totalJunctions = 6 * 6; // (blocks + 1)^2 road lines
    expect(controlledJunctions.size).toBeGreaterThan(4);
    expect(controlledJunctions.size).toBeLessThan(totalJunctions);
  });

  it('places zebra crossings on both road axes, map-wide', () => {
    const map = buildGridCity();
    expect(map.crossings.some((c) => c.axis === 'z')).toBe(true);
    expect(map.crossings.some((c) => c.axis === 'x')).toBe(true);
    expect(new Set(map.crossings.map((c) => `${Math.round(c.x)}|${Math.round(c.z)}`)).size).toBeGreaterThan(20);
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
