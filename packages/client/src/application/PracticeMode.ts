import type { Infraction } from '@domain/infractions/Infraction';
import type { GameEventBus } from '@domain/events/GameEvents';
import type { Unsubscribe } from '@domain/events/EventBus';

/**
 * Practice game mode: a policy subscribed to the bus that records committed
 * infractions so the UI can warn about them. Free driving — it never fails the
 * driver (that is ExamMode's job, a future policy on the same bus).
 */
export class PracticeMode {
  private readonly infractions: Infraction[] = [];
  private readonly unsubscribe: Unsubscribe;

  constructor(events: GameEventBus) {
    this.unsubscribe = events.subscribe('infraction/committed', ({ infraction }) => {
      this.infractions.push(infraction);
    });
  }

  get count(): number {
    return this.infractions.length;
  }

  getInfractions(): readonly Infraction[] {
    return this.infractions;
  }

  /** Stops collecting (game-mode change, teardown). */
  dispose(): void {
    this.unsubscribe();
  }
}
