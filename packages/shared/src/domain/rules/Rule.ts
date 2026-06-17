import type { Infraction } from '../infractions/Infraction';
import type { VehicleSnapshot } from './VehicleSnapshot';

/**
 * A driving rule evaluated every tick. Returns an infraction the moment one is
 * *newly* committed, otherwise null. Continuous rules (e.g. speeding) keep
 * their own state to fire only on the edge, not on every tick over the limit.
 */
export interface Rule {
  evaluate(snapshot: VehicleSnapshot): Infraction | null;
}
