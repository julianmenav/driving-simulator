import { describe, expect, it } from 'vitest';
import type { TrafficLightSpec } from '@domain/map/MapManifest';
import type { TrafficColor } from '@domain/traffic/TrafficSignals';
import { RedLightRule } from './RedLightRule';
import type { VehicleSnapshot } from './VehicleSnapshot';

const at = (x: number, z: number, speedKmh = 40): VehicleSnapshot => ({ speedKmh, position: { x, z } });

// Northbound light on a lane around x=0, stop line at z=0.
const light: TrafficLightSpec = {
  id: 'l1',
  x: 0,
  z: 0,
  axis: 'z',
  stopCoord: 0,
  travelSign: 1,
  laneMin: -4,
  laneMax: 4,
  phaseOffset: 0,
};

const rule = (color: TrafficColor) => new RedLightRule([light], () => color);

describe('RedLightRule', () => {
  it('fires when crossing the stop line on red', () => {
    const r = rule('red');
    expect(r.evaluate(at(0, -2))).toBeNull(); // first tick: no previous position
    expect(r.evaluate(at(0, 1))).toEqual({ type: 'red-light', speedKmh: 40 });
  });

  it('does not fire when crossing on green', () => {
    const r = rule('green');
    r.evaluate(at(0, -2));
    expect(r.evaluate(at(0, 1))).toBeNull();
  });

  it('does not fire while approaching but not yet across', () => {
    const r = rule('red');
    r.evaluate(at(0, -5));
    expect(r.evaluate(at(0, -2))).toBeNull();
  });

  it('ignores vehicles outside the governed lane', () => {
    const r = rule('red');
    r.evaluate(at(20, -2));
    expect(r.evaluate(at(20, 1))).toBeNull();
  });
});
