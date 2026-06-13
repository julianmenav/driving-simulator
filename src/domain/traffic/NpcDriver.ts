import type { TrafficLightSpec } from '@domain/map/MapManifest';
import type { TrafficColor } from '@domain/traffic/TrafficSignals';
import {
  angleDelta,
  chooseEdge,
  forwardVector,
  headingTo,
  nearestNode,
  outgoingEdges,
  rightVector,
  type RoadGraph,
  type RoadGraphEdge,
} from './RoadGraph';

/**
 * The "brain" of one NPC car: a pure, deterministic state machine that decides
 * where the car wants to go and how fast, given its physical pose, the elapsed
 * time and the positions of everything around it. It owns no Three.js/Rapier —
 * the infrastructure layer reads the body pose, calls `update`, and turns the
 * returned command into velocity/rotation (and reports impacts via `onCrash`).
 *
 * Behaviour:
 *  - follows right-hand lanes along the road graph, picking a turn at each
 *    intersection (weighted toward going straight);
 *  - stops at the stop line of any red/amber light governing its approach
 *    (the same `TrafficLightSpec` the player's RedLightRule uses);
 *  - yields (holds position) when another car or the player sits in its path;
 *  - on a crash it goes limp (`controlActive: false`) so physics can bounce it,
 *    waits `recoverySeconds`, then heads to the nearest road node and resumes.
 */

export type NpcState = 'cruising' | 'waiting' | 'crashed' | 'rejoining';

export interface DriverPose {
  x: number;
  z: number;
  /** Facing (rad about Y; 0 faces +z). */
  headingRad: number;
}

export interface DriveCommand {
  /** When false the body is left to physics (crash bounce/settle). */
  controlActive: boolean;
  /** Target forward speed in m/s. */
  speed: number;
  /** Desired facing in rad about Y. */
  headingRad: number;
  state: NpcState;
}

export interface NpcDriverConfig {
  residentialSpeed: number;
  avenueSpeed: number;
  recoverySeconds: number;
  /** Distance to a node centre that counts as "arrived". */
  reachRadius: number;
  /** How far ahead a red/amber light is obeyed. */
  lightLookahead: number;
  /** Base clear distance scanned ahead for obstacles (grows with speed). */
  obstacleClearance: number;
  /** Half-width of the path corridor scanned for obstacles. */
  obstacleHalfWidth: number;
  /** Comfortable acceleration / braking (m/s^2). */
  accel: number;
  decel: number;
  /** Max heading change rate (rad/s). */
  turnRate: number;
}

export const DEFAULT_DRIVER_CONFIG: NpcDriverConfig = {
  residentialSpeed: 7,
  avenueSpeed: 11,
  recoverySeconds: 3,
  reachRadius: 3.5,
  lightLookahead: 22,
  obstacleClearance: 5,
  obstacleHalfWidth: 1.6,
  accel: 4,
  decel: 8,
  turnRate: 2.2,
};

/** Gap kept before a stop line / blocking obstacle. */
const STOP_GAP = 1.6;

export class NpcDriver {
  private state: NpcState = 'cruising';
  private edge: RoadGraphEdge | null;
  private speed = 0;
  private crashTimer = 0;
  private rejoinTarget: { x: number; z: number } | null = null;

  constructor(
    private readonly graph: RoadGraph,
    private readonly lights: TrafficLightSpec[],
    private readonly colorOf: (id: string) => TrafficColor,
    private readonly rng: () => number,
    initialEdge: RoadGraphEdge,
    private readonly config: NpcDriverConfig = DEFAULT_DRIVER_CONFIG,
  ) {
    this.edge = initialEdge;
  }

  get currentState(): NpcState {
    return this.state;
  }

  /** Id of the lane edge currently being followed (for tests/diagnostics). */
  get currentEdgeId(): string | null {
    return this.edge?.id ?? null;
  }

  /** Called by infrastructure when this car is hit hard: go limp and recover. */
  onCrash(): void {
    if (this.state === 'crashed') return;
    this.state = 'crashed';
    this.crashTimer = 0;
    this.speed = 0;
  }

  update(pose: DriverPose, dt: number, others: ReadonlyArray<{ x: number; z: number }>): DriveCommand {
    if (this.state === 'crashed') {
      this.crashTimer += dt;
      if (this.crashTimer >= this.config.recoverySeconds) {
        const node = nearestNode(this.graph, pose.x, pose.z);
        this.rejoinTarget = node ? { x: node.x, z: node.z } : null;
        this.state = this.rejoinTarget ? 'rejoining' : 'cruising';
      }
      return { controlActive: false, speed: 0, headingRad: pose.headingRad, state: 'crashed' };
    }

    const aim = this.advanceAndAim(pose);
    if (!aim) {
      // No route (degenerate/empty graph): sit still but stay controlled.
      return { controlActive: true, speed: 0, headingRad: pose.headingRad, state: this.state };
    }

    const desiredHeading = headingTo(pose, aim);
    const cap = this.speedCap();

    // Longitudinal target: cruise, but brake to a halt behind whichever comes
    // first — a red/amber stop line or a car/player in our path.
    let target = cap;
    const lightDist = this.stopDistanceForLight(pose);
    if (lightDist !== null) target = Math.min(target, this.speedForStop(lightDist));
    const obstacleDist = this.obstacleAheadDistance(pose, desiredHeading, others);
    if (obstacleDist !== null) target = Math.min(target, this.speedForStop(obstacleDist));

    if (this.state !== 'rejoining') this.state = obstacleDist !== null ? 'waiting' : 'cruising';

    // Ease speed and heading for smooth motion.
    const maxStep = (target > this.speed ? this.config.accel : this.config.decel) * dt;
    this.speed += clamp(target - this.speed, -maxStep, maxStep);

    const turn = clamp(angleDelta(desiredHeading, pose.headingRad), -this.config.turnRate * dt, this.config.turnRate * dt);
    const headingRad = pose.headingRad + turn;

    return { controlActive: true, speed: this.speed, headingRad, state: this.state };
  }

  /** Picks the current aim point, advancing past reached nodes / rejoin target. */
  private advanceAndAim(pose: DriverPose): { x: number; z: number } | null {
    if (this.state === 'rejoining') {
      const target = this.rejoinTarget;
      if (!target) {
        this.state = 'cruising';
      } else if (distance(pose, target) <= this.config.reachRadius) {
        // Reached the road: join an outgoing lane roughly matching our heading.
        const node = nearestNode(this.graph, target.x, target.z);
        const next = node ? chooseEdge(outgoingEdges(this.graph, node.id), pose.headingRad, this.rng) : null;
        if (next) {
          this.edge = next;
          this.rejoinTarget = null;
          this.state = 'cruising';
        } else {
          return target; // hold on the node if it has no exits
        }
      } else {
        return target;
      }
    }

    let edge = this.edge;
    if (!edge) return null;
    if (distance(pose, edge.laneEnd) <= this.config.reachRadius) {
      const next = chooseEdge(outgoingEdges(this.graph, edge.to), edge.headingRad, this.rng);
      if (next) {
        this.edge = next;
        edge = next;
      }
    }
    return edge.laneEnd;
  }

  private speedCap(): number {
    if (this.state === 'rejoining') return this.config.residentialSpeed * 0.6;
    return this.edge?.type === 'avenue' ? this.config.avenueSpeed : this.config.residentialSpeed;
  }

  /** Speed that brakes to a halt `STOP_GAP` before a point `distance` ahead. */
  private speedForStop(distance: number): number {
    const usable = distance - STOP_GAP;
    if (usable <= 0) return 0;
    return Math.sqrt(2 * this.config.decel * usable);
  }

  /**
   * Distance ahead to the stop line of the nearest red/amber light governing
   * this car's current approach, or null if none applies (clear to proceed).
   */
  private stopDistanceForLight(pose: DriverPose): number | null {
    const edge = this.edge;
    if (!edge) return null;
    let nearest: number | null = null;
    for (const light of this.lights) {
      if (light.axis !== edge.axis || light.travelSign !== edge.sign) continue;
      const lateral = edge.axis === 'z' ? pose.x : pose.z;
      if (lateral < light.laneMin || lateral > light.laneMax) continue;

      const along = edge.axis === 'z' ? pose.z : pose.x;
      const ahead = (light.stopCoord - along) * edge.sign;
      if (ahead <= 0 || ahead > this.config.lightLookahead) continue;

      const color = this.colorOf(light.id);
      if (color === 'red' || color === 'amber') {
        if (nearest === null || ahead < nearest) nearest = ahead;
      }
    }
    return nearest;
  }

  /**
   * Distance ahead to the nearest car/player sitting in the forward corridor,
   * or null if the path is clear. The scan reaches further the faster we go, so
   * there is room to brake; braking to `STOP_GAP` behind it then holds us there
   * (the obstacle stays detected at the gap, keeping the target at 0).
   */
  private obstacleAheadDistance(
    pose: DriverPose,
    heading: number,
    others: ReadonlyArray<{ x: number; z: number }>,
  ): number | null {
    const fwd = forwardVector(heading);
    const right = rightVector(heading);
    const reach = this.config.obstacleClearance + this.speed * 0.8;
    let nearest: number | null = null;
    for (const o of others) {
      const dx = o.x - pose.x;
      const dz = o.z - pose.z;
      const ahead = dx * fwd.x + dz * fwd.z;
      const lateral = dx * right.x + dz * right.z;
      if (ahead > 0 && ahead < reach && Math.abs(lateral) < this.config.obstacleHalfWidth) {
        if (nearest === null || ahead < nearest) nearest = ahead;
      }
    }
    return nearest;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
