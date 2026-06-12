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

  // Interior cross streets the spawn avenue passes through.
  const crossStreets = lines.filter((z) => !isOuter(z));

  // Zebra crossings on the spawn avenue, just before each interior cross street.
  const crossings: Crossing[] = crossStreets.map((z) => ({
    x: avenueX,
    z: z - 6,
    width: roadWidth,
    depth: 3,
    axis: 'z' as const,
  }));

  // A corridor of traffic lights governing northbound avenue traffic, one per
  // interior intersection, with spread phases so they are not all in sync.
  const trafficLights: TrafficLightSpec[] = crossStreets.map((z, i) => ({
    id: `av-n-${i}`,
    x: avenueX - 6,
    z: z - 4,
    axis: 'z' as const,
    stopCoord: z - 4,
    travelSign: 1 as const,
    laneMin: avenueX - 6,
    laneMax: avenueX + 6,
    phaseOffset: i * 4,
  }));

  // Gentle rolling hills (sum of long-wavelength sinusoids).
  const terrain: TerrainSpec = {
    components: [
      { amplitude: 2.0, wavelengthX: 30, wavelengthZ: 38, phase: 0.4 },
      { amplitude: 1.0, wavelengthX: 17, wavelengthZ: 21, phase: 1.7 },
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
