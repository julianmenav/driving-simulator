import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';

export interface Game {
  readonly events: GameEventBus;
}

/**
 * Raíz de composición del juego. Aquí se irán cableando los puertos con
 * sus adaptadores de infraestructura (físicas, input, persistencia…).
 */
export function createGame(): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  return { events };
}
