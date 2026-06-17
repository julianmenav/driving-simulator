import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import type { Game } from '@application/createGame';
import type { RemoteTransform } from '@application/ports/NetworkPort';
import { elevationAt } from '@domain/map/elevation';
import { CarBody } from './CarBody';

/** Per-step position/heading smoothing toward the latest received pose. */
const SMOOTH = 0.25;

/**
 * Another player's car: a **kinematicPosition** body driven by interpolated
 * network poses. Kinematic means the contact solver never moves it (so the
 * local sims never fight), yet it still pushes the local dynamic player car on
 * contact — that is what gives real collisions between players. We lerp toward
 * the latest pose (a tick behind) to hide jitter; per-frame data lives in refs.
 */
export function RemoteVehicle({ game, id, initial }: { game: Game; id: string; initial?: RemoteTransform }) {
  const body = useRef<RapierRigidBody>(null);
  const half = game.vehicleSpec.chassisHalfExtents;

  const spawn = initial?.position ?? {
    x: game.map.spawn.x,
    y: elevationAt(game.map.terrain, game.map.spawn.x, game.map.spawn.z) + 1.1,
    z: game.map.spawn.z,
  };

  const target = useRef<RemoteTransform | null>(initial ?? null);
  const display = useRef({ x: spawn.x, y: spawn.y, z: spawn.z, heading: initial?.headingRad ?? 0 });

  useEffect(
    () =>
      game.events.subscribe('net/remoteTransform', (transform) => {
        if (transform.id === id) target.current = transform;
      }),
    [game.events, id],
  );

  useBeforePhysicsStep(() => {
    const rigid = body.current;
    const next = target.current;
    if (!rigid || !next) return;

    const d = display.current;
    d.x += (next.position.x - d.x) * SMOOTH;
    d.y += (next.position.y - d.y) * SMOOTH;
    d.z += (next.position.z - d.z) * SMOOTH;
    // Shortest-arc heading lerp so it never spins the long way round.
    const delta = Math.atan2(Math.sin(next.headingRad - d.heading), Math.cos(next.headingRad - d.heading));
    d.heading += delta * SMOOTH;

    rigid.setNextKinematicTranslation({ x: d.x, y: d.y, z: d.z });
    const h = d.heading / 2;
    rigid.setNextKinematicRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) });
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[spawn.x, spawn.y, spawn.z]}
      userData={{ kind: 'remote', id }}
    >
      <CuboidCollider args={half} />
      <CarBody halfExtents={half} color="#c8c8d0" />
    </RigidBody>
  );
}
