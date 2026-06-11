import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { DoubleSide, type Group } from 'three';
import type { Game } from '@application/createGame';
import type { Gear } from '@domain/vehicle/Gear';
import { DEFAULT_VEHICLE_SPEC as spec } from '@domain/vehicle/VehicleSpec';

/** Visual lock: wheel rotation (rad) at full steering — about 1.4 turns total. */
const WHEEL_VISUAL_LOCK = 2.2;
/** Shared slope of the dashboard top / instrument hood (rad about X). */
const DASH_SLOPE = -0.32;

interface CabinProps {
  game: Game;
  /** Smoothed road-wheel steering angle (rad), updated per physics step. */
  steeringRef: { readonly current: number };
}

/**
 * Cosmetic first-person interior: swept dashboard, instrument cluster,
 * steering wheel, continuous door panels, pillars, glass and a soft fill
 * light. All of it lives on render layer 1: the first-person camera renders
 * it, but the rear-view mirror cameras (layer 0) do not, so no interior trim
 * leaks into the mirrors.
 */
export function Cabin({ game, steeringRef }: CabinProps) {
  const rootRef = useRef<Group>(null);
  const wheelRef = useRef<Group>(null);

  useEffect(() => {
    rootRef.current?.traverse((o) => o.layers.set(1));
  }, []);

  // The steering wheel turns with the smoothed steering (per-frame, no React).
  useFrame(() => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z = -(steeringRef.current / spec.maxSteeringAngle) * WHEEL_VISUAL_LOCK;
    }
  });

  return (
    <group ref={rootRef}>
      {/* The sun (layer 0) does not light layer-1 geometry, so the cabin needs
          its own rig. These lights are layer 1 too (via the traverse above),
          so they only light the interior and never leak into the mirrors. */}
      <hemisphereLight args={['#e3ecf4', '#54585f', 1.25]} />
      <directionalLight position={[5, 9, 4]} intensity={2.2} color="#fff3e2" />

      {/* Dashboard: vertical fascia + sloped matte top spanning the cabin */}
      <mesh position={[0, 0.52, 0.95]}>
        <boxGeometry args={[1.66, 0.32, 0.13]} />
        <meshStandardMaterial color="#343943" flatShading />
      </mesh>
      <mesh position={[0, 0.66, 0.74]} rotation-x={DASH_SLOPE}>
        <boxGeometry args={[1.66, 0.5, 0.05]} />
        <meshStandardMaterial color="#282c33" flatShading />
      </mesh>

      {/* Centre stack: panel with two air vents and a pair of control knobs */}
      <mesh position={[-0.02, 0.46, 1.0]}>
        <boxGeometry args={[0.36, 0.26, 0.04]} />
        <meshStandardMaterial color="#262930" flatShading />
      </mesh>
      <mesh position={[0.32, 0.62, 1.0]}>
        <boxGeometry args={[0.2, 0.055, 0.03]} />
        <meshStandardMaterial color="#121418" flatShading />
      </mesh>
      <mesh position={[-0.22, 0.62, 1.0]}>
        <boxGeometry args={[0.2, 0.055, 0.03]} />
        <meshStandardMaterial color="#121418" flatShading />
      </mesh>
      {[-0.08, 0.04].map((x) => (
        <mesh key={x} position={[x, 0.42, 1.02]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
          <meshStandardMaterial color="#3a3f47" flatShading />
        </mesh>
      ))}

      {/* Instrument binnacle: a low solid housing on the dash that backs the
          cluster on its driver-facing face. Kept low so the road stays visible
          above it; the small cluster sits just above the wheel rim. */}
      <mesh position={[0.3, 0.77, 0.73]}>
        <boxGeometry args={[0.48, 0.42, 0.3]} />
        <meshStandardMaterial color="#282c33" flatShading />
      </mesh>
      <InstrumentCluster game={game} />

      {/* Steering wheel: low, column tilted towards the driver, rim spins about
          its own normal. A 12 o'clock marker makes the rotation legible. */}
      <group position={[0.3, 0.72, 0.46]} rotation-x={0.55}>
        <group ref={wheelRef}>
          <mesh>
            <torusGeometry args={[0.185, 0.024, 10, 28]} />
            <meshStandardMaterial color="#2d3037" flatShading />
          </mesh>
          <mesh>
            <boxGeometry args={[0.08, 0.08, 0.05]} />
            <meshStandardMaterial color="#202329" flatShading />
          </mesh>
          {[Math.PI, Math.PI / 3, -Math.PI / 3].map((angle, i) => (
            <group key={i} rotation-z={angle}>
              <mesh position={[0, 0.093, 0]}>
                <boxGeometry args={[0.032, 0.165, 0.022]} />
                <meshStandardMaterial color="#2d3037" flatShading />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.185, 0.015]}>
            <boxGeometry args={[0.04, 0.03, 0.02]} />
            <meshStandardMaterial color="#9aa3b0" flatShading />
          </mesh>
        </group>
      </group>

      {/* Door panels (both sides): one continuous card + sill + armrest + pull */}
      <DoorPanel side={1} />
      <DoorPanel side={-1} />

      {/* Cabin frame: A pillars, windshield header, roof, B pillars. Header
          and roof raised a little to enlarge the windshield opening. */}
      <mesh position={[0.78, 1.08, 0.84]} rotation-x={-0.35}>
        <boxGeometry args={[0.06, 0.95, 0.06]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>
      <mesh position={[-0.78, 1.08, 0.84]} rotation-x={-0.35}>
        <boxGeometry args={[0.06, 0.95, 0.06]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>
      <mesh position={[0, 1.43, 0.71]}>
        <boxGeometry args={[1.64, 0.1, 0.1]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>
      <mesh position={[0, 1.46, -0.12]}>
        <boxGeometry args={[1.8, 0.07, 1.9]} />
        <meshStandardMaterial color="#23262c" flatShading />
      </mesh>
      <mesh position={[0.8, 1.05, -0.95]}>
        <boxGeometry args={[0.08, 0.78, 0.08]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>
      <mesh position={[-0.8, 1.05, -0.95]}>
        <boxGeometry args={[0.08, 0.78, 0.08]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>

      {/* Glass: windshield (enlarged), side windows and rear window */}
      <mesh position={[0, 1.07, 0.84]} rotation-x={-0.35}>
        <planeGeometry args={[1.64, 0.98]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0.86, 1.05, -0.05]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 0.6]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[-0.86, 1.05, -0.05]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 0.6]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.06, -0.99]}>
        <planeGeometry args={[1.5, 0.55]} />
        <meshStandardMaterial color="#9fc4dd" transparent opacity={0.16} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Mirror mounts: center stalk and door arms */}
      <mesh position={[0, 1.25, 0.72]}>
        <boxGeometry args={[0.03, 0.1, 0.03]} />
        <meshStandardMaterial color="#101216" />
      </mesh>
      <mesh position={[0.9, 0.93, 0.9]}>
        <boxGeometry args={[0.14, 0.035, 0.035]} />
        <meshStandardMaterial color="#101216" />
      </mesh>
      <mesh position={[-0.9, 0.93, 1.15]}>
        <boxGeometry args={[0.14, 0.035, 0.035]} />
        <meshStandardMaterial color="#101216" />
      </mesh>
    </group>
  );
}

/**
 * Interior door, built so the pieces overlap (no gaps): a continuous card,
 * the window sill along its top, an armrest sunk into the card, a door pull
 * and a window-switch pad. `side` = +1 for the driver's left door.
 */
function DoorPanel({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 0.8, 0, 0]}>
      {/* Continuous card */}
      <mesh position={[0, 0.5, -0.02]}>
        <boxGeometry args={[0.05, 0.6, 1.9]} />
        <meshStandardMaterial color="#34383f" flatShading />
      </mesh>
      {/* Window sill along the top edge */}
      <mesh position={[0, 0.82, -0.02]}>
        <boxGeometry args={[0.08, 0.1, 1.9]} />
        <meshStandardMaterial color="#1f2227" flatShading />
      </mesh>
      {/* Armrest sunk into the card (overlaps it, so no visible gap) */}
      <mesh position={[-side * 0.05, 0.6, 0.3]}>
        <boxGeometry args={[0.13, 0.1, 0.6]} />
        <meshStandardMaterial color="#2a2e35" flatShading />
      </mesh>
      {/* Door pull */}
      <mesh position={[-side * 0.09, 0.66, 0.12]}>
        <boxGeometry args={[0.04, 0.05, 0.24]} />
        <meshStandardMaterial color="#15171b" flatShading />
      </mesh>
      {/* Window-switch pad on the armrest */}
      <mesh position={[-side * 0.06, 0.66, 0.42]}>
        <boxGeometry args={[0.08, 0.03, 0.14]} />
        <meshStandardMaterial color="#14161a" flatShading />
      </mesh>
    </group>
  );
}

const SPEED_TEXT_COLOR = '#ffb347';
const GEARS: Gear[] = ['R', 'N', 'D'];

/**
 * Diegetic instrument cluster on the binnacle: speed (60 Hz, written
 * imperatively to avoid re-rendering React every tick) and gear (rare, via
 * state). Faces the driver (rotated π about Y).
 */
function InstrumentCluster({ game }: { game: Game }) {
  // Troika Text instance: exposes `.text` and `.sync()` beyond the Mesh type.
  const speedRef = useRef<{ text: string; sync: () => void }>(null);
  const lastSpeed = useRef(-1);
  const [gear, setGear] = useState<Gear>(game.gearbox.gear);

  useEffect(() => {
    const offSpeed = game.events.subscribe('vehicle/stateUpdated', ({ speedKmh }) => {
      const value = Math.round(Math.abs(speedKmh));
      if (value === lastSpeed.current) return;
      lastSpeed.current = value;
      const text = speedRef.current;
      if (text) {
        text.text = String(value);
        text.sync();
      }
    });
    const offGear = game.events.subscribe('vehicle/gearChanged', ({ current }) => setGear(current));
    return () => {
      offSpeed();
      offGear();
    };
  }, [game]);

  return (
    <group position={[0.3, 0.97, 0.575]} rotation-y={Math.PI}>
      {/* Small, minimalist readout above the wheel: the R/N/D row with only the
          active gear lit (the others dimmed), and the speed below. */}
      <mesh>
        <planeGeometry args={[0.16, 0.1]} />
        <meshBasicMaterial color="#0c0d10" />
      </mesh>
      {GEARS.map((g, i) => (
        <Text
          key={g}
          position={[(i - 1) * 0.045, 0.03, 0.004]}
          fontSize={0.024}
          color={g === gear ? '#6cb6ff' : '#363d49'}
          anchorX="center"
          anchorY="middle"
        >
          {g}
        </Text>
      ))}
      <Text ref={speedRef as never} position={[0, -0.016, 0.004]} fontSize={0.048} color={SPEED_TEXT_COLOR} anchorX="center" anchorY="middle">
        0
      </Text>
    </group>
  );
}
