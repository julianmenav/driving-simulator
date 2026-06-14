import { DEFAULT_VEHICLE_SPEC, type VehicleSpec } from './VehicleSpec';

/**
 * A selectable car: presentation metadata + the physical spec the physics
 * layer consumes. This is the car-selection seam — adding a car later is
 * adding an entry here (and optionally a model), with zero plumbing changes.
 */
export interface CarPreset {
  id: string;
  /** End-user-facing name (Spanish, like the rest of the in-game text). */
  name: string;
  description: string;
  spec: VehicleSpec;
}

export const CAR_PRESETS: readonly CarPreset[] = [
  {
    id: 'hatchback',
    name: 'Utilitario',
    description: 'Ágil y equilibrado. El único modelo por ahora.',
    spec: DEFAULT_VEHICLE_SPEC,
  },
];

export const DEFAULT_CAR_ID = CAR_PRESETS[0].id;

export function findCarPreset(id: string): CarPreset {
  return CAR_PRESETS.find((c) => c.id === id) ?? CAR_PRESETS[0];
}
