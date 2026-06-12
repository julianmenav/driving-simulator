import type { Infraction } from '@domain/infractions/Infraction';
import type { Gear } from '@domain/vehicle/Gear';
import type { TrafficColor } from '@domain/traffic/TrafficSignals';
import type { EventBus } from './EventBus';

export type GameMode = 'practice' | 'exam';

/**
 * Name → payload map of every game event.
 *
 * This is the central contract of the design: future features
 * (infractions, NPCs, game modes) integrate by adding entries here and
 * subscribers in application, without touching existing publishers.
 */
export interface GameEvents {
  'game/started': { mode: GameMode };
  'vehicle/gearChanged': { previous: Gear; current: Gear };
  'vehicle/stateUpdated': { speedKmh: number; position: { x: number; z: number } };
  'infraction/committed': { infraction: Infraction };
  'traffic/lightChanged': { id: string; color: TrafficColor };
}

export type GameEventType = keyof GameEvents;
export type GameEventBus = EventBus<GameEvents>;
