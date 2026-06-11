import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import { AutomaticGearbox } from '@domain/vehicle/Gearbox';
import { DEFAULT_VEHICLE_SPEC } from '@domain/vehicle/VehicleSpec';
import type { ControlsPort } from './ports/ControlsPort';

export interface Game {
  readonly events: GameEventBus;
  readonly controls: ControlsPort;
  readonly gearbox: AutomaticGearbox;
}

export interface GameDependencies {
  controls: ControlsPort;
}

/**
 * Game composition root: receives the adapters (created in main) already
 * as ports. Physics, persistence, etc. will be wired here over time.
 */
export function createGame({ controls }: GameDependencies): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  const gearbox = new AutomaticGearbox(DEFAULT_VEHICLE_SPEC, events);
  return { events, controls, gearbox };
}
