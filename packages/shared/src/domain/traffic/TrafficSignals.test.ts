import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@domain/events/EventBus';
import type { GameEvents } from '@domain/events/GameEvents';
import type { TrafficLightSpec } from '@domain/map/MapManifest';
import { PHASE_SECONDS, TrafficSignals } from './TrafficSignals';

const light = (overrides: Partial<TrafficLightSpec> = {}): TrafficLightSpec => ({
  id: 'l1',
  x: 0,
  z: 0,
  axis: 'z',
  stopCoord: 0,
  travelSign: 1,
  laneMin: -4,
  laneMax: 4,
  phaseOffset: 0,
  ...overrides,
});

const setup = (lights: TrafficLightSpec[]) => {
  const events = new EventBus<GameEvents>();
  return { events, signals: new TrafficSignals(events, lights) };
};

describe('TrafficSignals', () => {
  it('starts green and cycles green -> amber -> red', () => {
    const { signals } = setup([light()]);
    expect(signals.colorOf('l1')).toBe('green');

    signals.advance(PHASE_SECONDS.green + 0.1);
    expect(signals.colorOf('l1')).toBe('amber');

    signals.advance(PHASE_SECONDS.amber);
    expect(signals.colorOf('l1')).toBe('red');
  });

  it('publishes traffic/lightChanged only on a colour change', () => {
    const { events, signals } = setup([light()]);
    const handler = vi.fn();
    events.subscribe('traffic/lightChanged', handler);

    signals.advance(1); // still green
    expect(handler).not.toHaveBeenCalled();

    signals.advance(PHASE_SECONDS.green); // now amber
    expect(handler).toHaveBeenCalledExactlyOnceWith({ id: 'l1', color: 'amber' });
  });

  it('honours per-light phaseOffset', () => {
    const { signals } = setup([light({ phaseOffset: PHASE_SECONDS.green })]);
    expect(signals.colorOf('l1')).toBe('amber');
  });

  it('red lasts exactly green + amber, so half-cycle offsets alternate cleanly', () => {
    expect(PHASE_SECONDS.red).toBe(PHASE_SECONDS.green + PHASE_SECONDS.amber);

    // Two lights half a cycle apart: whenever one is red the other is not.
    const half = PHASE_SECONDS.green + PHASE_SECONDS.amber;
    const { signals } = setup([light({ id: 'ns' }), light({ id: 'ew', phaseOffset: half })]);
    for (let t = 0; t < 36; t += 0.5) {
      const ns = signals.colorOf('ns');
      const ew = signals.colorOf('ew');
      expect(ns === 'red' ? ew !== 'red' : ew === 'red').toBe(true);
      signals.advance(0.5);
    }
  });
});
