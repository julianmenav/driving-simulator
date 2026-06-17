import type { Infraction } from '../infractions/Infraction';
import type { Gear } from '../vehicle/Gear';
import type { TrafficColor } from '../traffic/TrafficSignals';
import type { EventBus } from './EventBus';

export type GameMode = 'practice' | 'exam';

/**
 * Name → payload map of every game event.
 *
 * This is the central contract of the design: future features
 * (infractions, NPCs, game modes) integrate by adding entries here and
 * subscribers in application, without touching existing publishers.
 */
/** Full car pose shared over the network (position + heading + velocity). */
export interface CarTransform {
  position: { x: number; y: number; z: number };
  /** Heading (yaw about Y) in radians, +z = 0. */
  headingRad: number;
  velocity: { x: number; y: number; z: number };
  speedKmh: number;
}

export interface GameEvents {
  'game/started': { mode: GameMode };
  'vehicle/gearChanged': { previous: Gear; current: Gear };
  'vehicle/stateUpdated': { speedKmh: number; position: { x: number; z: number } };
  'infraction/committed': { infraction: Infraction };
  'traffic/lightChanged': { id: string; color: TrafficColor };
  /** The local player's full pose, published every physics tick (the network
   *  bridge throttles it before broadcasting). */
  'net/localTransform': CarTransform;
  /** A remote player joined / left the room. */
  'net/playerJoined': { id: string };
  'net/playerLeft': { id: string };
  /** A remote player's latest pose, fed in from the NetworkPort. */
  'net/remoteTransform': CarTransform & { id: string };
  /** Time-trial countdown tick: 3 · 2 · 1 · 0 (= GO). */
  'race/countdown': { secondsLeft: number };
  /** The countdown finished; racing (and the timer) begins. */
  'race/started': { totalLaps: number };
  /** A checkpoint gate was crossed in order (index 0 = start/finish). */
  'race/checkpointPassed': { index: number; total: number; lap: number };
  /** A lap was completed (crossed the start/finish line). */
  'race/lapCompleted': { lap: number; totalLaps: number; lapMs: number; totalMs: number };
  /** All laps done — carries the final total time. */
  'race/finished': { totalMs: number };
}

export type GameEventType = keyof GameEvents;
export type GameEventBus = EventBus<GameEvents>;
