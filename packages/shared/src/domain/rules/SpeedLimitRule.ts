import type { Infraction } from '../infractions/Infraction';
import type { Rule } from './Rule';
import type { VehicleSnapshot } from './VehicleSnapshot';

/** Resolves the speed limit (km/h) that applies to a given snapshot. */
export type SpeedLimitProvider = (snapshot: VehicleSnapshot) => number;

/**
 * Continuous speed-limit rule. The applicable limit is resolved per tick (from
 * the map's speed zones via the provider). It commits one infraction when the
 * speed first exceeds the current limit and then stays silent until either the
 * speed drops back under the limit or a stricter zone lowers it — so holding 80
 * in a 50 zone is a single infraction, but crossing from that 50 zone into a 30
 * zone (still over) commits a fresh one. Uses |speed| so reversing too fast
 * counts too.
 */
export class SpeedLimitRule implements Rule {
  /** Limit (km/h) currently being violated, or null when within the limit. */
  private violatingLimit: number | null = null;

  constructor(private readonly limitFor: SpeedLimitProvider) {}

  evaluate(snapshot: VehicleSnapshot): Infraction | null {
    const speedKmh = Math.abs(snapshot.speedKmh);
    const limitKmh = this.limitFor(snapshot);

    if (speedKmh <= limitKmh) {
      this.violatingLimit = null;
      return null;
    }

    // Over the limit: fire on first crossing or when entering a stricter zone.
    const isNew = this.violatingLimit === null || limitKmh < this.violatingLimit;
    this.violatingLimit = limitKmh;
    return isNew ? { type: 'speeding', speedKmh, limitKmh } : null;
  }
}
