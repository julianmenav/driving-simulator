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
import { DoubleSide, type Group } from 'three';
import type { Game } from '@application/createGame';
import { DEFAULT_VEHICLE_SPEC as spec } from '@domain/vehicle/VehicleSpec';
import { RearViewMirror } from '@infrastructure/rendering/RearViewMirror';

const WHEEL_DIRECTION = { x: 0, y: -1, z: 0 };
// Con el eje de rueda en -x, fuerza de motor positiva empuja hacia +z (frente).
const WHEEL_AXLE = { x: -1, y: 0, z: 0 };
const FRONT_WHEELS = [0, 1];
const REAR_WHEELS = [2, 3];
const WHEEL_WIDTH = 0.26;

/**
 * Vehículo del jugador: chasis dinámico + DynamicRayCastVehicleController de
 * Rapier, con la cámara en primera persona montada en el asiento del
 * conductor (a la izquierda). Lee el ControlsPort en cada paso de físicas y
 * publica el estado del vehículo en el bus de eventos.
 */
export function PlayerVehicle({ game }: { game: Game }) {
  const { world } = useRapier();
  const chassisRef = useRef<RapierRigidBody>(null);
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);
  const wheelRefs = useRef<(Group | null)[]>([]);
  const steeringRef = useRef(0);

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
    const speed = controller.currentVehicleSpeed(); // m/s, positivo hacia delante
    const speedKmh = speed * 3.6;

    // Volante suavizado y menos sensible a alta velocidad.
    const speedFactor = 1 / (1 + Math.abs(speed) * 0.06);
    const targetSteering = steering * spec.maxSteeringAngle * speedFactor;
    steeringRef.current += (targetSteering - steeringRef.current) * Math.min(1, spec.steeringSpeed * dt);

    game.controls.consumeShiftRequests().forEach((direction) => game.gearbox.shift(direction, speedKmh));
    const { engineForce, brakeForce } = game.gearbox.computeDrive({ throttle, brake }, speedKmh);

    FRONT_WHEELS.forEach((i) => controller.setWheelSteering(i, steeringRef.current));
    // La fuerza de motor total se reparte entre las ruedas motrices.
    REAR_WHEELS.forEach((i) => controller.setWheelEngineForce(i, engineForce / REAR_WHEELS.length));
    // Reparto de frenada 100/60: el eje trasero bloqueado hace guiñar el coche.
    FRONT_WHEELS.forEach((i) => controller.setWheelBrake(i, brakeForce));
    REAR_WHEELS.forEach((i) => controller.setWheelBrake(i, brakeForce * 0.6));

    // Resistencia aerodinámica: F = -coef · |v| · v
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

  // Coloca las ruedas visuales según suspensión, giro y rodadura.
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

      {/* Carrocería */}
      <mesh castShadow>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial color="#a33434" />
      </mesh>
      {/* Capó, visible desde el asiento */}
      <mesh castShadow position={[0, 0.43, 1.45]}>
        <boxGeometry args={[hx * 2 - 0.1, 0.16, 1.2]} />
        <meshStandardMaterial color="#8f2b2b" />
      </mesh>
      {/* Salpicadero */}
      <mesh position={[0, 0.58, 0.78]}>
        <boxGeometry args={[hx * 2 - 0.2, 0.22, 0.45]} />
        <meshStandardMaterial color="#1d1f24" />
      </mesh>

      {/* Cabina: pilares A, marco del parabrisas, techo, pilares B y ventanillas */}
      <mesh castShadow position={[0.78, 1.03, 0.85]} rotation-x={-0.35}>
        <boxGeometry args={[0.06, 0.85, 0.06]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh castShadow position={[-0.78, 1.03, 0.85]} rotation-x={-0.35}>
        <boxGeometry args={[0.06, 0.85, 0.06]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh castShadow position={[0, 1.36, 0.72]}>
        <boxGeometry args={[1.64, 0.1, 0.1]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh castShadow position={[0, 1.39, -0.12]}>
        <boxGeometry args={[1.8, 0.07, 1.9]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh castShadow position={[0.8, 1.05, -0.95]}>
        <boxGeometry args={[0.08, 0.78, 0.08]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh castShadow position={[-0.8, 1.05, -0.95]}>
        <boxGeometry args={[0.08, 0.78, 0.08]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh position={[0.85, 0.78, -0.05]}>
        <boxGeometry args={[0.07, 0.12, 1.9]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>
      <mesh position={[-0.85, 0.78, -0.05]}>
        <boxGeometry args={[0.07, 0.12, 1.9]} />
        <meshStandardMaterial color="#1f2227" />
      </mesh>

      {/* Cristales: parabrisas, ventanillas y luneta */}
      <mesh position={[0, 1.03, 0.85]} rotation-x={-0.35}>
        <planeGeometry args={[1.56, 0.85]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0.86, 1.05, -0.05]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 0.6]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[-0.86, 1.05, -0.05]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 0.6]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.06, -0.99]}>
        <planeGeometry args={[1.5, 0.55]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Soportes de los retrovisores: vástago central y brazos de puerta */}
      <mesh position={[0, 1.25, 0.72]}>
        <boxGeometry args={[0.03, 0.1, 0.03]} />
        <meshStandardMaterial color="#101216" />
      </mesh>
      <mesh position={[0.9, 0.93, 0.9]}>
        <boxGeometry args={[0.14, 0.035, 0.035]} />
        <meshStandardMaterial color="#101216" />
      </mesh>
      <mesh position={[-0.9, 0.93, 1.15]}>
        <boxGeometry args={[0.14, 0.035, 0.035]} />
        <meshStandardMaterial color="#101216" />
      </mesh>

      {/* Ruedas */}
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

      {/* Retrovisores: interior y de puerta (por encima de la línea de ventanilla) */}
      <RearViewMirror position={[0, 1.16, 0.72]} width={0.3} height={0.09} fov={20} />
      <RearViewMirror position={[0.97, 0.93, 0.9]} width={0.22} height={0.13} tilt={0.3} cameraYaw={-0.15} fov={38} phase={1} />
      <RearViewMirror position={[-0.97, 0.93, 1.15]} width={0.22} height={0.13} tilt={-0.3} cameraYaw={0.15} fov={38} phase={1} />

      {/* Asiento del conductor (izquierda); mirando hacia +z */}
      <PerspectiveCamera makeDefault fov={80} near={0.1} far={500} position={[0.3, 0.95, 0.15]} rotation={[0, Math.PI, 0]} />
    </RigidBody>
  );
}
