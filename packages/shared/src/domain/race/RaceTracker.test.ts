import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { CircuitSpec } from '../map/MapManifest';
import { buildCheckpoints } from './checkpoints';
import { RaceTracker } from './RaceTracker';

const circuit: CircuitSpec = {
  controlPoints: [
    { x: -50, z: -50 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
    { x: -50, z: 50 },
  ],
  width: 10,
};

const setup = (laps = 1) => {
  const events = new EventBus<GameEvents>();
  return { events, tracker: new RaceTracker(events, circuit, laps) };
};

/** Drive a clean crossing of a gate: a point just behind then just ahead of its plane. */
const gates = buildCheckpoints(circuit);
const cross = (tracker: RaceTracker, i: number) => {
  const g = gates[i];
  tracker.update(0.1, { x: g.x - g.tx * 4, z: g.z - g.tz * 4 });
  tracker.update(0.1, { x: g.x + g.tx * 4, z: g.z + g.tz * 4 });
};
const goToStart = (tracker: RaceTracker) => tracker.update(3.5, { x: gates[0].x, z: gates[0].z });

describe('RaceTracker', () => {
  it('runs a 3·2·1·GO countdown then starts racing', () => {
    const { events, tracker } = setup();
    const counts: number[] = [];
    const started = vi.fn();
    events.subscribe('race/countdown', (e) => counts.push(e.secondsLeft));
    events.subscribe('race/started', started);

    expect(tracker.controlsLocked).toBe(true);
    for (let i = 0; i < 10; i++) tracker.update(0.4, { x: 0, z: 0 }); // 4s > 3s countdown

    expect(counts[0]).toBe(3);
    expect(counts).toContain(2);
    expect(counts).toContain(1);
    expect(counts.at(-1)).toBe(0); // GO
    expect(started).toHaveBeenCalledOnce();
    expect(tracker.controlsLocked).toBe(false);
    expect(tracker.phase).toBe('racing');
  });

  it('counts a full lap in order and finishes after the last lap', () => {
    const { events, tracker } = setup(1);
    const laps = vi.fn();
    const finished = vi.fn();
    let checkpoints = 0;
    events.subscribe('race/checkpointPassed', () => checkpoints++);
    events.subscribe('race/lapCompleted', laps);
    events.subscribe('race/finished', finished);

    goToStart(tracker);
    for (let i = 1; i < gates.length; i++) cross(tracker, i); // gates 1..N-1
    cross(tracker, 0); // back across start/finish → lap done

    expect(checkpoints).toBe(gates.length); // N-1 intermediate + the start/finish
    expect(laps).toHaveBeenCalledWith({ lap: 1, totalLaps: 1, lapMs: expect.any(Number), totalMs: expect.any(Number) });
    expect(finished).toHaveBeenCalledOnce();
    expect(tracker.phase).toBe('finished');
  });

  it('requires two loops when laps = 2', () => {
    const { events, tracker } = setup(2);
    const finished = vi.fn();
    events.subscribe('race/finished', finished);

    goToStart(tracker);
    for (let lap = 0; lap < 2; lap++) {
      for (let i = 1; i < gates.length; i++) cross(tracker, i);
      cross(tracker, 0);
    }
    expect(finished).toHaveBeenCalledOnce();
    expect(tracker.lap).toBe(2);
  });

  it('only counts a proper crossing of the expected gate (no cutting, no double-count)', () => {
    const { events, tracker } = setup(1);
    const passed: number[] = [];
    events.subscribe('race/checkpointPassed', (e) => passed.push(e.index));

    goToStart(tracker);
    tracker.update(0.1, { x: 999, z: 999 }); // teleport off the track → nothing counts
    expect(passed).toEqual([]);

    cross(tracker, 1); // the actual expected gate → counts once
    expect(passed).toEqual([1]);

    cross(tracker, 1); // expected is now 2, so re-crossing gate 1 does nothing
    expect(passed).toEqual([1]);
    expect(tracker.phase).toBe('racing');
  });
});
