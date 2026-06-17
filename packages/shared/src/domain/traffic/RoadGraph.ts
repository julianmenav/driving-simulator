import type { RoadSegment, RoadType } from '../map/MapManifest';

/**
 * A navigable lane graph derived purely from the map's road rectangles, so NPC
 * traffic works on *any* map with no extra authoring: intersections become
 * nodes and the road sections between them become directed, right-hand lane
 * edges. Same spirit as `resolveSpeedLimit`/`elevationAt`: pure domain logic
 * that reads the manifest, no Three.js/Rapier.
 *
 * Roads are axis-aligned rectangles (the project defers curved/rotated roads),
 * so a road runs along +z when it is taller than wide and along +x otherwise.
 */

const EPS = 1e-3;

export interface RoadNode {
  id: string;
  x: number;
  z: number;
}

export interface RoadGraphEdge {
  id: string;
  /** Origin node id. */
  from: string;
  /** Destination node id. */
  to: string;
  /** Axis the edge runs along. */
  axis: 'x' | 'z';
  /** Direction of travel along `axis`. */
  sign: 1 | -1;
  /** Facing along travel (rad about Y; 0 faces +z, matching the vehicle). */
  headingRad: number;
  type: RoadType;
  /** Centre-line length in m. */
  length: number;
  /** Lane (right-hand) endpoints: a car drives `laneStart` -> `laneEnd`. */
  laneStart: { x: number; z: number };
  laneEnd: { x: number; z: number };
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadGraphEdge[];
  nodeById: Map<string, RoadNode>;
  /** Edges leaving each node, keyed by node id. */
  edgesFrom: Map<string, RoadGraphEdge[]>;
}

export interface RoadGraphOptions {
  /**
   * Lane centre offset from the road centre-line, as a fraction of road width.
   * 0.25 puts the lane in the middle of the right-hand half (drive on the
   * right). Oncoming traffic uses the mirrored lane.
   */
  laneFraction?: number;
}

/** Unit forward vector for a heading (0 faces +z). */
export function forwardVector(headingRad: number): { x: number; z: number } {
  return { x: Math.sin(headingRad), z: Math.cos(headingRad) };
}

/** Unit right vector for a heading (the +x side when facing +z). */
export function rightVector(headingRad: number): { x: number; z: number } {
  const f = forwardVector(headingRad);
  return { x: f.z, z: -f.x };
}

/** Heading (rad about Y) pointing from `from` to `to`. */
export function headingTo(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Smallest signed difference a - b folded into (-π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

const key = (x: number, z: number) => `${Math.round(x * 100) / 100}:${Math.round(z * 100) / 100}`;

/**
 * Builds the lane graph from the road list. Intersections of a z-running road
 * and an x-running road that geometrically overlap become nodes; consecutive
 * nodes along each road are joined by a pair of opposing one-way lane edges.
 */
export function buildRoadGraph(roads: RoadSegment[], options: RoadGraphOptions = {}): RoadGraph {
  const laneFraction = options.laneFraction ?? 0.25;

  // A road runs along z when it is longer in z than in x, else along x.
  const zRoads = roads.filter((r) => r.depth >= r.width);
  const xRoads = roads.filter((r) => r.depth < r.width);

  const nodeById = new Map<string, RoadNode>();
  const nodeAt = (x: number, z: number): RoadNode => {
    const k = key(x, z);
    let node = nodeById.get(k);
    if (!node) {
      node = { id: `n${nodeById.size}`, x, z };
      nodeById.set(k, node);
    }
    return node;
  };

  // Intersections: a z-road at x = v.x crossing an x-road at z = h.z, when the
  // crossing point lies within both rectangles' spans.
  for (const v of zRoads) {
    for (const h of xRoads) {
      const x = v.x;
      const z = h.z;
      const withinH = x >= h.x - h.width / 2 - EPS && x <= h.x + h.width / 2 + EPS;
      const withinV = z >= v.z - v.depth / 2 - EPS && z <= v.z + v.depth / 2 + EPS;
      if (withinH && withinV) nodeAt(x, z);
    }
  }

  const nodes = [...nodeById.values()];
  const edges: RoadGraphEdge[] = [];
  const addEdgePair = (a: RoadNode, b: RoadNode, type: RoadType, width: number) => {
    const offset = width * laneFraction;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const headingRad = headingTo(from, to);
      const right = rightVector(headingRad);
      edges.push({
        id: `${from.id}->${to.id}`,
        from: from.id,
        to: to.id,
        axis: Math.abs(to.z - from.z) >= Math.abs(to.x - from.x) ? 'z' : 'x',
        sign: (to.z - from.z || to.x - from.x) >= 0 ? 1 : -1,
        headingRad,
        type,
        length: Math.sqrt(dist2(from, to)),
        laneStart: { x: from.x + right.x * offset, z: from.z + right.z * offset },
        laneEnd: { x: to.x + right.x * offset, z: to.z + right.z * offset },
      });
    }
  };

  // Connect consecutive nodes along every road.
  const connectAlong = (road: RoadSegment, axis: 'x' | 'z') => {
    const line = axis === 'z' ? road.x : road.z;
    const halfCross = (axis === 'z' ? road.width : road.depth) / 2;
    const on = nodes
      .filter((n) => Math.abs((axis === 'z' ? n.x : n.z) - line) <= halfCross + EPS)
      .sort((a, b) => (axis === 'z' ? a.z - b.z : a.x - b.x));
    for (let i = 0; i + 1 < on.length; i++) {
      addEdgePair(on[i], on[i + 1], road.type, axis === 'z' ? road.width : road.depth);
    }
  };
  zRoads.forEach((r) => connectAlong(r, 'z'));
  xRoads.forEach((r) => connectAlong(r, 'x'));

  const edgesFrom = new Map<string, RoadGraphEdge[]>();
  for (const e of edges) {
    const list = edgesFrom.get(e.from) ?? [];
    list.push(e);
    edgesFrom.set(e.from, list);
  }

  return { nodes, edges, nodeById, edgesFrom };
}

/** Edges leaving a node (empty array if none). */
export function outgoingEdges(graph: RoadGraph, nodeId: string): RoadGraphEdge[] {
  return graph.edgesFrom.get(nodeId) ?? [];
}

/** Nearest node to a world point (null only for an empty graph). */
export function nearestNode(graph: RoadGraph, x: number, z: number): RoadNode | null {
  let best: RoadNode | null = null;
  let bestD = Infinity;
  for (const n of graph.nodes) {
    const d = dist2(n, { x, z });
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/**
 * Picks an edge leaving a node, weighted toward continuing in `refHeading`
 * (straight ahead) and away from doubling back, using the injected `rng`
 * (deterministic in tests). The edge straight back the way we came is excluded
 * unless it is the only option (dead end).
 */
export function chooseEdge(
  candidates: RoadGraphEdge[],
  refHeading: number,
  rng: () => number,
): RoadGraphEdge | null {
  if (candidates.length === 0) return null;
  // Prefer not reversing: drop the edge whose heading is ~opposite to refHeading.
  const forward = candidates.filter((e) => Math.abs(angleDelta(e.headingRad, refHeading)) < Math.PI - 0.2);
  const pool = forward.length > 0 ? forward : candidates;

  const weights = pool.map((e) => Math.max(0.05, Math.cos(angleDelta(e.headingRad, refHeading)) + 1.1));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
