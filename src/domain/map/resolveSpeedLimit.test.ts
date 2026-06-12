import { describe, expect, it } from 'vitest';
import type { MapManifest } from './MapManifest';
import { resolveSpeedLimit } from './resolveSpeedLimit';

const baseMap = (speedZones: MapManifest['speedZones']): MapManifest => ({
  name: 'test',
  spawn: { x: 0, z: 0, headingRad: 0 },
  terrain: { components: [] },
  defaultLimitKmh: 50,
  roads: [],
  speedZones,
  buildings: [],
  props: [],
  crossings: [],
  trafficLights: [],
});

describe('resolveSpeedLimit', () => {
  it('returns the default limit outside every zone', () => {
    const map = baseMap([{ x: 0, z: 0, width: 10, depth: 10, limitKmh: 30 }]);
    expect(resolveSpeedLimit(map, 100, 100)).toBe(50);
  });

  it('returns the zone limit inside a zone', () => {
    const map = baseMap([{ x: 0, z: 0, width: 10, depth: 10, limitKmh: 30 }]);
    expect(resolveSpeedLimit(map, 4, -4)).toBe(30);
  });

  it('respects the zone boundary (inclusive edge)', () => {
    const map = baseMap([{ x: 0, z: 0, width: 10, depth: 10, limitKmh: 30 }]);
    expect(resolveSpeedLimit(map, 5, 0)).toBe(30);
    expect(resolveSpeedLimit(map, 5.01, 0)).toBe(50);
  });

  it('lets a later (inner) zone override an earlier one', () => {
    const map = baseMap([
      { x: 0, z: 0, width: 20, depth: 20, limitKmh: 30 },
      { x: 0, z: 0, width: 6, depth: 6, limitKmh: 10 },
    ]);
    expect(resolveSpeedLimit(map, 0, 0)).toBe(10);
    expect(resolveSpeedLimit(map, 8, 0)).toBe(30);
  });
});
