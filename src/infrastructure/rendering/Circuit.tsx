import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import { circuitTurns, sampleCircuit, type CircuitSample, type CircuitTurn } from '@domain/map/circuit';
import type { CircuitSpec, TerrainSpec } from '@domain/map/MapManifest';
import { elevationAt } from '@domain/map/elevation';

const ASPHALT_COLOR = '#33363b';
const LINE_COLOR = '#d8d8d0';

/** Severity thresholds (see `circuitTurns`): kerbs on corners, chevrons + tyres on the sharp ones. */
const KERB_SEVERITY = 6;
const CHEVRON_SEVERITY = 7.5;
const TYRE_SEVERITY = 9.5;

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
 * line, both draped on the terrain, a checkered start/finish band, plus corner
 * furniture (kerbs, direction chevrons and apex tyre stacks) derived from the
 * centreline curvature. The geometry maths is the pure domain `sampleCircuit`/
 * `circuitTurns`, so everything stays in sync from one source.
 */
export function Circuit({ circuit, terrain }: { circuit: CircuitSpec; terrain: TerrainSpec }) {
  const samples = useMemo(() => sampleCircuit(circuit, 16), [circuit]);
  const turns = useMemo(() => circuitTurns(samples), [samples]);
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
      <Kerbs turns={turns} terrain={terrain} halfWidth={half} />
      <Chevrons turns={turns} terrain={terrain} />
      <TyreStacks turns={turns} terrain={terrain} halfWidth={half} />
      <StartFinish sample={samples[0]} terrain={terrain} halfWidth={half} />
    </>
  );
}

/** Red/white rumble strips along both edges of every corner. */
function Kerbs({ turns, terrain, halfWidth }: { turns: CircuitTurn[]; terrain: TerrainSpec; halfWidth: number }) {
  const segments = [];
  for (let i = 0; i < turns.length; i += 2) {
    const t = turns[i];
    if (t.severity < KERB_SEVERITY) continue;
    const yaw = Math.atan2(t.tx, t.tz);
    const white = (i / 2) % 2 === 0;
    const color = white ? '#e6e6e6' : '#c0392b';
    const nx = -t.tz;
    const nz = t.tx;
    for (const side of [1, -1]) {
      const x = t.x + nx * side * halfWidth;
      const z = t.z + nz * side * halfWidth;
      segments.push(
        <mesh key={`${i}-${side}`} position={[x, elevationAt(terrain, x, z) + 0.06, z]} rotation-y={yaw}>
          <boxGeometry args={[0.7, 0.12, 3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={white ? 0.25 : 0.1} />
        </mesh>,
      );
    }
  }
  return <>{segments}</>;
}

/** Flat chevron markings on the track at sharp corners, pointing into the turn. */
function Chevrons({ turns, terrain }: { turns: CircuitTurn[]; terrain: TerrainSpec }) {
  const marks = [];
  for (let i = 0; i < turns.length; i += 4) {
    const t = turns[i];
    if (t.severity < CHEVRON_SEVERITY) continue;
    // Point forward and into the bend.
    const dx = t.tx + t.insideX * 0.7;
    const dz = t.tz + t.insideZ * 0.7;
    const yaw = Math.atan2(dx, dz);
    marks.push(
      <group key={i} position={[t.x, elevationAt(terrain, t.x, t.z) + 0.08, t.z]} rotation-y={yaw}>
        <mesh position={[-0.5, 0, -0.3]} rotation-y={0.6}>
          <boxGeometry args={[0.22, 0.05, 1.6]} />
          <meshStandardMaterial color="#f2c12e" emissive="#f2c12e" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.5, 0, -0.3]} rotation-y={-0.6}>
          <boxGeometry args={[0.22, 0.05, 1.6]} />
          <meshStandardMaterial color="#f2c12e" emissive="#f2c12e" emissiveIntensity={0.7} />
        </mesh>
      </group>,
    );
  }
  return <>{marks}</>;
}

/**
 * Tyre stacks just inside the sharpest corners: dynamic rigid bodies that punish
 * cutting the apex (you hit them on the grass) but can be knocked aside — no
 * walls, the place stays open.
 */
function TyreStacks({ turns, terrain, halfWidth }: { turns: CircuitTurn[]; terrain: TerrainSpec; halfWidth: number }) {
  const stacks = [];
  for (let i = 0; i < turns.length; i += 3) {
    const t = turns[i];
    if (t.severity < TYRE_SEVERITY) continue;
    const x = t.x + t.insideX * (halfWidth + 1.6);
    const z = t.z + t.insideZ * (halfWidth + 1.6);
    const baseY = elevationAt(terrain, x, z);
    stacks.push(
      <RigidBody key={i} colliders={false} position={[x, baseY + 0.3, z]} mass={35} linearDamping={0.6} angularDamping={0.6}>
        <CylinderCollider args={[0.3, 0.6]} />
        <mesh castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.6, 16]} />
          <meshStandardMaterial color="#17181a" />
        </mesh>
      </RigidBody>,
    );
  }
  return <>{stacks}</>;
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
