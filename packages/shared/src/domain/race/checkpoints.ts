import { sampleCircuit } from '../map/circuit';
import type { CircuitSpec } from '../map/MapManifest';

/** An ordered gate on the circuit the car must cross (in order) to count a lap. */
export interface Checkpoint {
  index: number;
  x: number;
  z: number;
  /** Unit tangent (direction of travel through the gate). */
  tx: number;
  tz: number;
  /** Half the gate width — lateral tolerance for a valid crossing. */
  halfWidth: number;
}

const DEFAULT_GATES = 16;
/** Extra lateral tolerance beyond the track edge, so a crossing on the kerb counts. */
const WIDTH_MARGIN = 2;

/**
 * Ordered checkpoint gates around the closed circuit, derived from the same
 * centreline samples that drive rendering and the spawn — so a new circuit gets
 * lap tracking for free. Gate 0 is the start/finish line. Evenly spaced by
 * sample index; the car must cross them in order, which prevents course-cutting.
 */
export function buildCheckpoints(circuit: CircuitSpec, gates = DEFAULT_GATES): Checkpoint[] {
  const samples = sampleCircuit(circuit);
  const n = samples.length;
  const count = Math.min(gates, n);
  const halfWidth = circuit.width / 2 + WIDTH_MARGIN;
  const out: Checkpoint[] = [];
  for (let i = 0; i < count; i++) {
    const s = samples[Math.round((i * n) / count) % n];
    out.push({ index: i, x: s.x, z: s.z, tx: s.tx, tz: s.tz, halfWidth });
  }
  return out;
}
