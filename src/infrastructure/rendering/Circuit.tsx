import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import { sampleCircuit, type CircuitSample } from '@domain/map/circuit';
import type { CircuitSpec, TerrainSpec } from '@domain/map/MapManifest';
import { elevationAt } from '@domain/map/elevation';

const ASPHALT_COLOR = '#33363b';
const LINE_COLOR = '#d8d8d0';

/**
 * Builds a closed ribbon mesh of the given half-width centred on the sampled
 * centreline, draped onto the terrain. Two-sided so winding never hides it.
 */
function buildRibbon(
  samples: CircuitSample[],
  terrain: TerrainSpec,
  halfWidth: number,
  yOffset: number,
): BufferGeometry {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  let p = 0;
  for (const s of samples) {
    // Left normal of the tangent is (-tz, tx).
    const nx = -s.tz;
    const nz = s.tx;
    const lx = s.x + nx * halfWidth;
    const lz = s.z + nz * halfWidth;
    const rx = s.x - nx * halfWidth;
    const rz = s.z - nz * halfWidth;
    positions[p++] = lx;
    positions[p++] = elevationAt(terrain, lx, lz) + yOffset;
    positions[p++] = lz;
    positions[p++] = rx;
    positions[p++] = elevationAt(terrain, rx, rz) + yOffset;
    positions[p++] = rz;
  }

  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const li = 2 * i;
    const ri = 2 * i + 1;
    const lj = 2 * j;
    const rj = 2 * j + 1;
    indices.push(li, ri, lj, lj, ri, rj);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Renders a race circuit from its manifest spec: asphalt ribbon + a thin centre
 * line, both draped on the terrain, and a checkered start/finish band. The
 * centreline maths is the pure domain `sampleCircuit`, so geometry, spawn and
 * (later) checkpoints share one source of truth.
 */
export function Circuit({ circuit, terrain }: { circuit: CircuitSpec; terrain: TerrainSpec }) {
  const samples = useMemo(() => sampleCircuit(circuit, 16), [circuit]);
  const half = circuit.width / 2;

  const asphalt = useMemo(() => buildRibbon(samples, terrain, half, 0.04), [samples, terrain, half]);
  const centerLine = useMemo(() => buildRibbon(samples, terrain, 0.15, 0.06), [samples, terrain]);

  return (
    <>
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial color={ASPHALT_COLOR} side={DoubleSide} />
      </mesh>
      <mesh geometry={centerLine}>
        <meshStandardMaterial color={LINE_COLOR} side={DoubleSide} />
      </mesh>
      <StartFinish sample={samples[0]} terrain={terrain} halfWidth={half} />
    </>
  );
}

const CHECK_COLS = 8;
const CHECK_ROWS = 2;

/** A checkered start/finish band laid across the track at the first sample. */
function StartFinish({
  sample,
  terrain,
  halfWidth,
}: {
  sample: CircuitSample;
  terrain: TerrainSpec;
  halfWidth: number;
}) {
  // Across the track = left normal (-tz, tx); along the track = tangent.
  const nx = -sample.tz;
  const nz = sample.tx;
  const cell = (halfWidth * 2) / CHECK_COLS;
  const cells = [];
  for (let c = 0; c < CHECK_COLS; c++) {
    for (let r = 0; r < CHECK_ROWS; r++) {
      const across = -halfWidth + (c + 0.5) * cell;
      const along = (r - (CHECK_ROWS - 1) / 2) * cell;
      const x = sample.x + nx * across + sample.tx * along;
      const z = sample.z + nz * across + sample.tz * along;
      const dark = (c + r) % 2 === 0;
      cells.push(
        <mesh key={`${c}-${r}`} position={[x, elevationAt(terrain, x, z) + 0.07, z]} rotation-y={Math.atan2(nx, nz)}>
          <boxGeometry args={[cell, 0.02, cell]} />
          <meshStandardMaterial color={dark ? '#1a1a1a' : '#f2f2f2'} />
        </mesh>,
      );
    }
  }
  return <>{cells}</>;
}
