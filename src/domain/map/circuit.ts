import type { CircuitSpec } from './MapManifest';

/** A sampled point on the circuit centreline: position + unit tangent. */
export interface CircuitSample {
  x: number;
  z: number;
  /** Unit tangent (direction of travel) along the loop. */
  tx: number;
  tz: number;
}

/**
 * Uniform Catmull-Rom position + derivative for one segment (p1→p2), with p0/p3
 * the neighbouring control points. Pure scalar maths; called per axis.
 */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): { pos: number; der: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  const pos = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  const der = 0.5 * (-p0 + p2 + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2);
  return { pos, der };
}

/**
 * Samples the closed circuit centreline into a flat list of points (one full
 * loop, the last point adjacent to the first). Pure and deterministic — like
 * `elevationAt`/`resolveSpeedLimit` — so it drives rendering, the spawn heading
 * and (later) the time-trial checkpoints from the same source.
 */
export function sampleCircuit(spec: CircuitSpec, samplesPerSegment = 16): CircuitSample[] {
  const pts = spec.controlPoints;
  const n = pts.length;
  const out: CircuitSample[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const px = catmull(p0.x, p1.x, p2.x, p3.x, t);
      const pz = catmull(p0.z, p1.z, p2.z, p3.z, t);
      const len = Math.hypot(px.der, pz.der) || 1;
      out.push({ x: px.pos, z: pz.pos, tx: px.der / len, tz: pz.der / len });
    }
  }
  return out;
}

/** Heading (rad about Y, 0 = +z) that faces along a tangent. */
export function headingOf(tx: number, tz: number): number {
  return Math.atan2(tx, tz);
}

/** Distance from a point to the closest segment of the (closed) centreline. */
export function distanceToCircuit(samples: CircuitSample[], x: number, z: number): number {
  let min = Infinity;
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
    if (d < min) min = d;
  }
  return min;
}

/** A point on the centreline annotated with how the track curves there. */
export interface CircuitTurn extends CircuitSample {
  /** Unit vector toward the inside (concave side) of the curve; ~0 on straights. */
  insideX: number;
  insideZ: number;
  /** Curvature strength: ~0 on a straight, larger on sharper corners. */
  severity: number;
}

/**
 * Annotates each centreline sample with the local curve: the chord midpoint of
 * the points `lookahead` ahead/behind sits toward the inside of the bend, and its
 * offset from the sample measures how sharp the corner is. Pure — drives the
 * kerbs, direction markers and apex deterrents from the same geometry.
 */
export function circuitTurns(samples: CircuitSample[], lookahead = 5): CircuitTurn[] {
  const n = samples.length;
  return samples.map((s, i) => {
    const p = samples[(i - lookahead + n) % n];
    const q = samples[(i + lookahead) % n];
    const mx = (p.x + q.x) / 2 - s.x;
    const mz = (p.z + q.z) / 2 - s.z;
    const severity = Math.hypot(mx, mz);
    const inside = severity > 1e-3 ? { x: mx / severity, z: mz / severity } : { x: 0, z: 0 };
    return { ...s, insideX: inside.x, insideZ: inside.z, severity };
  });
}
