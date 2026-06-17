import { describe, expect, it } from 'vitest';
import { EventBus } from '@domain/events/EventBus';
import type { GameEvents } from '@domain/events/GameEvents';
import type { Infraction } from '@domain/infractions/Infraction';
import { PracticeMode } from './PracticeMode';

const speeding: Infraction = { type: 'speeding', speedKmh: 60, limitKmh: 50 };

const setup = () => {
  const events = new EventBus<GameEvents>();
  return { events, mode: new PracticeMode(events) };
};

describe('PracticeMode', () => {
  it('collects committed infractions', () => {
    const { events, mode } = setup();
    events.publish('infraction/committed', { infraction: speeding });
    events.publish('infraction/committed', { infraction: speeding });
    expect(mode.count).toBe(2);
    expect(mode.getInfractions()).toEqual([speeding, speeding]);
  });

  it('stops collecting after dispose', () => {
    const { events, mode } = setup();
    mode.dispose();
    events.publish('infraction/committed', { infraction: speeding });
    expect(mode.count).toBe(0);
  });
});
