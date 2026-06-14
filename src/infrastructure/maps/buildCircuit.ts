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
/** Bigger track => more room for hills and distinct corners (jun 2026 feedback). */
const SCALE = 1.5;
const RAW_POINTS: CircuitSpec['controlPoints'] = [
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
  // Southern hill loop: dip down, climb the big hill, curve across its top, descend back.
  { x: -15, z: -98 }, // leave the bottom, head down toward the hill
  { x: 5, z: -140 }, // hill base
  { x: 0, z: -185 }, // climbing (a kink on the way up)
  { x: 40, z: -208 }, // summit — first top curve
  { x: 85, z: -196 }, // summit — second top curve
  { x: 98, z: -150 }, // over the crest, descending
  { x: 82, z: -106 }, // back down toward the start/finish
];
const CONTROL_POINTS: CircuitSpec['controlPoints'] = RAW_POINTS.map((p) => ({ x: p.x * SCALE, z: p.z * SCALE }));

const TRACK_WIDTH = 14;
const HALF = TRACK_WIDTH / 2;

/** Deterministic 0..1 hash of two integers (stable building heights/layout). */
function hash(i: number, j: number): number {
  let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

/**
 * Repeatedly lowers any cell that sits more than one level above a neighbour
 * until the whole grid satisfies the terrain invariant (neighbours differ by
 * <=1 level: no cliffs, climbs spread over a level-1 band). Mutates in place.
 */
function relaxLevels(levels: number[][]): void {
  const rows = levels.length;
  const cols = levels[0].length;
  for (let pass = 0; pass < rows + cols; pass++) {
    let changed = false;
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const neigh = [
          ix > 0 ? levels[iz][ix - 1] : 0,
          ix < cols - 1 ? levels[iz][ix + 1] : 0,
          iz > 0 ? levels[iz - 1][ix] : 0,
          iz < rows - 1 ? levels[iz + 1][ix] : 0,
        ];
        const maxN = Math.max(...neigh);
        if (levels[iz][ix] > maxN + 1) {
          levels[iz][ix] = maxN + 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

/** Centre + size of the big hill in the southern loop (world/scaled coords). */
const HILL = { x: 90, z: -300, peak: 5, sigma: 140 };

/**
 * Terrain for the circuit: a gently rolling base (0..1 levels) over the whole
 * map plus one prominent **big hill** (a Gaussian bump peaking ~4 levels) under
 * the southern loop, so the track climbs it, curves across the top and comes
 * back down. Levels are relaxed afterwards so no neighbours differ by more than
 * one (drivable slopes, no cliffs).
 */
function buildCircuitTerrain(): TerrainSpec {
  const cellSize = 60;
  const cols = 13; // x: -360 .. +360
  const rows = 14; // z: -420 .. +360
  const originX = -360;
  const originZ = -420;
  const levels = Array.from({ length: rows }, (_, iz) =>
    Array.from({ length: cols }, (_, ix) => {
      const x = originX + ix * cellSize;
      const z = originZ + iz * cellSize;
      const base = 0.5 + 0.5 * Math.sin(x * 0.012) * Math.cos(z * 0.01);
      const d2 = (x - HILL.x) ** 2 + (z - HILL.z) ** 2;
      const bump = HILL.peak * Math.exp(-d2 / (2 * HILL.sigma * HILL.sigma));
      return Math.max(0, Math.min(6, Math.round(base + bump)));
    }),
  );
  relaxLevels(levels);
  return { levelHeight: 1.6, cellSize, originX, originZ, levels };
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
 * Builds the night street circuit manifest. The ground (heightfield terrain) is
 * the drivable surface and the ribbon is the visual track; it rolls gently in
 * the main area and rises into a big hill under the southern loop. Buildings
 * fill the city around the loop without sitting on the track, streetlights line
 * it, and there are no grid roads — so no NPC traffic (it is a race track).
 * `lockedNight` keeps it at night and hides the day/night toggle.
 */
export function buildCircuit(): MapManifest {
  const circuit: CircuitSpec = { controlPoints: CONTROL_POINTS, width: TRACK_WIDTH };
  const samples = sampleCircuit(circuit, 16);

  const terrain = buildCircuitTerrain();

  const start = samples[0];
  const spawn = {
    x: start.x,
    z: start.z,
    headingRad: headingOf(start.tx, start.tz),
  };

  // City buildings on a grid, skipping any too close to the track or the spawn.
  const buildings: Building[] = [];
  const STEP = 32;
  const REACH = 200;
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
