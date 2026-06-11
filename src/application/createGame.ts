import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import type { ControlsPort } from './ports/ControlsPort';

export interface Game {
  readonly events: GameEventBus;
  readonly controls: ControlsPort;
}

export interface GameDependencies {
  controls: ControlsPort;
}

/**
 * Raíz de composición del juego: recibe los adaptadores (creados en main)
 * ya como puertos. Aquí se irán cableando físicas, persistencia, etc.
 */
export function createGame({ controls }: GameDependencies): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  return { events, controls };
}
