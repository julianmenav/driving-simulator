import { describe, expect, it } from 'vitest';
import type { TerrainSpec } from './MapManifest';
import { elevationAt } from './elevation';

const terrain: TerrainSpec = {
  components: [
    { amplitude: 2, wavelengthX: 30, wavelengthZ: 30, phase: 0.4 },
    { amplitude: 1, wavelengthX: 18, wavelengthZ: 18, phase: 1.7 },
  ],
};

describe('elevationAt', () => {
  it('is deterministic', () => {
    expect(elevationAt(terrain, 12, -7)).toBe(elevationAt(terrain, 12, -7));
  });

  it('is bounded by the sum of amplitudes', () => {
    const max = terrain.components.reduce((s, c) => s + c.amplitude, 0);
    for (let x = -200; x <= 200; x += 13) {
      for (let z = -200; z <= 200; z += 17) {
        expect(Math.abs(elevationAt(terrain, x, z))).toBeLessThanOrEqual(max + 1e-9);
      }
    }
  });

  it('varies across the map (not flat)', () => {
    expect(elevationAt(terrain, 0, 0)).not.toBe(elevationAt(terrain, 45, 60));
  });
});
