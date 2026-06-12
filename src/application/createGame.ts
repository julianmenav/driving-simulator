import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import { InfractionMonitor } from '@domain/rules/InfractionMonitor';
import { SpeedLimitRule } from '@domain/rules/SpeedLimitRule';
import { AutomaticGearbox } from '@domain/vehicle/Gearbox';
import { DEFAULT_VEHICLE_SPEC } from '@domain/vehicle/VehicleSpec';
import { PracticeMode } from './PracticeMode';
import type { ControlsPort } from './ports/ControlsPort';

/** Global speed limit (km/h). Map-driven, per-zone limits come with maps. */
const SPEED_LIMIT_KMH = 50;

export interface Game {
  readonly events: GameEventBus;
  readonly controls: ControlsPort;
  readonly gearbox: AutomaticGearbox;
  readonly monitor: InfractionMonitor;
  readonly practiceMode: PracticeMode;
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
  const monitor = new InfractionMonitor(events, [new SpeedLimitRule(SPEED_LIMIT_KMH)]);
  const practiceMode = new PracticeMode(events);
  return { events, controls, gearbox, monitor, practiceMode };
}
