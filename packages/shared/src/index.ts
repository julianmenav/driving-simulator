/**
 * Public API of the shared pure-domain package. This is the code that runs on
 * BOTH the client and the server (it imports zero Three.js/Rapier). The client
 * keeps its `@domain/*` path aliases, so this barrel exists mainly for the
 * server's `@driving-sim/shared` import.
 *
 * Note: `DriveCommand` is intentionally absent — it is defined in two modules
 * (NpcDriver, Gearbox), so `export *` omits the ambiguous name. Import it from
 * its module directly if ever needed.
 */
export * from './domain/events/EventBus';
export * from './domain/events/GameEvents';
export * from './domain/infractions/Infraction';
export * from './domain/map/circuit';
export * from './domain/map/elevation';
export * from './domain/map/MapManifest';
export * from './domain/map/resolveSpeedLimit';
export * from './domain/rules/InfractionMonitor';
export * from './domain/rules/RedLightRule';
export * from './domain/rules/Rule';
export * from './domain/race/checkpoints';
export * from './domain/race/RaceTracker';
export * from './domain/rules/SpeedLimitRule';
export * from './domain/rules/VehicleSnapshot';
export * from './domain/traffic/NpcDriver';
export * from './domain/traffic/RoadGraph';
export * from './domain/traffic/TrafficSignals';
export * from './domain/vehicle/carPresets';
export * from './domain/vehicle/Gear';
export * from './domain/vehicle/Gearbox';
export * from './domain/vehicle/VehicleSpec';

// `DriveCommand` is exported by both NpcDriver and Gearbox; an explicit
// re-export disambiguates the `export *` collision. The Gearbox one (the
// engine command) is the canonical public type.
export type { DriveCommand } from './domain/vehicle/Gearbox';
