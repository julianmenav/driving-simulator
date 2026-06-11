import { CuboidCollider, RigidBody } from '@react-three/rapier';

const ROAD_LENGTH = 400;
const DASH_COUNT = 40;

/** Static ground with a straight road along +z as a test area. */
export function Ground() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1000, 0.5, 1000]} position={[0, -0.5, 0]} />
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[2000, 1, 2000]} />
          <meshStandardMaterial color="#5d7052" />
        </mesh>
      </RigidBody>

      {/* Asphalt (visual only; the collider is the ground) */}
      <mesh receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[8, 0.02, ROAD_LENGTH]} />
        <meshStandardMaterial color="#3a3d42" />
      </mesh>

      {/* Dashed center line */}
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <mesh key={i} position={[0, 0.03, -ROAD_LENGTH / 2 + (i + 0.5) * (ROAD_LENGTH / DASH_COUNT)]}>
          <boxGeometry args={[0.15, 0.02, 2]} />
          <meshStandardMaterial color="#d8d8d0" />
        </mesh>
      ))}
    </>
  );
}

const CONE_POSITIONS: [number, number][] = [
  [3, 14],
  [-3, 22],
  [3, 30],
  [-3, 38],
  [3, 46],
  [-3, 54],
];

const CRATE_POSITIONS: [number, number][] = [
  [-6, 18],
  [6.5, 34],
  [-7, 48],
  [7, 60],
];

/** Dynamic cones and crates for motion references and something to push around. */
export function Obstacles() {
  return (
    <>
      {CONE_POSITIONS.map(([x, z], i) => (
        <RigidBody key={`cone-${i}`} colliders="hull" position={[x, 0.35, z]} mass={2}>
          <mesh castShadow>
            <coneGeometry args={[0.25, 0.7, 12]} />
            <meshStandardMaterial color="#e2742c" />
          </mesh>
        </RigidBody>
      ))}
      {CRATE_POSITIONS.map(([x, z], i) => (
        <RigidBody key={`crate-${i}`} colliders="cuboid" position={[x, 0.5, z]} mass={15}>
          <mesh castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#8a6f4d" />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
