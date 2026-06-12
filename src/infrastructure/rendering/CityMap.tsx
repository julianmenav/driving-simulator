import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import type { Game } from '@application/createGame';
import type { Building, Crossing, Prop, RoadSegment, SpeedZone, TerrainSpec } from '@domain/map/MapManifest';
import { elevationAt } from '@domain/map/elevation';
import { buildSurfaceGeometry, rectBounds, type Bounds } from './drape';
import { Terrain } from './Terrain';
import { TrafficLights } from './TrafficLights';

const ASPHALT_COLOR = '#3a3d42';
const LANE_COLOR = '#d8d8d0';
const BUILDING_COLORS = ['#8a8f99', '#9aa0aa', '#7c828d', '#a6abb3'];

/**
 * Renders a drivable scene entirely from a MapManifest: heightfield terrain,
 * road network draped onto it, buildings (with colliders), dynamic props,
 * crossings, speed-limit signs and traffic lights. Swapping the manifest
 * changes the whole layout with no code change.
 */
export function CityMap({ game }: { game: Game }) {
  const manifest = game.map;
  const { terrain } = manifest;

  // Terrain bounds: the city extent plus a wide margin of surrounding land
  // (beyond the level grid elevationAt clamps to the edge plateaus), so
  // leaving the city means driving onto countryside, not off the world.
  const bounds = useMemo<Bounds>(() => {
    const ext =
      Math.max(
        ...manifest.roads.flatMap((r) => [Math.abs(r.x) + r.width / 2, Math.abs(r.z) + r.depth / 2]),
        50,
      ) + 220;
    return { minX: -ext, maxX: ext, minZ: -ext, maxZ: ext };
  }, [manifest.roads]);

  return (
    <>
      <Terrain terrain={terrain} bounds={bounds} />

      {manifest.roads.map((road, i) => (
        <Road key={`road-${i}`} road={road} terrain={terrain} />
      ))}
      {manifest.crossings.map((crossing, i) => (
        <ZebraCrossing key={`xing-${i}`} crossing={crossing} terrain={terrain} />
      ))}
      {manifest.buildings.map((building, i) => (
        <BuildingBlock key={`bld-${i}`} building={building} colorIndex={i} terrain={terrain} />
      ))}
      {manifest.props.map((prop, i) => (
        <PropObject key={`prop-${i}`} prop={prop} terrain={terrain} />
      ))}
      {manifest.speedZones.map((zone, i) => (
        <SpeedLimitSign key={`sign-${i}`} zone={zone} spawnX={manifest.spawn.x} terrain={terrain} />
      ))}
      <TrafficLights game={game} />
    </>
  );
}

function Road({ road, terrain }: { road: RoadSegment; terrain: TerrainSpec }) {
  const alongZ = road.depth >= road.width;
  const asphalt = useMemo(() => buildSurfaceGeometry(rectBounds(road), terrain, 0.02, 4), [road, terrain]);
  const stripe = useMemo(() => {
    const b = rectBounds(road);
    const lane: Bounds = alongZ
      ? { minX: road.x - 0.08, maxX: road.x + 0.08, minZ: b.minZ, maxZ: b.maxZ }
      : { minX: b.minX, maxX: b.maxX, minZ: road.z - 0.08, maxZ: road.z + 0.08 };
    return buildSurfaceGeometry(lane, terrain, 0.05, 4);
  }, [road, alongZ, terrain]);

  return (
    <>
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial color={ASPHALT_COLOR} />
      </mesh>
      <mesh geometry={stripe}>
        <meshStandardMaterial color={LANE_COLOR} />
      </mesh>
    </>
  );
}

const CROSSING_STRIPES = 5;

/** Painted zebra crossing: a row of white bars across the road, draped on the terrain. */
function ZebraCrossing({ crossing, terrain }: { crossing: Crossing; terrain: TerrainSpec }) {
  const alongZ = crossing.axis === 'z';
  const barLength = (alongZ ? crossing.width : crossing.depth) * 0.85;
  const span = alongZ ? crossing.depth : crossing.width;
  const slot = span / CROSSING_STRIPES;
  const bar = slot * 0.55;
  return (
    <>
      {Array.from({ length: CROSSING_STRIPES }, (_, i) => {
        const offset = -span / 2 + (i + 0.5) * slot;
        const x = crossing.x + (alongZ ? 0 : offset);
        const z = crossing.z + (alongZ ? offset : 0);
        const args: [number, number, number] = alongZ ? [barLength, 0.02, bar] : [bar, 0.02, barLength];
        return (
          <mesh key={i} position={[x, elevationAt(terrain, x, z) + 0.06, z]}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={LANE_COLOR} />
          </mesh>
        );
      })}
    </>
  );
}

function BuildingBlock({
  building,
  colorIndex,
  terrain,
}: {
  building: Building;
  colorIndex: number;
  terrain: TerrainSpec;
}) {
  // Sample the terrain under the footprint (corners + centre): the box sinks
  // below the lowest point so a building on a slope never floats over a gap,
  // and its roof height is measured from the highest point.
  const hw = building.width / 2;
  const hd = building.depth / 2;
  const samples = [
    elevationAt(terrain, building.x, building.z),
    elevationAt(terrain, building.x - hw, building.z - hd),
    elevationAt(terrain, building.x + hw, building.z - hd),
    elevationAt(terrain, building.x - hw, building.z + hd),
    elevationAt(terrain, building.x + hw, building.z + hd),
  ];
  const bottom = Math.min(...samples) - 0.6;
  const top = Math.max(...samples) + building.height;
  const boxHeight = top - bottom;

  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, (top + bottom) / 2, building.z]}>
      <CuboidCollider args={[hw, boxHeight / 2, hd]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[building.width, boxHeight, building.depth]} />
        <meshStandardMaterial color={BUILDING_COLORS[colorIndex % BUILDING_COLORS.length]} />
      </mesh>
    </RigidBody>
  );
}

function PropObject({ prop, terrain }: { prop: Prop; terrain: TerrainSpec }) {
  const baseY = elevationAt(terrain, prop.x, prop.z);
  if (prop.kind === 'cone') {
    return (
      <RigidBody colliders="hull" position={[prop.x, baseY + 0.45, prop.z]} mass={2}>
        <mesh castShadow>
          <coneGeometry args={[0.25, 0.7, 12]} />
          <meshStandardMaterial color="#e2742c" />
        </mesh>
      </RigidBody>
    );
  }
  return (
    <RigidBody colliders="cuboid" position={[prop.x, baseY + 0.6, prop.z]} mass={15}>
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
function SpeedLimitSign({ zone, spawnX, terrain }: { zone: SpeedZone; spawnX: number; terrain: TerrainSpec }) {
  const x = spawnX - 5;
  const z = zone.z - zone.depth / 2;
  const baseY = elevationAt(terrain, x, z);
  return (
    <group position={[x, baseY, z]} rotation-y={Math.PI}>
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
