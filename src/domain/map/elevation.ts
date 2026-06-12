import type { TerrainSpec } from './MapManifest';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hermite smoothstep: flat (zero slope) at 0 and 1. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Fraction of each cell-to-cell span that stays perfectly flat at both ends. */
const PLATEAU = 0.3;

/**
 * Easing between two cell centres: flat for the first and last `PLATEAU` of
 * the span, with the whole climb as a smoothstep hill in the middle band.
 */
const ease = (t: number) => smoothstep(clamp((t - PLATEAU) / (1 - 2 * PLATEAU), 0, 1));

/**
 * Ground height at a point under the level-plateau model: bilinear
 * interpolation of the four surrounding cell levels, with a smoothstep on the
 * fractional coordinates. The smoothstep's zero slope at the ends makes the
 * terrain flat around each cell centre (the plateau) and concentrates the
 * climb in a smooth hillside between cells of different levels. Pure and
 * deterministic; points outside the grid clamp to the edge cells.
 */
export function elevationAt(terrain: TerrainSpec, x: number, z: number): number {
  const { levels, cellSize, levelHeight, originX, originZ } = terrain;
  const rows = levels.length;
  const cols = levels[0].length;

  // Continuous cell coordinates (cell centres at integers).
  const cx = clamp((x - originX) / cellSize, 0, cols - 1);
  const cz = clamp((z - originZ) / cellSize, 0, rows - 1);

  const ix = Math.min(Math.floor(cx), cols - 2 >= 0 ? cols - 2 : 0);
  const iz = Math.min(Math.floor(cz), rows - 2 >= 0 ? rows - 2 : 0);
  const tx = ease(clamp(cx - ix, 0, 1));
  const tz = ease(clamp(cz - iz, 0, 1));

  const ix1 = Math.min(ix + 1, cols - 1);
  const iz1 = Math.min(iz + 1, rows - 1);
  const top = levels[iz][ix] * (1 - tx) + levels[iz][ix1] * tx;
  const bottom = levels[iz1][ix] * (1 - tx) + levels[iz1][ix1] * tx;

  return (top * (1 - tz) + bottom * tz) * levelHeight;
}
