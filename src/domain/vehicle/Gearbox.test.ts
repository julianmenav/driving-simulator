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
  it('arranca en punto muerto', () => {
    expect(createGearbox().gearbox.gear).toBe('N');
  });

  it('sube N → D y publica el cambio', () => {
    const { gearbox, events } = createGearbox();
    const handler = vi.fn();
    events.subscribe('vehicle/gearChanged', handler);

    expect(gearbox.shift('up', 0)).toBe(true);
    expect(gearbox.gear).toBe('D');
    expect(handler).toHaveBeenCalledExactlyOnceWith({ previous: 'N', current: 'D' });
  });

  it('baja N → R parado', () => {
    const { gearbox } = createGearbox();
    expect(gearbox.shift('down', 0)).toBe(true);
    expect(gearbox.gear).toBe('R');
  });

  it('no pasa de los extremos de la palanca', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);
    expect(gearbox.shift('up', 0)).toBe(false);
    expect(gearbox.gear).toBe('D');
  });

  it('rechaza engranar R yendo hacia delante', () => {
    const { gearbox, events } = createGearbox();
    const handler = vi.fn();
    events.subscribe('vehicle/gearChanged', handler);

    expect(gearbox.shift('down', 40)).toBe(false);
    expect(gearbox.gear).toBe('N');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rechaza engranar D yendo marcha atrás', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0); // N → R
    expect(gearbox.shift('up', -20)).toBe(true); // R → N siempre se permite
    expect(gearbox.shift('up', -20)).toBe(false); // N → D yendo hacia atrás, no
    expect(gearbox.gear).toBe('N');
  });

  it('permite engranar D rodando casi parado hacia atrás', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0);
    expect(gearbox.shift('up', -3)).toBe(true);
    expect(gearbox.gear).toBe('N');
  });

  it('en D el acelerador empuja hacia delante y el freno frena', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0.5 }, 30);
    expect(drive.engineForce).toBe(spec.maxEngineForce);
    expect(drive.brakeForce).toBe(spec.maxBrakeForce * 0.5);
  });

  it('a alta velocidad la fuerza queda limitada por la potencia', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 120);
    const expected = spec.maxPowerWatts / (120 / 3.6);
    expect(drive.engineForce).toBeCloseTo(expected, 5);
    expect(drive.engineForce).toBeLessThan(spec.maxEngineForce);
  });

  it('al soltar el acelerador actúa el freno motor', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('up', 0);

    expect(gearbox.computeDrive({ throttle: 0, brake: 0 }, 60).brakeForce).toBe(spec.engineBrakeForce);
    expect(gearbox.computeDrive({ throttle: 1, brake: 0 }, 60).brakeForce).toBe(0);
  });

  it('en R el acelerador empuja hacia atrás con fuerza reducida', () => {
    const { gearbox } = createGearbox();
    gearbox.shift('down', 0);

    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 0);
    expect(drive.engineForce).toBe(-spec.maxEngineForce * spec.reverseForceRatio);
  });

  it('en N el acelerador no tracciona', () => {
    const { gearbox } = createGearbox();
    const drive = gearbox.computeDrive({ throttle: 1, brake: 0 }, 0);
    expect(drive.engineForce).toBe(0);
  });
});
