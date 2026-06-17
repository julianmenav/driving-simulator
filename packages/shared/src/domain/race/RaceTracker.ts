import type { GameEventBus } from '../events/GameEvents';
import type { CircuitSpec } from '../map/MapManifest';
import { buildCheckpoints, type Checkpoint } from './checkpoints';

export type RacePhase = 'countdown' | 'racing' | 'finished';

/**
 * Pure, deterministic time-trial core — the racing sibling of `TrafficSignals`.
 * Driven by `update(dt, position)` from the frame loop (no `Date.now`, so it is
 * testable): runs a 3·2·1 countdown (controls locked), then times laps by
 * detecting in-order crossings of checkpoint gates derived from the circuit
 * centreline, and finishes after N laps. All output is on the event bus; the
 * HUD and (in multiplayer) the room state are just subscribers.
 *
 * Gate 0 is the start/finish line and the spawn sits on it, so the first
 * expected gate is 1; crossing gate 0 again completes a lap.
 */
export class RaceTracker {
  private readonly checkpoints: Checkpoint[];
  private readonly totalLaps: number;

  private _phase: RacePhase = 'countdown';
  private countdownLeftMs: number;
  private lastSecondsShown = -1;
  private _totalMs = 0;
  private lapStartMs = 0;
  private _lap = 1;
  private nextIndex = 1;
  private prev: { x: number; z: number } | null = null;

  constructor(
    private readonly events: GameEventBus,
    circuit: CircuitSpec,
    laps: number,
    countdownSeconds = 3,
  ) {
    this.checkpoints = buildCheckpoints(circuit);
    this.totalLaps = Math.max(1, Math.floor(laps));
    this.countdownLeftMs = countdownSeconds * 1000;
  }

  get phase(): RacePhase {
    return this._phase;
  }
  get totalMs(): number {
    return this._totalMs;
  }
  get lap(): number {
    return this._lap;
  }
  get laps(): number {
    return this.totalLaps;
  }
  get checkpointCount(): number {
    return this.checkpoints.length;
  }
  /** Throttle/brake stay locked until GO. */
  get controlsLocked(): boolean {
    return this._phase === 'countdown';
  }
  /** Monotonic progress for live ordering: laps done × gates + gates passed this lap. */
  get progress(): number {
    const passedThisLap = this.nextIndex === 0 ? this.checkpoints.length : this.nextIndex;
    return (this._lap - 1) * this.checkpoints.length + passedThisLap;
  }

  update(dt: number, pos: { x: number; z: number }): void {
    if (this._phase === 'finished') return;
    const dtMs = dt * 1000;

    if (this._phase === 'countdown') {
      const secondsLeft = Math.max(0, Math.ceil(this.countdownLeftMs / 1000));
      if (secondsLeft !== this.lastSecondsShown) {
        this.lastSecondsShown = secondsLeft;
        this.events.publish('race/countdown', { secondsLeft });
      }
      this.countdownLeftMs -= dtMs;
      if (this.countdownLeftMs <= 0) {
        this._phase = 'racing';
        this.prev = { x: pos.x, z: pos.z };
        if (this.lastSecondsShown !== 0) this.events.publish('race/countdown', { secondsLeft: 0 });
        this.events.publish('race/started', { totalLaps: this.totalLaps });
      }
      return;
    }

    // racing
    this._totalMs += dtMs;
    const prev = this.prev;
    this.prev = { x: pos.x, z: pos.z };
    if (!prev) return;

    const gate = this.checkpoints[this.nextIndex];
    // Cross the gate plane (prev behind → cur ahead, by the tangent) within the gate width.
    const sidePrev = (prev.x - gate.x) * gate.tx + (prev.z - gate.z) * gate.tz;
    const sideCur = (pos.x - gate.x) * gate.tx + (pos.z - gate.z) * gate.tz;
    if (sidePrev < 0 && sideCur >= 0) {
      const lateral = Math.abs((pos.x - gate.x) * -gate.tz + (pos.z - gate.z) * gate.tx);
      if (lateral <= gate.halfWidth) this.passGate();
    }
  }

  private passGate(): void {
    const total = this.checkpoints.length;
    const crossed = this.nextIndex;
    this.events.publish('race/checkpointPassed', { index: crossed, total, lap: this._lap });
    this.nextIndex = (crossed + 1) % total;

    if (crossed === 0) {
      const lapMs = this._totalMs - this.lapStartMs;
      this.lapStartMs = this._totalMs;
      this.events.publish('race/lapCompleted', {
        lap: this._lap,
        totalLaps: this.totalLaps,
        lapMs,
        totalMs: this._totalMs,
      });
      if (this._lap >= this.totalLaps) {
        this._phase = 'finished';
        this.events.publish('race/finished', { totalMs: this._totalMs });
        return;
      }
      this._lap += 1;
    }
  }
}
