import type { TerrainSpec } from './MapManifest';

/**
 * Ground height at a point, as a sum of gentle sinusoids. Pure and
 * deterministic (same input → same output), so the generator, the renderer and
 * the vehicle spawn all agree on where the ground is. Bounded by the sum of the
 * component amplitudes.
 */
export function elevationAt(terrain: TerrainSpec, x: number, z: number): number {
  let y = 0;
  for (const c of terrain.components) {
    y += c.amplitude * Math.sin(x / c.wavelengthX + c.phase) * Math.cos(z / c.wavelengthZ + c.phase);
  }
  return y;
}
