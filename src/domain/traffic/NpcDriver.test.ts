import { beforeEach, describe, expect, it } from 'vitest';
import type { TrafficLightSpec } from '@domain/map/MapManifest';
import type { TrafficColor } from '@domain/traffic/TrafficSignals';
import { buildRoadGraph, forwardVector, type RoadGraphEdge } from './RoadGraph';
import { DEFAULT_DRIVER_CONFIG, NpcDriver, type DriverPose } from './NpcDriver';

const grid = buildRoadGraph([
  { x: -20, z: 0, width: 8, depth: 80, type: 'avenue' },
  { x: 20, z: 0, width: 8, depth: 80, type: 'avenue' },
  { x: 0, z: -20, width: 80, depth: 8, type: 'avenue' },
  { x: 0, z: 20, width: 80, depth: 8, type: 'avenue' },
]);

/** The northbound (+z) lane edge from (-20,-20) to (-20,20). */
function northEdge(): RoadGraphEdge {
  const from = grid.nodes.find((n) => n.x === -20 && n.z === -20)!;
  const to = grid.nodes.find((n) => n.x === -20 && n.z === 20)!;
  return grid.edges.find((e) => e.from === from.id && e.to === to.id)!;
}

const green = (): TrafficColor => 'green';

/** Advances a driver, integrating its commanded velocity into the pose like infra would. */
function drive(
  driver: NpcDriver,
  pose: DriverPose,
  ticks: number,
  others: { x: number; z: number }[] = [],
  dt = 0.1,
) {
  for (let i = 0; i < ticks; i++) {
    const cmd = driver.update(pose, dt, others);
    pose.headingRad = cmd.headingRad;
    if (cmd.controlActive) {
      const f = forwardVector(cmd.headingRad);
      pose.x += f.x * cmd.speed * dt;
      pose.z += f.z * cmd.speed * dt;
    }
  }
  return pose;
}

describe('NpcDriver cruising', () => {
  it('accelerates along its lane and advances onto another edge at the node', () => {
    const edge = northEdge();
    const driver = new NpcDriver(grid, [], green, () => 0, edge);
    const pose: DriverPose = { ...edge.laneStart, headingRad: edge.headingRad };

    drive(driver, pose, 40); // ~4 s: rolling north, not yet at the far node
    expect(driver.currentEdgeId).toBe(edge.id);
    expect(pose.z).toBeGreaterThan(0); // it travelled north

    drive(driver, pose, 40); // reach the node and pick a new edge (turn)
    expect(driver.currentEdgeId).not.toBe(edge.id);
  });
});

describe('NpcDriver traffic lights', () => {
  const light: TrafficLightSpec = {
    id: 'L', x: -20, z: 10, axis: 'z', stopCoord: 10, travelSign: 1, laneMin: -24, laneMax: -12, phaseOffset: 0,
  };

  it('brakes toward a halt at a red stop line ahead', () => {
    let color: TrafficColor = 'green';
    const driver = new NpcDriver(grid, [light], () => color, () => 0, northEdge());
    const pose: DriverPose = { x: -18, z: -10, headingRad: 0 };

    drive(driver, pose, 30); // build up speed on green well before the line
    const movingZ = pose.z;
    expect(movingZ).toBeGreaterThan(-10);

    color = 'red';
    const cmd = driver.update(pose, 0.1, []);
    expect(cmd.speed).toBeLessThan(DEFAULT_DRIVER_CONFIG.avenueSpeed); // capped by the stop
    // It should not roll past the stop line on red.
    drive(driver, pose, 60);
    expect(pose.z).toBeLessThanOrEqual(light.stopCoord + 0.2);
  });

  it('does not stop for a green light', () => {
    const driver = new NpcDriver(grid, [light], green, () => 0, northEdge());
    const pose: DriverPose = { x: -18, z: 0, headingRad: 0 };
    drive(driver, pose, 30);
    expect(pose.z).toBeGreaterThan(light.stopCoord); // sailed through
  });
});

describe('NpcDriver obstacle yielding', () => {
  it('holds position when a car sits directly ahead', () => {
    const driver = new NpcDriver(grid, [], green, () => 0, northEdge());
    const pose: DriverPose = { x: -18, z: -10, headingRad: 0 };
    drive(driver, pose, 20); // get rolling
    const blocker = { x: -18, z: pose.z + 3 };
    const cmd = driver.update(pose, 0.1, [blocker]);
    expect(cmd.state).toBe('waiting');
    drive(driver, pose, 20, [blocker]);
    expect(pose.z).toBeLessThan(blocker.z); // never overran the blocker
  });
});

describe('NpcDriver crash recovery', () => {
  let driver: NpcDriver;
  beforeEach(() => {
    driver = new NpcDriver(grid, [], green, () => 0, northEdge());
  });

  it('goes limp on crash and resumes after recovery', () => {
    driver.onCrash();
    const crashed = driver.update({ x: -18, z: 0, headingRad: 0 }, 0.1, []);
    expect(crashed.controlActive).toBe(false);
    expect(crashed.state).toBe('crashed');

    // Sit on a node so rejoin completes immediately once recovery elapses.
    const node = grid.nodes.find((n) => n.x === -20 && n.z === 20)!;
    const pose: DriverPose = { x: node.x, z: node.z, headingRad: 0 };
    let last = crashed;
    for (let i = 0; i < 40; i++) last = driver.update(pose, 0.1, []);

    expect(last.controlActive).toBe(true);
    expect(last.state).toBe('cruising');
  });
});
