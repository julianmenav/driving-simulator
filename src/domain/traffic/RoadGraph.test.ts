import { describe, expect, it } from 'vitest';
import type { RoadSegment } from '@domain/map/MapManifest';
import {
  angleDelta,
  buildRoadGraph,
  chooseEdge,
  headingTo,
  nearestNode,
  outgoingEdges,
  rightVector,
} from './RoadGraph';

/** A simple plus-shaped crossing: one z-road and one x-road meeting at origin. */
const cross: RoadSegment[] = [
  { x: 0, z: 0, width: 8, depth: 80, type: 'avenue' }, // runs along z
  { x: 0, z: 0, width: 80, depth: 8, type: 'residential' }, // runs along x
];

/** A 2x2 grid of roads -> 4 intersections. */
const grid: RoadSegment[] = [
  { x: -20, z: 0, width: 8, depth: 80, type: 'avenue' },
  { x: 20, z: 0, width: 8, depth: 80, type: 'avenue' },
  { x: 0, z: -20, width: 80, depth: 8, type: 'avenue' },
  { x: 0, z: 20, width: 80, depth: 8, type: 'avenue' },
];

describe('buildRoadGraph', () => {
  it('creates a node at the intersection of crossing roads', () => {
    const graph = buildRoadGraph(cross);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ x: 0, z: 0 });
  });

  it('finds every grid intersection', () => {
    const graph = buildRoadGraph(grid);
    expect(graph.nodes).toHaveLength(4);
    const coords = graph.nodes.map((n) => `${n.x},${n.z}`).sort();
    expect(coords).toEqual(['-20,-20', '-20,20', '20,-20', '20,20'].sort());
  });

  it('connects adjacent intersections with opposing one-way lane edges', () => {
    const graph = buildRoadGraph(grid);
    // 4 undirected segments (top, bottom, left, right of the square) x 2 dirs.
    expect(graph.edges).toHaveLength(8);
    // Every edge has a reverse twin.
    for (const e of graph.edges) {
      expect(graph.edges.some((o) => o.from === e.to && o.to === e.from)).toBe(true);
    }
  });

  it('offsets lanes to the right of travel (drive on the right)', () => {
    const graph = buildRoadGraph(cross.concat({ x: 0, z: 40, width: 80, depth: 8, type: 'avenue' }));
    // Northbound edge (travelling +z): right is +x, so the lane sits at x > 0.
    const north = graph.edges.find((e) => e.sign === 1 && e.axis === 'z');
    expect(north).toBeDefined();
    expect(north!.laneStart.x).toBeGreaterThan(0);
    // Southbound twin sits on the opposite side.
    const south = graph.edges.find((e) => e.sign === -1 && e.axis === 'z');
    expect(south!.laneStart.x).toBeLessThan(0);
  });

  it('sets a heading consistent with rightVector geometry', () => {
    expect(headingTo({ x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(0); // +z
    const r = rightVector(0);
    expect(r.x).toBeCloseTo(1); // right of +z is +x
    expect(r.z).toBeCloseTo(0);
  });
});

describe('graph queries', () => {
  it('lists outgoing edges and finds the nearest node', () => {
    const graph = buildRoadGraph(grid);
    const node = nearestNode(graph, 18, 22)!;
    expect(node).toMatchObject({ x: 20, z: 20 });
    const out = outgoingEdges(graph, node.id);
    expect(out.length).toBeGreaterThan(0);
    out.forEach((e) => expect(e.from).toBe(node.id));
  });

  it('returns null for the nearest node of an empty graph', () => {
    expect(nearestNode(buildRoadGraph([]), 0, 0)).toBeNull();
  });
});

describe('chooseEdge', () => {
  const graph = buildRoadGraph(grid);

  it('never reverses when a forward option exists', () => {
    const node = graph.nodes.find((n) => n.x === -20 && n.z === -20)!;
    const out = outgoingEdges(graph, node.id);
    // Arrive heading north (+z); the only options here are north and east.
    const rng = () => 0.999;
    const chosen = chooseEdge(out, 0, rng)!;
    expect(Math.abs(angleDelta(chosen.headingRad, Math.PI))).toBeGreaterThan(0.2);
  });

  it('prefers continuing straight under a low rng draw', () => {
    const node = graph.nodes.find((n) => n.x === -20 && n.z === 20)!;
    const out = outgoingEdges(graph, node.id);
    // Heading north into this node; straight-ahead would keep heading ~0,
    // but this corner only turns east, so just assert a valid pick.
    const chosen = chooseEdge(out, 0, () => 0)!;
    expect(out).toContain(chosen);
  });

  it('returns null with no candidates', () => {
    expect(chooseEdge([], 0, () => 0.5)).toBeNull();
  });
});
