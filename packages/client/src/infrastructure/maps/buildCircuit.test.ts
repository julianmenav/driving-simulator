import { describe, expect, it } from 'vitest';
import { distanceToCircuit, sampleCircuit } from '@domain/map/circuit';
import { buildCircuit } from './buildCircuit';

describe('buildCircuit', () => {
  const map = buildCircuit();
  const samples = sampleCircuit(map.circuit!);
  const half = map.circuit!.width / 2;

  it('has a circuit, no grid roads (so no NPCs) and is locked to night', () => {
    expect(map.circuit).toBeDefined();
    expect(map.roads).toHaveLength(0);
    expect(map.lockedNight).toBe(true);
  });

  it('spawns the car on the track', () => {
    expect(distanceToCircuit(samples, map.spawn.x, map.spawn.z)).toBeLessThanOrEqual(half);
  });

  it('keeps every building off the track surface', () => {
    for (const b of map.buildings) {
      expect(distanceToCircuit(samples, b.x, b.z)).toBeGreaterThan(half);
    }
  });

  it('has rolling hills (terrain varies) with no cliffs (neighbours differ by <=1 level)', () => {
    const { levels } = map.terrain;
    expect(Math.max(...levels.flat())).toBeGreaterThan(0);
    for (let iz = 0; iz < levels.length; iz++) {
      for (let ix = 0; ix < levels[iz].length; ix++) {
        if (ix > 0) expect(Math.abs(levels[iz][ix] - levels[iz][ix - 1])).toBeLessThanOrEqual(1);
        if (iz > 0) expect(Math.abs(levels[iz][ix] - levels[iz - 1][ix])).toBeLessThanOrEqual(1);
      }
    }
  });
});
