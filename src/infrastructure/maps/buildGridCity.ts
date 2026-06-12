import type {
  Building,
  Crossing,
  MapManifest,
  Prop,
  RoadSegment,
  SpeedZone,
  TerrainSpec,
  TrafficLightSpec,
} from '@domain/map/MapManifest';

export interface GridCityOptions {
  /** Blocks per side (the grid is square). */
  blocks?: number;
  /** Side length of a city block (m). */
  blockSize?: number;
  /** Road width (m). */
  roadWidth?: number;
}

const DEFAULTS = { blocks: 5, blockSize: 40, roadWidth: 8 } as const;

/**
 * Deterministic procedural city: a square grid of roads (outer ring = avenues,
 * inner streets = residential) with buildings in the blocks. A residential
 * 30 km/h band crosses the centre, and the vehicle spawns on the west avenue
 * facing north so it drives straight through the band — useful for both
 * gameplay and verification. No RNG, so it is testable and resume-safe.
 *
 * This is one *source* of a MapManifest. Future sources (a real-city importer,
 * a glTF + manifest pair) plug in behind the same MapRepository port.
 */
export function buildGridCity(options: GridCityOptions = {}): MapManifest {
  const { blocks, blockSize, roadWidth } = { ...DEFAULTS, ...options };
  const pitch = blockSize + roadWidth;
  const span = blocks * blockSize + (blocks + 1) * roadWidth;
  const half = span / 2;

  // Road centre lines: blocks + 1 of them per axis, evenly spaced and centred.
  const lines = Array.from({ length: blocks + 1 }, (_, i) => -half + roadWidth / 2 + i * pitch);
  const isOuter = (pos: number) => Math.abs(Math.abs(pos) - (half - roadWidth / 2)) < 1e-6;

  const roads: RoadSegment[] = [];
  for (const x of lines) {
    roads.push({ x, z: 0, width: roadWidth, depth: span, type: isOuter(x) ? 'avenue' : 'residential' });
  }
  for (const z of lines) {
    roads.push({ x: 0, z, width: span, depth: roadWidth, type: isOuter(z) ? 'avenue' : 'residential' });
  }

  // Block centres are the midpoints between consecutive road lines.
  const centres = Array.from({ length: blocks }, (_, i) => lines[i] + pitch / 2);
  const footprint = blockSize - 8; // leave a sidewalk gap to the roads
  const buildings: Building[] = [];
  centres.forEach((bx, ix) =>
    centres.forEach((bz, iz) => {
      // Deterministic height variation from the block indices.
      const height = 10 + ((ix * 3 + iz * 7) % 5) * 4;
      buildings.push({ x: bx, z: bz, width: footprint, depth: footprint, height });
    }),
  );

  // A 30 km/h residential band across the city centre (z around 0).
  const speedZones: SpeedZone[] = [
    { x: 0, z: 0, width: span, depth: pitch, limitKmh: 30 },
  ];

  // Spawn on the west avenue (x = -half + roadWidth/2), south end, facing north.
  const avenueX = lines[0];
  const spawn = { x: avenueX, z: -half + roadWidth * 1.5, headingRad: 0 };

  // A couple of dynamic obstacles on the spawn avenue, ahead of the car.
  const props: Prop[] = [
    { kind: 'cone', x: avenueX + 1.4, z: spawn.z + 14 },
    { kind: 'crate', x: avenueX - 1.6, z: spawn.z + 24 },
  ];

  // --- Intersection-first furniture pass -----------------------------------
  // Every junction of the grid is computed explicitly; a deterministic
  // per-intersection `variant` (no RNG) decides its furniture, so streets are
  // heterogeneous: avenue x avenue junctions always get traffic lights,
  // avenue x residential usually, residential x residential rarely.
  // Uncontrolled junctions get zebra crossings on a varying subset of
  // approaches; controlled junctions get crossings on all approaches.
  const stopSetback = roadWidth / 2 + 2; // stop line / pole distance from junction centre
  const crossingSetback = stopSetback + 1.5;
  const halfCycleSeconds = 9; // green (7) + amber (2): opposite axis is red exactly that long

  const crossings: Crossing[] = [];
  const trafficLights: TrafficLightSpec[] = [];

  lines.forEach((X, xi) => {
    lines.forEach((Z, zi) => {
      const variant = (xi * 7 + zi * 11) % 12;
      const verticalType = isOuter(X) ? 'avenue' : 'residential';
      const horizontalType = isOuter(Z) ? 'avenue' : 'residential';
      const avenueCount = (verticalType === 'avenue' ? 1 : 0) + (horizontalType === 'avenue' ? 1 : 0);
      const controlled =
        avenueCount === 2 || (avenueCount === 1 ? variant % 3 !== 0 : variant % 4 === 0);

      // Approaches in fixed order: north-, south-, east-, west-bound. Each
      // exists only if its road actually continues on the arriving side.
      const approaches = [
        { key: 'n', exists: zi > 0, axis: 'z' as const, sign: 1 as const },
        { key: 's', exists: zi < lines.length - 1, axis: 'z' as const, sign: -1 as const },
        { key: 'e', exists: xi > 0, axis: 'x' as const, sign: 1 as const },
        { key: 'w', exists: xi < lines.length - 1, axis: 'x' as const, sign: -1 as const },
      ].filter((a) => a.exists);

      for (const [i, a] of approaches.entries()) {
        const alongZ = a.axis === 'z';
        // Stop line sits before the junction, against the direction of travel.
        const stopCoord = (alongZ ? Z : X) - a.sign * stopSetback;

        if (controlled) {
          trafficLights.push({
            id: `tl-${xi}-${zi}-${a.key}`,
            // Pole at the stop line, just off the kerb.
            x: alongZ ? X - a.sign * stopSetback : stopCoord,
            z: alongZ ? stopCoord : Z + a.sign * stopSetback,
            axis: a.axis,
            stopCoord,
            travelSign: a.sign,
            laneMin: (alongZ ? X : Z) - stopSetback,
            laneMax: (alongZ ? X : Z) + stopSetback,
            // N-S and E-W run in opposite phases; `variant` desyncs junctions.
            phaseOffset: variant * 1.5 + (alongZ ? 0 : halfCycleSeconds),
          });
        }

        // Crossings: all approaches when controlled, a variant-picked subset
        // (at least two) when not.
        const wanted = controlled || (variant & (1 << i)) !== 0 || approaches.length < 2;
        const guaranteed = !controlled && i < 2 && !(variant & 0b0011);
        if (wanted || guaranteed) {
          const c = (alongZ ? Z : X) - a.sign * crossingSetback;
          crossings.push(
            alongZ
              ? { x: X, z: c, width: roadWidth, depth: 3, axis: 'z' }
              : { x: c, z: Z, width: 3, depth: roadWidth, axis: 'x' },
          );
        }
      }
    });
  });

  // Terrain levels: 6x6 cells of plateaus (0..3 x 1.5 m), generally rising
  // west -> east, hand-laid so adjacent cells differ by at most one level.
  // The spawn avenue's column (west) is level 0.
  const cellSize = 56;
  const terrain: TerrainSpec = {
    levelHeight: 1.5,
    cellSize,
    originX: -2.5 * cellSize,
    originZ: -2.5 * cellSize,
    levels: [
      [0, 0, 1, 1, 2, 2],
      [0, 0, 1, 2, 2, 3],
      [0, 1, 1, 2, 2, 3],
      [0, 0, 1, 1, 2, 2],
      [0, 1, 1, 2, 2, 2],
      [0, 0, 1, 1, 2, 3],
    ],
  };

  return {
    name: 'Grid City',
    spawn,
    terrain,
    defaultLimitKmh: 50,
    roads,
    speedZones,
    buildings,
    props,
    crossings,
    trafficLights,
  };
}
