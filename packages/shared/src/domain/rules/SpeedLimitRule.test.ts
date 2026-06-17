import { describe, expect, it } from 'vitest';
import { SpeedLimitRule } from './SpeedLimitRule';
import type { VehicleSnapshot } from './VehicleSnapshot';

const at = (speedKmh: number): VehicleSnapshot => ({ speedKmh, position: { x: 0, z: 0 } });

/** Rule with a fixed 50 km/h limit. */
const fixed50 = () => new SpeedLimitRule(() => 50);

describe('SpeedLimitRule', () => {
  it('does not fire under the limit', () => {
    expect(fixed50().evaluate(at(40))).toBeNull();
  });

  it('fires once when crossing above the limit', () => {
    const infraction = fixed50().evaluate(at(60));
    expect(infraction).toEqual({ type: 'speeding', speedKmh: 60, limitKmh: 50 });
  });

  it('stays silent while still over the limit (one infraction, not one per tick)', () => {
    const rule = fixed50();
    rule.evaluate(at(60));
    expect(rule.evaluate(at(70))).toBeNull();
    expect(rule.evaluate(at(80))).toBeNull();
  });

  it('fires again after dropping below the limit and exceeding it once more', () => {
    const rule = fixed50();
    expect(rule.evaluate(at(60))).not.toBeNull();
    expect(rule.evaluate(at(40))).toBeNull();
    expect(rule.evaluate(at(60))).not.toBeNull();
  });

  it('counts reversing too fast (negative speed)', () => {
    const infraction = fixed50().evaluate(at(-60));
    expect(infraction).toEqual({ type: 'speeding', speedKmh: 60, limitKmh: 50 });
  });

  it('fires when the limit drops below the current speed (entering a stricter zone)', () => {
    let limit = 50;
    const rule = new SpeedLimitRule(() => limit);
    expect(rule.evaluate(at(45))).toBeNull(); // under 50
    limit = 30; // drove into a 30 zone, still at 45
    expect(rule.evaluate(at(45))).toEqual({ type: 'speeding', speedKmh: 45, limitKmh: 30 });
  });

  it('re-fires when already speeding and a stricter zone lowers the limit', () => {
    let limit = 50;
    const rule = new SpeedLimitRule(() => limit);
    expect(rule.evaluate(at(70))).toEqual({ type: 'speeding', speedKmh: 70, limitKmh: 50 });
    expect(rule.evaluate(at(70))).toBeNull(); // still in the 50 zone, no spam
    limit = 30; // crossed into a 30 zone, still at 70
    expect(rule.evaluate(at(70))).toEqual({ type: 'speeding', speedKmh: 70, limitKmh: 30 });
    expect(rule.evaluate(at(70))).toBeNull(); // settled in the 30 zone
  });
});
