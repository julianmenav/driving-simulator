import { describe, expect, it } from 'vitest';
import { SpeedLimitRule } from './SpeedLimitRule';

const createRule = () => new SpeedLimitRule(50);

describe('SpeedLimitRule', () => {
  it('does not fire under the limit', () => {
    expect(createRule().evaluate({ speedKmh: 40 })).toBeNull();
  });

  it('fires once when crossing above the limit', () => {
    const rule = createRule();
    const infraction = rule.evaluate({ speedKmh: 60 });
    expect(infraction).toEqual({ type: 'speeding', speedKmh: 60, limitKmh: 50 });
  });

  it('stays silent while still over the limit (one infraction, not one per tick)', () => {
    const rule = createRule();
    rule.evaluate({ speedKmh: 60 });
    expect(rule.evaluate({ speedKmh: 70 })).toBeNull();
    expect(rule.evaluate({ speedKmh: 80 })).toBeNull();
  });

  it('fires again after dropping below the limit and exceeding it once more', () => {
    const rule = createRule();
    expect(rule.evaluate({ speedKmh: 60 })).not.toBeNull();
    expect(rule.evaluate({ speedKmh: 40 })).toBeNull();
    expect(rule.evaluate({ speedKmh: 60 })).not.toBeNull();
  });

  it('counts reversing too fast (negative speed)', () => {
    const rule = createRule();
    const infraction = rule.evaluate({ speedKmh: -60 });
    expect(infraction).toEqual({ type: 'speeding', speedKmh: 60, limitKmh: 50 });
  });
});
