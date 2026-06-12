import type { GameEventBus } from '@domain/events/GameEvents';
import type { TrafficLightSpec } from '@domain/map/MapManifest';

export type TrafficColor = 'green' | 'amber' | 'red';

/**
 * Phase durations (seconds). The cycle is green → amber → red → green.
 * red = green + amber, so two lights half a cycle apart alternate perfectly
 * (one axis is green/amber exactly while the crossing axis is red).
 */
export const PHASE_SECONDS: Record<TrafficColor, number> = {
  green: 7,
  amber: 2,
  red: 9,
};

const CYCLE_SECONDS = PHASE_SECONDS.green + PHASE_SECONDS.amber + PHASE_SECONDS.red;

/** Colour of a light at a given point in its own cycle (seconds since green). */
function colorAt(t: number): TrafficColor {
  const phase = ((t % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  if (phase < PHASE_SECONDS.green) return 'green';
  if (phase < PHASE_SECONDS.green + PHASE_SECONDS.amber) return 'amber';
  return 'red';
}

/**
 * Time-based traffic light state machine. Driven by `advance(dt)` from the
 * frame loop (no Date.now, so it is deterministic and testable). Each light
 * cycles green → amber → red with a per-light `phaseOffset`, and a colour change
 * publishes `traffic/lightChanged`. The RedLightRule queries `colorOf(id)`.
 */
export class TrafficSignals {
  private elapsed = 0;
  private readonly colors = new Map<string, TrafficColor>();

  constructor(
    private readonly events: GameEventBus,
    private readonly lights: TrafficLightSpec[],
  ) {
    for (const light of lights) {
      this.colors.set(light.id, colorAt(light.phaseOffset));
    }
  }

  advance(dt: number): void {
    this.elapsed += dt;
    for (const light of this.lights) {
      const next = colorAt(this.elapsed + light.phaseOffset);
      if (next !== this.colors.get(light.id)) {
        this.colors.set(light.id, next);
        this.events.publish('traffic/lightChanged', { id: light.id, color: next });
      }
    }
  }

  colorOf(id: string): TrafficColor {
    return this.colors.get(id) ?? 'green';
  }
}
