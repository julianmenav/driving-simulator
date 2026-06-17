import { describe, expect, it } from 'vitest';
import type { CircuitSpec } from '../map/MapManifest';
import { buildCheckpoints } from './checkpoints';

const circuit: CircuitSpec = {
  controlPoints: [
    { x: -50, z: -50 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
    { x: -50, z: 50 },
  ],
  width: 10,
};

describe('buildCheckpoints', () => {
  it('produces the requested number of ordered gates, indexed from 0', () => {
    const gates = buildCheckpoints(circuit, 16);
    expect(gates).toHaveLength(16);
    expect(gates.map((g) => g.index)).toEqual([...Array(16).keys()]);
  });

  it('gives each gate a unit tangent and the track-derived half width', () => {
    const gates = buildCheckpoints(circuit, 12);
    for (const g of gates) {
      expect(Math.hypot(g.tx, g.tz)).toBeCloseTo(1, 5);
      expect(g.halfWidth).toBe(circuit.width / 2 + 2);
    }
  });
});
