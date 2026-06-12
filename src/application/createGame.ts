import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import type { MapManifest } from '@domain/map/MapManifest';
import { resolveSpeedLimit } from '@domain/map/resolveSpeedLimit';
import { InfractionMonitor } from '@domain/rules/InfractionMonitor';
import { SpeedLimitRule } from '@domain/rules/SpeedLimitRule';
import { AutomaticGearbox } from '@domain/vehicle/Gearbox';
import { DEFAULT_VEHICLE_SPEC } from '@domain/vehicle/VehicleSpec';
import { PracticeMode } from './PracticeMode';
import type { ControlsPort } from './ports/ControlsPort';

export interface Game {
  readonly events: GameEventBus;
  readonly controls: ControlsPort;
  readonly gearbox: AutomaticGearbox;
  readonly monitor: InfractionMonitor;
  readonly practiceMode: PracticeMode;
  readonly map: MapManifest;
}

export interface GameDependencies {
  controls: ControlsPort;
  map: MapManifest;
}

/**
 * Game composition root: receives the adapters (created in main) already
 * as ports, plus the loaded map. Physics, persistence, etc. will be wired
 * here over time.
 */
export function createGame({ controls, map }: GameDependencies): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  const gearbox = new AutomaticGearbox(DEFAULT_VEHICLE_SPEC, events);
  const speedRule = new SpeedLimitRule((s) => resolveSpeedLimit(map, s.position.x, s.position.z));
  const monitor = new InfractionMonitor(events, [speedRule]);
  const practiceMode = new PracticeMode(events);
  return { events, controls, gearbox, monitor, practiceMode, map };
}
