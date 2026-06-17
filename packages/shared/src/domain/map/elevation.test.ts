import { describe, expect, it } from 'vitest';
import type { TerrainSpec } from './MapManifest';
import { elevationAt } from './elevation';

// 3x3 cells, 100 m apart, centred so cell [1][1] is at the origin.
const terrain: TerrainSpec = {
  levelHeight: 1.5,
  cellSize: 100,
  originX: -100,
  originZ: -100,
  levels: [
    [0, 1, 2],
    [0, 1, 2],
    [1, 1, 2],
  ],
};

describe('elevationAt', () => {
  it('returns the plateau height at a cell centre', () => {
    expect(elevationAt(terrain, -100, -100)).toBeCloseTo(0, 5); // level 0
    expect(elevationAt(terrain, 0, 0)).toBeCloseTo(1.5, 5); // level 1
    expect(elevationAt(terrain, 100, 0)).toBeCloseTo(3.0, 5); // level 2
  });

  it('is flat near a cell centre (plateau, not a peak)', () => {
    const centre = elevationAt(terrain, 0, 0);
    expect(elevationAt(terrain, 12, -9)).toBeCloseTo(centre, 1);
  });

  it('passes half the step at the midpoint between two adjacent levels', () => {
    // Between cell [0][0] (level 0, x=-100) and [0][1] (level 1, x=0) at z=-100.
    expect(elevationAt(terrain, -50, -100)).toBeCloseTo(0.75, 5);
  });

  it('rises monotonically across a level boundary', () => {
    let previous = -Infinity;
    for (let x = -100; x <= 0; x += 10) {
      const y = elevationAt(terrain, x, -100);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });

  it('clamps outside the grid to the edge plateau', () => {
    expect(elevationAt(terrain, -500, -500)).toBeCloseTo(0, 5);
    expect(elevationAt(terrain, 500, 0)).toBeCloseTo(3.0, 5);
  });

  it('is deterministic', () => {
    expect(elevationAt(terrain, 33, -47)).toBe(elevationAt(terrain, 33, -47));
  });
});
