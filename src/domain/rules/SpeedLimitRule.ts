import type { Infraction } from '@domain/infractions/Infraction';
import type { Rule } from './Rule';
import type { VehicleSnapshot } from './VehicleSnapshot';

/**
 * Continuous speed-limit rule. It is edge-triggered: it commits one infraction
 * when the speed first crosses above the limit and then stays silent until the
 * speed drops back under it — so holding 80 in a 50 zone is a single
 * infraction, not one per tick. Uses |speed| so reversing too fast counts too.
 */
export class SpeedLimitRule implements Rule {
  private violating = false;

  constructor(private readonly limitKmh: number) {}

  evaluate(snapshot: VehicleSnapshot): Infraction | null {
    const speedKmh = Math.abs(snapshot.speedKmh);
    const over = speedKmh > this.limitKmh;

    if (over && !this.violating) {
      this.violating = true;
      return { type: 'speeding', speedKmh, limitKmh: this.limitKmh };
    }
    if (!over) this.violating = false;
    return null;
  }
}
