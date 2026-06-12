import { BufferAttribute, BufferGeometry } from 'three';
import { elevationAt } from '@domain/map/elevation';
import type { Rect, TerrainSpec } from '@domain/map/MapManifest';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Axis-aligned bounds of a Rect (centre + extents). */
export function rectBounds(rect: Rect): Bounds {
  return {
    minX: rect.x - rect.width / 2,
    maxX: rect.x + rect.width / 2,
    minZ: rect.z - rect.depth / 2,
    maxZ: rect.z + rect.depth / 2,
  };
}

/**
 * A triangulated grid over `bounds`, each vertex lifted to the terrain height
 * (+ yOffset). Used for the ground, draped roads and crossings so flat surfaces
 * follow the hills. Triangle winding gives upward normals.
 */
export function buildSurfaceGeometry(
  bounds: Bounds,
  terrain: TerrainSpec,
  yOffset: number,
  step: number,
): BufferGeometry {
  const nx = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / step));
  const nz = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / step));
  const rowLen = nx + 1;
  const positions = new Float32Array(rowLen * (nz + 1) * 3);

  let p = 0;
  for (let iz = 0; iz <= nz; iz++) {
    const z = bounds.minZ + (iz / nz) * (bounds.maxZ - bounds.minZ);
    for (let ix = 0; ix <= nx; ix++) {
      const x = bounds.minX + (ix / nx) * (bounds.maxX - bounds.minX);
      positions[p++] = x;
      positions[p++] = elevationAt(terrain, x, z) + yOffset;
      positions[p++] = z;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * rowLen + ix;
      const b = a + 1;
      const c = a + rowLen;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
