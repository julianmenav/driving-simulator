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
import { DEFAULT_VEHICLE_SPEC, type VehicleSpec } from '@domain/vehicle/VehicleSpec';
import { PracticeMode } from './PracticeMode';
import type { ControlsPort } from './ports/ControlsPort';
import type { GameModeId } from './session';

export interface Game {
  readonly events: GameEventBus;
  readonly controls: ControlsPort;
  readonly gearbox: AutomaticGearbox;
  readonly monitor: InfractionMonitor;
  readonly practiceMode: PracticeMode;
  readonly signals: TrafficSignals;
  readonly map: MapManifest;
  /** Physical spec of the player's chosen car (consumed by the physics layer). */
  readonly vehicleSpec: VehicleSpec;
  /** Selected game mode and lap count (the race core reads these in step 3). */
  readonly mode: GameModeId;
  readonly laps: number;
  /** Navigable lane graph derived from the map, used by the NPC traffic. */
  readonly roadGraph: RoadGraph;
}

export interface GameDependencies {
  controls: ControlsPort;
  map: MapManifest;
  /** Defaults keep existing callers (and headless tests) working unchanged. */
  vehicleSpec?: VehicleSpec;
  mode?: GameModeId;
  laps?: number;
}

/**
 * Game composition root: receives the adapters (created in main) already
 * as ports, plus the loaded map and the player's session choices. Physics,
 * persistence, etc. will be wired here over time.
 */
export function createGame({
  controls,
  map,
  vehicleSpec = DEFAULT_VEHICLE_SPEC,
  mode = 'free-roam',
  laps = 1,
}: GameDependencies): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  const gearbox = new AutomaticGearbox(vehicleSpec, events);
  const signals = new TrafficSignals(events, map.trafficLights);
  const speedRule = new SpeedLimitRule((s) => resolveSpeedLimit(map, s.position.x, s.position.z));
  const redLightRule = new RedLightRule(map.trafficLights, (id) => signals.colorOf(id));
  const monitor = new InfractionMonitor(events, [speedRule, redLightRule]);
  const practiceMode = new PracticeMode(events);
  const roadGraph = buildRoadGraph(map.roads);
  return {
    events,
    controls,
    gearbox,
    monitor,
    practiceMode,
    signals,
    map,
    vehicleSpec,
    mode,
    laps,
    roadGraph,
  };
}
