import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@domain/events/EventBus';
import type { GameEvents } from '@domain/events/GameEvents';
import { DEFAULT_VEHICLE_SPEC as spec } from './VehicleSpec';
import { AutomaticGearbox } from './Gearbox';

const createGearbox = () => {
  const events = new EventBus<GameEvents>();
  return { gearbox: new AutomaticGearbox(spec, events), events };
};

describe('AutomaticGearbox', () => {
  it('starts in neutral', () => {
    expect(createGearbox().gearbox.gear).toBe('N');
  });

  it('shifts N -> D and publishes the change', () => {
    const { gearbox, events } = createGearbox();
    const handler = vi.fn();
    events.subscribe('vehicle/gearChanged', handler);

    expect(gearbox.shift('up', 0)).toBe(true);
    expect(gearbox.gear).toBe('D');
    expect(handler).toHaveBeenCalledExactlyOnceWith({ previous: 'N', current: 'D' });
  });

  it('shifts N -> R while stopped', () => {
    const { gearbox } = createGearbox();
    expect(gearbox.shift('down', 0)).toBe(true);
    expect(gearbox.gear).toBe('R');
  });

  it('does not move past the ends of the lever', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);
    expect(gearbox.shift('up', 0)).toBe(false);
    expect(gearbox.gear).toBe('D');
  });

  it('refuses to engage R while moving forward', () => {
    const { gearbox, events } = createGearbox();
    const handler = vi.fn();
    events.subscribe('vehicle/gearChanged', handler);

    expect(gearbox.shift('down', 40)).toBe(false);
    expect(gearbox.gear).toBe('N');
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses to engage D while moving in reverse', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0); // N -> R
    expect(gearbox.shift('up', -20)).toBe(true); // R -> N is always allowed
    expect(gearbox.shift('up', -20)).toBe(false); // N -> D while moving backward, no
    expect(gearbox.gear).toBe('N');
  });

  it('allows engaging D while rolling backward almost stopped', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0);
    expect(gearbox.shift('up', -3)).toBe(true);
    expect(gearbox.gear).toBe('N');
  });

  it('in D the throttle pushes forward and the brake brakes', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0.5 }, 30);
    expect(drive.engineForce).toBe(spec.maxEngineForce);
    expect(drive.brakeForce).toBe(spec.maxBrakeForce * 0.5);
  });

  it('at high speed the force is limited by power', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 120);
    const expected = spec.maxPowerWatts / (120 / 3.6);
    expect(drive.engineForce).toBeCloseTo(expected, 5);
    expect(drive.engineForce).toBeLessThan(spec.maxEngineForce);
  });

  it('releasing the throttle engages engine braking', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    expect(gearbox.computeDrive({ throttle: 0, brake: 0 }, 60).brakeForce).toBe(spec.engineBrakeForce);
    expect(gearbox.computeDrive({ throttle: 1, brake: 0 }, 60).brakeForce).toBe(0);
  });

  it('in R the throttle pushes backward with reduced force', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 0);
    expect(drive.engineForce).toBe(-spec.maxEngineForce * spec.reverseForceRatio);
  });

  it('in N the throttle provides no traction', () => {
    const { gearbox } = createGearbox();
    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 0);
    expect(drive.engineForce).toBe(0);
  });
});
