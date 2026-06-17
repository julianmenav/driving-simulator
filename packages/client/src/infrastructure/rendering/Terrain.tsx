import { RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import type { TerrainSpec } from '@domain/map/MapManifest';
import { buildSurfaceGeometry, type Bounds } from './drape';

const GROUND_COLOR = '#5d7052';

/**
 * The drivable ground: a triangulated heightfield following `terrain`, with a
 * trimesh collider so the vehicle's suspension raycasts hit the slopes.
 */
export function Terrain({ terrain, bounds }: { terrain: TerrainSpec; bounds: Bounds }) {
  const geometry = useMemo(() => buildSurfaceGeometry(bounds, terrain, 0, 5), [terrain, bounds]);
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color={GROUND_COLOR} />
      </mesh>
    </RigidBody>
  );
}
