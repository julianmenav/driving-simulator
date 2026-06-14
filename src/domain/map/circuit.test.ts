import { describe, expect, it } from 'vitest';
import { headingOf, sampleCircuit } from './circuit';
import type { CircuitSpec } from './MapManifest';

const SQUARE: CircuitSpec = {
  width: 10,
  controlPoints: [
    { x: 50, z: 50 },
    { x: -50, z: 50 },
    { x: -50, z: -50 },
    { x: 50, z: -50 },
  ],
};

describe('sampleCircuit', () => {
  const samplesPerSegment = 16;
  const samples = sampleCircuit(SQUARE, samplesPerSegment);

  it('produces one full loop (samplesPerSegment per control point)', () => {
    expect(samples).toHaveLength(SQUARE.controlPoints.length * samplesPerSegment);
  });

  it('passes through each control point at the segment start (Catmull-Rom property)', () => {
    SQUARE.controlPoints.forEach((p, i) => {
      const s = samples[i * samplesPerSegment];
      expect(s.x).toBeCloseTo(p.x, 6);
      expect(s.z).toBeCloseTo(p.z, 6);
    });
  });

  it('emits unit tangents everywhere (no NaN, no zero-length)', () => {
    for (const s of samples) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.z)).toBe(true);
      expect(Math.hypot(s.tx, s.tz)).toBeCloseTo(1, 6);
    }
  });

  it('is closed: consecutive samples (incl. wrap) stay close together', () => {
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % samples.length];
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(40);
    }
  });
});

describe('headingOf', () => {
  it('maps +z tangent to heading 0 and +x tangent to +PI/2', () => {
    expect(headingOf(0, 1)).toBeCloseTo(0, 6);
    expect(headingOf(1, 0)).toBeCloseTo(Math.PI / 2, 6);
  });
});
