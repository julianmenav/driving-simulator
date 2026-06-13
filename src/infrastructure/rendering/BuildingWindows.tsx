import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { useLightsOn } from './environment/environmentStore';
import { windowTexture } from './environment/glowTexture';

/**
 * Lit windows on a building, as a single instanced mesh of small panes laid out
 * across the four façades. At night a subset glows warm and a few flip on/off
 * over time (life in the city); by day they read as plain glass. Layout is
 * derived from the box dimensions, so any building gets windows for free — no
 * manifest data needed. The lit pattern is deterministic per building (a stable
 * seed), so a refresh looks the same; only the live twinkle uses randomness,
 * and that lives entirely here in the render layer.
 */

const FLOOR_HEIGHT = 3.4;
const COLUMN_SPACING = 3.0;
const WINDOW_W = 1.3;
const WINDOW_H = 1.7;
const EDGE_MARGIN = 1.8;
const BASE_MARGIN = 1.6;
const FACE_OFFSET = 0.04; // outset from the wall so panes don't z-fight

/** Warm-ish lit colours (some windows whiter, some warmer). */
const LIT_COLORS = ['#ffd79a', '#ffc97a', '#ffe6c0', '#fff0d8'];
const UNLIT_NIGHT = '#0b0e16';
const DAY_GLASS = '#36424f';

interface Pane {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

function computePanes(width: number, depth: number, boxHeight: number): Pane[] {
  const panes: Pane[] = [];
  const floors = Math.max(1, Math.floor((boxHeight - 2 * BASE_MARGIN) / FLOOR_HEIGHT));
  const ys = Array.from({ length: floors }, (_, f) => -boxHeight / 2 + BASE_MARGIN + (f + 0.5) * FLOOR_HEIGHT);

  // Four façades: each runs along one ground axis with its own outward normal.
  const faces = [
    { rotY: 0, span: width, normalAxis: 'z' as const, sign: 1 },
    { rotY: Math.PI, span: width, normalAxis: 'z' as const, sign: -1 },
    { rotY: Math.PI / 2, span: depth, normalAxis: 'x' as const, sign: 1 },
    { rotY: -Math.PI / 2, span: depth, normalAxis: 'x' as const, sign: -1 },
  ];

  for (const face of faces) {
    const usable = face.span - 2 * EDGE_MARGIN;
    if (usable <= 0) continue;
    const cols = Math.max(1, Math.round(usable / COLUMN_SPACING));
    for (let i = 0; i < cols; i++) {
      const u = cols === 1 ? 0 : -usable / 2 + (i / (cols - 1)) * usable;
      for (const y of ys) {
        if (face.normalAxis === 'z') {
          panes.push({ x: u, y, z: face.sign * (depth / 2 + FACE_OFFSET), rotY: face.rotY });
        } else {
          panes.push({ x: face.sign * (width / 2 + FACE_OFFSET), y, z: u, rotY: face.rotY });
        }
      }
    }
  }
  return panes;
}

/** Stable pseudo-random in [0,1) from two integers — deterministic per window. */
function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function BuildingWindows({
  centerX,
  centerY,
  centerZ,
  width,
  depth,
  boxHeight,
  seed,
}: {
  centerX: number;
  centerY: number;
  centerZ: number;
  width: number;
  depth: number;
  boxHeight: number;
  seed: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const lightsOn = useLightsOn();
  const panes = useMemo(() => computePanes(width, depth, boxHeight), [width, depth, boxHeight]);
  // Per-window: whether it is currently lit (only meaningful at night).
  const litRef = useRef<boolean[]>([]);
  const timer = useRef(0);

  // Lay the instances out once (geometry is static).
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quat = new Quaternion();
    const scale = new Vector3(WINDOW_W, WINDOW_H, 1);
    const up = new Vector3(0, 1, 0);
    panes.forEach((pane, i) => {
      quat.setFromAxisAngle(up, pane.rotY);
      matrix.compose(new Vector3(pane.x, pane.y, pane.z), quat, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    litRef.current = panes.map((_, i) => hash(seed, i) < 0.45);
  }, [panes, seed]);

  // Recolour whenever the day/night phase flips (and on first paint).
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new Color();
    panes.forEach((_, i) => {
      mesh.setColorAt(i, paneColor(color, lightsOn, litRef.current[i], seed, i));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [panes, seed, lightsOn]);

  // Live twinkle: every so often, flip a couple of windows on/off (night only).
  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh || !lightsOn || panes.length === 0) return;
    timer.current += dt;
    if (timer.current < 0.5) return;
    timer.current = 0;
    const color = new Color();
    const flips = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < flips; k++) {
      const i = Math.floor(Math.random() * panes.length);
      litRef.current[i] = !litRef.current[i];
      mesh.setColorAt(i, paneColor(color, true, litRef.current[i], seed, i));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (panes.length === 0) return null;
  return (
    <group position={[centerX, centerY, centerZ]}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, panes.length]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={windowTexture()} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function paneColor(target: Color, lightsOn: boolean, lit: boolean, seed: number, i: number): Color {
  if (!lightsOn) return target.set(DAY_GLASS);
  if (!lit) return target.set(UNLIT_NIGHT);
  return target.set(LIT_COLORS[Math.floor(hash(seed + 1, i) * LIT_COLORS.length)]);
}
