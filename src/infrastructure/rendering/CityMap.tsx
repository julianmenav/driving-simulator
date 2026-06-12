import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Building, Crossing, MapManifest, Prop, RoadSegment, SpeedZone } from '@domain/map/MapManifest';

const GROUND_COLOR = '#5d7052';
const ASPHALT_COLOR = '#3a3d42';
const LANE_COLOR = '#d8d8d0';
const BUILDING_COLORS = ['#8a8f99', '#9aa0aa', '#7c828d', '#a6abb3'];

/**
 * Renders a drivable scene entirely from a MapManifest: ground, road network,
 * buildings (with colliders), dynamic props and speed-limit signs at each
 * zone. Swapping the manifest changes the whole layout with no code change.
 */
export function CityMap({ manifest }: { manifest: MapManifest }) {
  return (
    <>
      {/* Flat ground: one big static collider + a green plane. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1000, 0.5, 1000]} position={[0, -0.5, 0]} />
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[2000, 1, 2000]} />
          <meshStandardMaterial color={GROUND_COLOR} />
        </mesh>
      </RigidBody>

      {manifest.roads.map((road, i) => (
        <Road key={`road-${i}`} road={road} />
      ))}
      {manifest.crossings.map((crossing, i) => (
        <ZebraCrossing key={`xing-${i}`} crossing={crossing} />
      ))}
      {manifest.buildings.map((building, i) => (
        <BuildingBlock key={`bld-${i}`} building={building} colorIndex={i} />
      ))}
      {manifest.props.map((prop, i) => (
        <PropObject key={`prop-${i}`} prop={prop} />
      ))}
      {manifest.speedZones.map((zone, i) => (
        <SpeedLimitSign key={`sign-${i}`} zone={zone} spawnX={manifest.spawn.x} />
      ))}
    </>
  );
}

function Road({ road }: { road: RoadSegment }) {
  const alongZ = road.depth >= road.width;
  return (
    <group position={[road.x, 0, road.z]}>
      <mesh receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[road.width, 0.02, road.depth]} />
        <meshStandardMaterial color={ASPHALT_COLOR} />
      </mesh>
      {/* Centre lane stripe down the long axis. */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={alongZ ? [0.15, 0.02, road.depth] : [road.width, 0.02, 0.15]} />
        <meshStandardMaterial color={LANE_COLOR} />
      </mesh>
    </group>
  );
}

const CROSSING_STRIPES = 5;

/** Painted zebra crossing: a row of white bars across the road. */
function ZebraCrossing({ crossing }: { crossing: Crossing }) {
  const alongZ = crossing.axis === 'z';
  // Bars run across the road and repeat along the travel axis.
  const barLength = (alongZ ? crossing.width : crossing.depth) * 0.85;
  const span = alongZ ? crossing.depth : crossing.width;
  const slot = span / CROSSING_STRIPES;
  const bar = slot * 0.55;
  return (
    <group position={[crossing.x, 0.04, crossing.z]}>
      {Array.from({ length: CROSSING_STRIPES }, (_, i) => {
        const offset = -span / 2 + (i + 0.5) * slot;
        const args: [number, number, number] = alongZ
          ? [barLength, 0.02, bar]
          : [bar, 0.02, barLength];
        return (
          <mesh key={i} position={[alongZ ? 0 : offset, 0, alongZ ? offset : 0]}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={LANE_COLOR} />
          </mesh>
        );
      })}
    </group>
  );
}

function BuildingBlock({ building, colorIndex }: { building: Building; colorIndex: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, building.height / 2, building.z]}>
      <CuboidCollider args={[building.width / 2, building.height / 2, building.depth / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial color={BUILDING_COLORS[colorIndex % BUILDING_COLORS.length]} />
      </mesh>
    </RigidBody>
  );
}

function PropObject({ prop }: { prop: Prop }) {
  if (prop.kind === 'cone') {
    return (
      <RigidBody colliders="hull" position={[prop.x, 0.35, prop.z]} mass={2}>
        <mesh castShadow>
          <coneGeometry args={[0.25, 0.7, 12]} />
          <meshStandardMaterial color="#e2742c" />
        </mesh>
      </RigidBody>
    );
  }
  return (
    <RigidBody colliders="cuboid" position={[prop.x, 0.5, prop.z]} mass={15}>
      <mesh castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a6f4d" />
      </mesh>
    </RigidBody>
  );
}

/**
 * A speed-limit sign at the zone's southern edge (the face an approaching car
 * driving +z sees), set just off the spawn road. White disc + red ring + the
 * limit number, facing -z.
 */
function SpeedLimitSign({ zone, spawnX }: { zone: SpeedZone; spawnX: number }) {
  const z = zone.z - zone.depth / 2;
  return (
    <group position={[spawnX - 5, 0, z]} rotation-y={Math.PI}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshStandardMaterial color="#9aa3b0" />
      </mesh>
      {/* Disc faces ±z after rotating the cylinder onto the z axis. */}
      <mesh position={[0, 2.3, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.45, 0.45, 0.05, 24]} />
        <meshStandardMaterial color="#f5f5f0" />
      </mesh>
      <mesh position={[0, 2.3, 0.04]}>
        <torusGeometry args={[0.42, 0.07, 12, 28]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      <Text position={[0, 2.3, 0.08]} fontSize={0.42} color="#1a1a1a" anchorX="center" anchorY="middle">
        {String(zone.limitKmh)}
      </Text>
    </group>
  );
}
