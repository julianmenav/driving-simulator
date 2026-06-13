import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import type { MapManifest } from '@domain/map/MapManifest';
import { resolveSpeedLimit } from '@domain/map/resolveSpeedLimit';
import { InfractionMonitor } from '@domain/rules/InfractionMonitor';
import { RedLightRule } from '@domain/rules/RedLightRule';
import { SpeedLimitRule } from '@domain/rules/SpeedLimitRule';
import { buildRoadGraph, type RoadGraph } from '@domain/traffic/RoadGraph';
import { TrafficSignals } from '@domain/traffic/TrafficSignals';
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
  readonly signals: TrafficSignals;
  readonly map: MapManifest;
  /** Navigable lane graph derived from the map, used by the NPC traffic. */
  readonly roadGraph: RoadGraph;
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
  const signals = new TrafficSignals(events, map.trafficLights);
  const speedRule = new SpeedLimitRule((s) => resolveSpeedLimit(map, s.position.x, s.position.z));
  const redLightRule = new RedLightRule(map.trafficLights, (id) => signals.colorOf(id));
  const monitor = new InfractionMonitor(events, [speedRule, redLightRule]);
  const practiceMode = new PracticeMode(events);
  const roadGraph = buildRoadGraph(map.roads);
  return { events, controls, gearbox, monitor, practiceMode, signals, map, roadGraph };
}
