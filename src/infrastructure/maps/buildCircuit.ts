import { headingOf, sampleCircuit } from '@domain/map/circuit';
import type {
  Building,
  CircuitSpec,
  MapManifest,
  StreetLightSpec,
  TerrainSpec,
} from '@domain/map/MapManifest';

/**
 * Centreline control points of the night street circuit. Spacing and angle
 * between points set how strong each corner is — this loop mixes long sweeping
 * curves, a tight esse, a hairpin and short straights on purpose (the brief was
 * "strong curves, some not so strong"). Catmull-Rom smooths them (`sampleCircuit`).
 */
const CONTROL_POINTS: CircuitSpec['controlPoints'] = [
  { x: 80, z: -70 }, // start/finish — main straight begins
  { x: 85, z: 20 }, // long gentle right straight
  { x: 70, z: 70 }, // turn 1: sweeping
  { x: 20, z: 88 }, // top arc
  { x: -35, z: 78 }, // turn 2: medium
  { x: -25, z: 35 }, // esse in
  { x: -65, z: 28 }, // esse out
  { x: -88, z: -12 }, // wide left sweep
  { x: -55, z: -30 }, // hairpin entry
  { x: -85, z: -52 }, // hairpin apex (strong)
  { x: -45, z: -72 }, // hairpin exit
  { x: 10, z: -85 }, // bottom straight
  { x: 50, z: -85 }, // kink back toward start
];

const TRACK_WIDTH = 12;
const HALF = TRACK_WIDTH / 2;

/** Deterministic 0..1 hash of two integers (stable building heights/layout). */
function hash(i: number, j: number): number {
  let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

/** Minimum distance from a point to the sampled centreline. */
function distToTrack(samples: { x: number; z: number }[], x: number, z: number): number {
  let min = Infinity;
  for (const s of samples) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Builds the night street circuit manifest. Flat terrain (the whole ground is
 * drivable, the ribbon is the visual track), buildings filling the city around
 * and inside the loop without sitting on the track, streetlights lining it, and
 * no grid roads — so no NPC traffic (it is a race track). `lockedNight` keeps it
 * at night and hides the day/night toggle.
 */
export function buildCircuit(): MapManifest {
  const circuit: CircuitSpec = { controlPoints: CONTROL_POINTS, width: TRACK_WIDTH };
  const samples = sampleCircuit(circuit, 16);

  // Flat terrain: a single level everywhere (elevationAt clamps beyond the grid).
  const terrain: TerrainSpec = {
    levelHeight: 1.5,
    cellSize: 50,
    originX: -250,
    originZ: -250,
    levels: Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 0)),
  };

  const start = samples[0];
  const spawn = {
    x: start.x,
    z: start.z,
    headingRad: headingOf(start.tx, start.tz),
  };

  // City buildings on a grid, skipping any too close to the track or the spawn.
  const buildings: Building[] = [];
  const STEP = 30;
  const REACH = 135;
  for (let i = -Math.floor(REACH / STEP); i <= Math.floor(REACH / STEP); i++) {
    for (let j = -Math.floor(REACH / STEP); j <= Math.floor(REACH / STEP); j++) {
      const r = hash(i + 100, j + 100);
      const x = i * STEP + (r - 0.5) * 10;
      const z = j * STEP + (hash(i + 7, j + 13) - 0.5) * 10;
      if (distToTrack(samples, x, z) < HALF + 9) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < 18) continue;
      const w = 9 + r * 8;
      const d = 9 + hash(i + 31, j + 17) * 8;
      buildings.push({ x, z, width: w, depth: d, height: 8 + hash(i, j) * 22 });
    }
  }

  // Streetlights lining the track, alternating sides.
  const streetLights: StreetLightSpec[] = [];
  for (let k = 0; k < samples.length; k += 6) {
    const s = samples[k];
    const side = (k / 6) % 2 === 0 ? 1 : -1;
    // Left normal of the tangent is (-tz, tx); offset just outside the kerb.
    streetLights.push({
      x: s.x + -s.tz * side * (HALF + 2.5),
      z: s.z + s.tx * side * (HALF + 2.5),
    });
  }

  return {
    name: 'Circuito nocturno',
    spawn,
    terrain,
    defaultLimitKmh: 200, // a race track: no speeding warnings
    roads: [],
    speedZones: [],
    buildings,
    props: [],
    crossings: [],
    trafficLights: [],
    streetLights,
    circuit,
    lockedNight: true,
  };
}
