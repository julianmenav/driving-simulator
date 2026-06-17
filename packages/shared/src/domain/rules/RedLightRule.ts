import type { Infraction } from '../infractions/Infraction';
import type { TrafficLightSpec } from '../map/MapManifest';
import type { TrafficColor } from '../traffic/TrafficSignals';
import type { Rule } from './Rule';
import type { VehicleSnapshot } from './VehicleSnapshot';

/**
 * Commits a 'red-light' infraction when the vehicle crosses a governed stop
 * line while that light is red. It tracks the previous position and fires on
 * the tick the stop line is crossed (prev side → far side), within the light's
 * lane band and direction of travel.
 */
export class RedLightRule implements Rule {
  private last: { x: number; z: number } | null = null;

  constructor(
    private readonly lights: TrafficLightSpec[],
    private readonly colorOf: (id: string) => TrafficColor,
  ) {}

  evaluate(snapshot: VehicleSnapshot): Infraction | null {
    const cur = snapshot.position;
    const prev = this.last;
    this.last = { x: cur.x, z: cur.z };
    if (!prev) return null;

    for (const light of this.lights) {
      const along = light.axis === 'z' ? cur.z : cur.x;
      const alongPrev = light.axis === 'z' ? prev.z : prev.x;
      const lateral = light.axis === 'z' ? cur.x : cur.z;
      if (lateral < light.laneMin || lateral > light.laneMax) continue;

      const sidePrev = (alongPrev - light.stopCoord) * light.travelSign;
      const sideCur = (along - light.stopCoord) * light.travelSign;
      if (sidePrev < 0 && sideCur >= 0 && this.colorOf(light.id) === 'red') {
        return { type: 'red-light', speedKmh: Math.abs(snapshot.speedKmh) };
      }
    }
    return null;
  }
}
