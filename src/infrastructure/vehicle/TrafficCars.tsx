import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import type { Game } from '@application/createGame';
import { elevationAt } from '@domain/map/elevation';
import { forwardVector, type RoadGraph, type RoadGraphEdge } from '@domain/traffic/RoadGraph';
import { NpcDriver } from '@domain/traffic/NpcDriver';

/** Number of NPC cars to populate the map with (capped by available lanes). */
const NPC_COUNT = 12;
/** Box half-extents of an NPC car: width, height, length (m). */
const HALF: [number, number, number] = [0.82, 0.55, 1.7];
/** Body-centre height above the ground while driving. */
const RIDE_HEIGHT = HALF[1] + 0.05;
/** Max vertical speed used to follow the terrain over hills (m/s). */
const MAX_CLIMB = 6;
/** Relative impact speed above which a contact counts as a crash (m/s). */
const CRASH_SPEED = 3;

const CAR_COLORS = ['#2e6f9e', '#3e8e5a', '#b58b2c', '#7d4f9e', '#a8453a', '#3a3f47', '#c06a3a', '#4a8f8f'];

interface NpcSpec {
  id: string;
  edge: RoadGraphEdge;
  /** Spawn point (lane midpoint) and heading. */
  x: number;
  z: number;
  headingRad: number;
  color: string;
  /** Deterministic per-car RNG seed for turn choices. */
  seed: number;
}

/** Deterministic PRNG (no Math.random, so behaviour is reproducible). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks spaced-out spawn lanes from the graph, skipping any too close to the
 * player's spawn so we never drop a car on top of them. Map-agnostic: it reads
 * only the derived lane graph, so a new map populates automatically.
 */
function buildNpcSpecs(graph: RoadGraph, spawnX: number, spawnZ: number): NpcSpec[] {
  const usable = graph.edges.filter(
    (e) => Math.hypot((e.laneStart.x + e.laneEnd.x) / 2 - spawnX, (e.laneStart.z + e.laneEnd.z) / 2 - spawnZ) > 12,
  );
  if (usable.length === 0) return [];
  const count = Math.min(NPC_COUNT, usable.length);
  const stride = Math.max(1, Math.floor(usable.length / count));

  const specs: NpcSpec[] = [];
  for (let i = 0; i < count; i++) {
    const edge = usable[(i * stride) % usable.length];
    specs.push({
      id: `npc-${i}`,
      edge,
      x: (edge.laneStart.x + edge.laneEnd.x) / 2,
      z: (edge.laneStart.z + edge.laneEnd.z) / 2,
      headingRad: edge.headingRad,
      color: CAR_COLORS[i % CAR_COLORS.length],
      seed: i * 2654435761,
    });
  }
  return specs;
}

/** Yaw (rad about Y) of a body whose X/Z rotations are locked. */
function yawOf(body: RapierRigidBody): number {
  const q = body.rotation();
  return 2 * Math.atan2(q.y, q.w);
}

/**
 * NPC traffic: dynamic Rapier cars that drive the map's lanes, obey traffic
 * lights, yield to obstacles, and bounce realistically when hit (the driver
 * goes limp on impact, then re-routes to the nearest road). All steering lives
 * in the domain `NpcDriver`; this component only moves bodies and reports hits.
 */
export function TrafficCars({ game }: { game: Game }) {
  const { world } = useRapier();
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const playerPos = useRef({ x: game.map.spawn.x, z: game.map.spawn.z });

  const specs = useMemo(
    () => buildNpcSpecs(game.roadGraph, game.map.spawn.x, game.map.spawn.z),
    [game.roadGraph, game.map.spawn.x, game.map.spawn.z],
  );

  const drivers = useMemo(
    () =>
      specs.map(
        (s) =>
          new NpcDriver(
            game.roadGraph,
            game.map.trafficLights,
            (id) => game.signals.colorOf(id),
            mulberry32(s.seed),
            s.edge,
          ),
      ),
    [specs, game],
  );

  // Track the player position off the bus so NPCs can yield to / avoid it.
  useEffect(
    () =>
      game.events.subscribe('vehicle/stateUpdated', ({ position }) => {
        playerPos.current = position;
      }),
    [game.events],
  );

  useBeforePhysicsStep(() => {
    const dt = world.timestep;
    const terrain = game.map.terrain;

    // Snapshot every car's position once, so each driver sees a consistent world.
    const positions = bodies.current.map((b) => (b ? b.translation() : null));

    for (let i = 0; i < drivers.length; i++) {
      const body = bodies.current[i];
      const pos = positions[i];
      if (!body || !pos) continue;

      const others: { x: number; z: number }[] = [playerPos.current];
      for (let j = 0; j < positions.length; j++) {
        const p = positions[j];
        if (j !== i && p) others.push({ x: p.x, z: p.z });
      }

      const cmd = drivers[i].update({ x: pos.x, z: pos.z, headingRad: yawOf(body) }, dt, others);
      if (!cmd.controlActive) {
        // Crashed: leave the body to physics so the impact plays out.
        body.wakeUp();
        continue;
      }

      const half = cmd.headingRad / 2;
      body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);

      const f = forwardVector(cmd.headingRad);
      const targetY = elevationAt(terrain, pos.x, pos.z) + RIDE_HEIGHT;
      const vy = Math.max(-MAX_CLIMB, Math.min(MAX_CLIMB, (targetY - pos.y) / dt));
      body.setLinvel({ x: f.x * cmd.speed, y: vy, z: f.z * cmd.speed }, true);
    }
  });

  return (
    <>
      {specs.map((spec, i) => (
        <NpcCar
          key={spec.id}
          spec={spec}
          terrain={game.map.terrain}
          driver={drivers[i]}
          register={(body) => {
            bodies.current[i] = body;
          }}
        />
      ))}
    </>
  );
}

function NpcCar({
  spec,
  terrain,
  driver,
  register,
}: {
  spec: NpcSpec;
  terrain: Game['map']['terrain'];
  driver: NpcDriver;
  register: (body: RapierRigidBody | null) => void;
}) {
  const spawnY = elevationAt(terrain, spec.x, spec.z) + RIDE_HEIGHT;

  // A contact only counts as a crash when it is another car (player or NPC) and
  // the relative speed is high enough — so gentle nudges and the static world
  // (terrain, kerbs, buildings) never trip the recovery state.
  const onCollisionEnter = ({ target, other }: CollisionEnterPayload) => {
    const kind = (other.rigidBody?.userData as { kind?: string } | undefined)?.kind;
    if (kind !== 'player' && kind !== 'npc') return;
    const a = target.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    const b = other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < CRASH_SPEED) return;
    driver.onCrash();
  };

  return (
    <RigidBody
      ref={register}
      type="dynamic"
      colliders={false}
      position={[spec.x, spawnY, spec.z]}
      rotation={[0, spec.headingRad, 0]}
      enabledRotations={[false, true, false]}
      linearDamping={0.4}
      angularDamping={0.6}
      canSleep={false}
      userData={{ kind: 'npc', id: spec.id }}
      onCollisionEnter={onCollisionEnter}
    >
      <CuboidCollider args={HALF} mass={600} />
      {/* Lower body */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[HALF[0] * 2, HALF[1] * 2, HALF[2] * 2]} />
        <meshStandardMaterial color={spec.color} />
      </mesh>
      {/* Cabin / greenhouse */}
      <mesh castShadow position={[0, HALF[1] + 0.28, -0.15]}>
        <boxGeometry args={[HALF[0] * 1.7, 0.56, HALF[2] * 1.1]} />
        <meshStandardMaterial color="#20242b" />
      </mesh>
      {/* Wheels */}
      {[
        [HALF[0], -HALF[1], 1.1],
        [-HALF[0], -HALF[1], 1.1],
        [HALF[0], -HALF[1], -1.1],
        [-HALF[0], -HALF[1], -1.1],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
          <meshStandardMaterial color="#15171c" />
        </mesh>
      ))}
    </RigidBody>
  );
}
