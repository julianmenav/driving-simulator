import { EventBus } from '@domain/events/EventBus';
import type { GameEventBus, GameEvents } from '@domain/events/GameEvents';
import type { MapManifest } from '@domain/map/MapManifest';
import { resolveSpeedLimit } from '@domain/map/resolveSpeedLimit';
import { InfractionMonitor } from '@domain/rules/InfractionMonitor';
import { RedLightRule } from '@domain/rules/RedLightRule';
import { SpeedLimitRule } from '@domain/rules/SpeedLimitRule';
import { RaceTracker } from '@domain/race/RaceTracker';
import { buildRoadGraph, type RoadGraph } from '@domain/traffic/RoadGraph';
import { TrafficSignals } from '@domain/traffic/TrafficSignals';
import { AutomaticGearbox } from '@domain/vehicle/Gearbox';
import { DEFAULT_VEHICLE_SPEC, type VehicleSpec } from '@domain/vehicle/VehicleSpec';
import { NetworkBridge } from './NetworkBridge';
import { PracticeMode } from './PracticeMode';
import type { ControlsPort } from './ports/ControlsPort';
import type { NetworkPort } from './ports/NetworkPort';
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
  /** Starting-grid slot (0 = pole). Offsets the spawn so multiplayer cars don't
   *  overlap at the start line; single-player is always 0. */
  readonly spawnIndex: number;
  /** Navigable lane graph derived from the map, used by the NPC traffic. */
  readonly roadGraph: RoadGraph;
  /** Time-trial tracker (laps/checkpoints/finish) on circuit maps; null otherwise. */
  readonly race: RaceTracker | null;
  /** Tears down anything with a lifecycle (the network bridge). Single-player
   *  is a no-op; call it when the game is unmounted. */
  readonly dispose: () => void;
}

export interface GameDependencies {
  controls: ControlsPort;
  map: MapManifest;
  /** Defaults keep existing callers (and headless tests) working unchanged. */
  vehicleSpec?: VehicleSpec;
  mode?: GameModeId;
  laps?: number;
  /** Multiplayer transport. Omitted in single-player, so nothing is wired. */
  network?: NetworkPort;
  /** Starting-grid slot for this player (multiplayer); defaults to pole. */
  spawnIndex?: number;
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
  network,
  spawnIndex = 0,
}: GameDependencies): Game {
  const events: GameEventBus = new EventBus<GameEvents>();
  const gearbox = new AutomaticGearbox(vehicleSpec, events);
  const signals = new TrafficSignals(events, map.trafficLights);
  const speedRule = new SpeedLimitRule((s) => resolveSpeedLimit(map, s.position.x, s.position.z));
  const redLightRule = new RedLightRule(map.trafficLights, (id) => signals.colorOf(id));
  const monitor = new InfractionMonitor(events, [speedRule, redLightRule]);
  const practiceMode = new PracticeMode(events);
  const roadGraph = buildRoadGraph(map.roads);

  // Time-trial: on a circuit map, track laps/checkpoints/finish (advanced by
  // PlayerVehicle each physics step). Absent on the city → no race HUD/logic.
  const race = map.circuit && map.isCircuit && laps >= 1 ? new RaceTracker(events, map.circuit, laps) : null;

  // Multiplayer: bridge the bus to the transport (throttled local pose out,
  // remote poses in). Absent in single-player, so the bus carries no net/* events.
  const bridge = network ? new NetworkBridge(events, network) : null;
  bridge?.start();

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
    spawnIndex,
    roadGraph,
    race,
    dispose: () => bridge?.dispose(),
  };
}
