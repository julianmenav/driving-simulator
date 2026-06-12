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

export interface MapManifest {
  name: string;
  spawn: Spawn;
  /** Limit (km/h) anywhere not covered by a speed zone. */
  defaultLimitKmh: number;
  roads: RoadSegment[];
  speedZones: SpeedZone[];
  buildings: Building[];
  props: Prop[];
  crossings: Crossing[];
  /** Future hook: URL of a glTF model to load as the map geometry. */
  gltfUrl?: string;
}
