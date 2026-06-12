import type { GameEventBus } from '@domain/events/GameEvents';
import type { Unsubscribe } from '@domain/events/EventBus';
import type { Rule } from './Rule';

/**
 * Wires the rules into the event bus: subscribes to the per-tick vehicle state,
 * builds a domain snapshot, runs every rule and publishes `infraction/committed`
 * for each one that fires. This is the "domain evaluates rules → emits events"
 * hop of the game loop; game-mode policies subscribe downstream.
 */
export class InfractionMonitor {
  private readonly unsubscribe: Unsubscribe;

  constructor(events: GameEventBus, rules: Rule[]) {
    this.unsubscribe = events.subscribe('vehicle/stateUpdated', ({ speedKmh }) => {
      const snapshot = { speedKmh };
      for (const rule of rules) {
        const infraction = rule.evaluate(snapshot);
        if (infraction) events.publish('infraction/committed', { infraction });
      }
    });
  }

  /** Stops evaluating rules (game-mode change, teardown). */
  dispose(): void {
    this.unsubscribe();
  }
}
