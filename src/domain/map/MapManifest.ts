/**
 * Data contract for a drivable map. Pure data (numbers/strings only), no
 * Three.js/Rapier — same pattern as VehicleSpec: the domain owns the
 * definition, infrastructure renders the geometry and the domain rules read
 * the gameplay parts (spawn, speed zones).
 *
 * v1 geometry is procedural (built from this manifest). `gltfUrl` is the
 * forward seam: a future adapter loads real geometry (e.g. an imported city)
 * without any domain or UI change.
 */

export type RoadType = 'avenue' | 'residential';

/** Default speed limit (km/h) per road type. */
export const ROAD_LIMITS: Record<RoadType, number> = {
  avenue: 50,
  residential: 30,
};

/** Axis-aligned rectangle on the ground plane: centre (x,z) + full extents. */
export interface Rect {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface Spawn {
  x: number;
  z: number;
  /** Initial heading (rad about Y). 0 faces +z (the vehicle's front). */
  headingRad: number;
}

export interface RoadSegment extends Rect {
  type: RoadType;
}

/** A region that overrides the map's default speed limit. */
export interface SpeedZone extends Rect {
  limitKmh: number;
}

export interface Building extends Rect {
  height: number;
}

/** A pedestrian (zebra) crossing painted across a road. */
export interface Crossing extends Rect {
  /** Axis the road runs along; the stripes lie perpendicular to it. */
  axis: 'x' | 'z';
}

export interface Prop {
  kind: 'cone' | 'crate';
  x: number;
  z: number;
}

/**
 * A traffic light governing one approach to an intersection. A vehicle within
 * the cross-axis lane band `[laneMin, laneMax]`, travelling in `travelSign`
 * along `axis`, must not cross `stopCoord` while the light is red.
 */
export interface TrafficLightSpec {
  id: string;
  /** Pole position. */
  x: number;
  z: number;
  /** Axis the governed traffic travels along. */
  axis: 'x' | 'z';
  /** Coordinate of the stop line on `axis`. */
  stopCoord: number;
  /** Direction of legal travel along `axis`. */
  travelSign: 1 | -1;
  /** Lane band on the cross axis that this light governs. */
  laneMin: number;
  laneMax: number;
  /** Seconds offset into the green→amber→red cycle, to desync lights. */
  phaseOffset: number;
}

/**
 * Terrain as a coarse grid of discrete height *levels*: the ground is a flat
 * plateau at `level × levelHeight` near each cell's centre, with smooth hill
 * slopes only between cells of different levels (see `elevationAt`). Adjacent
 * cells should differ by at most one level, so reaching level 2 from level 0
 * always means climbing through a level-1 band — no cliffs.
 */
export interface TerrainSpec {
  /** Height of one level step in m. */
  levelHeight: number;
  /** Side of one level cell in m. */
  cellSize: number;
  /** World position of the centre of cell [0][0]. */
  originX: number;
  originZ: number;
  /** levels[iz][ix] = integer level of the cell (rows advance along +z). */
  levels: number[][];
}

export interface MapManifest {
  name: string;
  spawn: Spawn;
  terrain: TerrainSpec;
  /** Limit (km/h) anywhere not covered by a speed zone. */
  defaultLimitKmh: number;
  roads: RoadSegment[];
  speedZones: SpeedZone[];
  buildings: Building[];
  props: Prop[];
  crossings: Crossing[];
  trafficLights: TrafficLightSpec[];
  /** Future hook: URL of a glTF model to load as the map geometry. */
  gltfUrl?: string;
}
