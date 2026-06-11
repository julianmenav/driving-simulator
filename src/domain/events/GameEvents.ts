import type { Gear } from '@domain/vehicle/Gear';
import type { EventBus } from './EventBus';

export type GameMode = 'practice' | 'exam';

/**
 * Mapa nombre → payload de todos los eventos del juego.
 *
 * Es el contrato central del diseño: las features futuras (infracciones,
 * NPCs, modos de juego) se integran añadiendo entradas aquí y suscriptores
 * en application, sin tocar a los emisores existentes.
 */
export interface GameEvents {
  'game/started': { mode: GameMode };
  'vehicle/gearChanged': { previous: Gear; current: Gear };
  'vehicle/stateUpdated': { speedKmh: number };
}

export type GameEventType = keyof GameEvents;
export type GameEventBus = EventBus<GameEvents>;
