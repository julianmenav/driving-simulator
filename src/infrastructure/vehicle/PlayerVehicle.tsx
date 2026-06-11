import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import { type Group, type PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import type { Game } from '@application/createGame';
import { DEFAULT_VEHICLE_SPEC as spec } from '@domain/vehicle/VehicleSpec';
import { Cabin } from '@infrastructure/vehicle/Cabin';
import { RearViewMirror } from '@infrastructure/rendering/RearViewMirror';

const WHEEL_DIRECTION = { x: 0, y: -1, z: 0 };
// With the wheel axle along -x, positive engine force pushes towards +z (front).
const WHEEL_AXLE = { x: -1, y: 0, z: 0 };
const FRONT_WHEELS = [0, 1];
const REAR_WHEELS = [2, 3];
const WHEEL_WIDTH = 0.26;

/**
 * Player vehicle: dynamic chassis + Rapier DynamicRayCastVehicleController,
 * with the first-person camera mounted at the driver seat (left side). It
 * reads the ControlsPort on every physics step and publishes the vehicle
 * state on the event bus.
 */
export function PlayerVehicle({ game }: { game: Game }) {
  const { world } = useRapier();
  const chassisRef = useRef<RapierRigidBody>(null);
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);
  const wheelRefs = useRef<(Group | null)[]>([]);
  const steeringRef = useRef(0);
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  // The first-person camera also renders the cabin interior (layer 1). The
  // exterior bodywork stays on layer 0, so it shows up in the mirrors too
  // (a sliver of our own car), while the interior trim (layer 1) does not.
  useEffect(() => {
    cameraRef.current?.layers.enable(1);
  }, []);

  useEffect(() => {
    const chassis = chassisRef.current;
    if (!chassis) return;

    const controller = world.createVehicleController(chassis);
    spec.wheelPositions.forEach(([x, y, z], i) => {
      controller.addWheel({ x, y, z }, WHEEL_DIRECTION, WHEEL_AXLE, spec.suspensionRestLength, spec.wheelRadius);
      controller.setWheelSuspensionStiffness(i, spec.suspensionStiffness);
      controller.setWheelSuspensionCompression(i, spec.suspensionCompression);
      controller.setWheelSuspensionRelaxation(i, spec.suspensionRelaxation);
      controller.setWheelMaxSuspensionForce(i, 100_000);
    });
    controllerRef.current = controller;

    return () => {
      controllerRef.current = null;
      world.removeVehicleController(controller);
    };
  }, [world]);

  useBeforePhysicsStep(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const { throttle, brake, steering } = game.controls.read();
    const dt = world.timestep;
    const speed = controller.currentVehicleSpeed(); // m/s, positive forward
    const speedKmh = speed * 3.6;

    // Smoothed steering, less sensitive at high speed.
    const speedFactor = 1 / (1 + Math.abs(speed) * 0.06);
    const targetSteering = steering * spec.maxSteeringAngle * speedFactor;
    steeringRef.current += (targetSteering - steeringRef.current) * Math.min(1, spec.steeringSpeed * dt);

    game.controls.consumeShiftRequests().forEach((direction) => game.gearbox.shift(direction, speedKmh));
    const { engineForce, brakeForce } = game.gearbox.computeDrive({ throttle, brake }, speedKmh);

    FRONT_WHEELS.forEach((i) => controller.setWheelSteering(i, steeringRef.current));
    // The total engine force is split across the driven wheels.
    REAR_WHEELS.forEach((i) => controller.setWheelEngineForce(i, engineForce / REAR_WHEELS.length));
    // 100/60 brake split: a locked rear axle makes the car yaw.
    FRONT_WHEELS.forEach((i) => controller.setWheelBrake(i, brakeForce));
    REAR_WHEELS.forEach((i) => controller.setWheelBrake(i, brakeForce * 0.6));

    // Aerodynamic drag: F = -coef · |v| · v
    const chassis = chassisRef.current;
    if (chassis) {
      const velocity = chassis.linvel();
      const magnitude = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (magnitude > 0.5) {
        const k = spec.aeroDragCoefficient * magnitude * dt;
        chassis.applyImpulse({ x: -k * velocity.x, y: -k * velocity.y, z: -k * velocity.z }, true);
      }
    }

    controller.updateVehicle(dt);

    game.events.publish('vehicle/stateUpdated', { speedKmh });
  });

  // Places the visual wheels according to suspension travel, steering and rolling.
  useFrame(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    spec.wheelPositions.forEach(([x, y, z], i) => {
      const wheel = wheelRefs.current[i];
      if (!wheel) return;
      const suspension = controller.wheelSuspensionLength(i) ?? spec.suspensionRestLength;
      wheel.position.set(x, y - suspension, z);
      wheel.rotation.set(0, 0, 0);
      wheel.rotateY(controller.wheelSteering(i) ?? 0);
      wheel.rotateX(-(controller.wheelRotation(i) ?? 0));
    });
  });

  const [hx, hy, hz] = spec.chassisHalfExtents;

  return (
    <RigidBody ref={chassisRef} type="dynamic" colliders={false} position={[0, 1.1, 0]} canSleep={false}>
      <CuboidCollider args={[hx, hy, hz]} mass={spec.chassisMass} />

      {/* Exterior bodywork + wheels (layer 0, also seen in the mirrors) */}
      <group>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
          <meshStandardMaterial color="#a33434" />
        </mesh>
        {/* Hood, visible from the driver seat */}
        <mesh castShadow position={[0, 0.43, 1.45]}>
          <boxGeometry args={[hx * 2 - 0.1, 0.16, 1.2]} />
          <meshStandardMaterial color="#8f2b2b" />
        </mesh>
        {/* Wheels */}
        {spec.wheelPositions.map((position, i) => (
          <group
            key={i}
            position={position}
            ref={(el) => {
              wheelRefs.current[i] = el;
            }}
          >
            <mesh castShadow rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[spec.wheelRadius, spec.wheelRadius, WHEEL_WIDTH, 20]} />
              <meshStandardMaterial color="#16181c" />
            </mesh>
          </group>
        ))}
      </group>

      {/* First-person interior (dashboard, wheel, doors, glass...) on layer 1 */}
      <Cabin game={game} steeringRef={steeringRef} />

      {/* Rear-view mirrors: interior mirror + door mirrors out on each door
          (the right one sits far out on the passenger side, barely on screen).
          The door cameras look back with a slight downward pitch and a touch of
          inward yaw, so they catch the road plus a sliver of our own bodywork.
          Lower fov = a little zoom. */}
      <RearViewMirror position={[0, 1.16, 0.72]} width={0.3} height={0.09} fov={22} distortion={0.12} />
      <RearViewMirror position={[0.99, 0.92, 1.0]} width={0.22} height={0.13} tilt={0.32} cameraYaw={-0.24} cameraPitch={-0.12} fov={54} distortion={0.3} phase={1} />
      <RearViewMirror position={[-0.99, 0.92, 1.0]} width={0.22} height={0.13} tilt={-0.32} cameraYaw={0.24} cameraPitch={-0.12} fov={54} distortion={0.3} phase={1} />

      {/* Driver seat (left side); raised eye point for a clear road view over
          the low wheel, looking towards +z */}
      <PerspectiveCamera ref={cameraRef} makeDefault fov={80} near={0.1} far={500} position={[0.3, 1.1, 0.12]} rotation={[0, Math.PI, 0]} />
    </RigidBody>
  );
}
