import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@domain/events/EventBus';
import type { GameEvents } from '@domain/events/GameEvents';
import { InfractionMonitor } from './InfractionMonitor';
import { SpeedLimitRule } from './SpeedLimitRule';

const setup = () => {
  const events = new EventBus<GameEvents>();
  const monitor = new InfractionMonitor(events, [new SpeedLimitRule(50)]);
  const handler = vi.fn();
  events.subscribe('infraction/committed', handler);
  return { events, monitor, handler };
};

describe('InfractionMonitor', () => {
  it('publishes infraction/committed when state exceeds the limit', () => {
    const { events, handler } = setup();
    events.publish('vehicle/stateUpdated', { speedKmh: 60 });
    expect(handler).toHaveBeenCalledExactlyOnceWith({
      infraction: { type: 'speeding', speedKmh: 60, limitKmh: 50 },
    });
  });

  it('does not publish while under the limit', () => {
    const { events, handler } = setup();
    events.publish('vehicle/stateUpdated', { speedKmh: 30 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops evaluating after dispose', () => {
    const { events, monitor, handler } = setup();
    monitor.dispose();
    events.publish('vehicle/stateUpdated', { speedKmh: 60 });
    expect(handler).not.toHaveBeenCalled();
  });
});
