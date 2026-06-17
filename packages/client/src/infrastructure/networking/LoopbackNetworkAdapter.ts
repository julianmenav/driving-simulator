import type { Unsubscribe } from '@domain/events/EventBus';
import type { CarTransform } from '@domain/events/GameEvents';
import type { NetworkPort, RemoteTransform } from '@application/ports/NetworkPort';

const GHOST_ID = 'ghost';
/**
 * How many buffered samples to lag the ghost behind the local car. At the
 * bridge's ~20 Hz send rate this is ~2 s, so the ghost trails you down a
 * parallel lane — drop a little speed and it catches up to bump into.
 */
const DELAY_SAMPLES = 40;
/** Sideways shift (m) so the ghost drives next to you, not through you. */
const LATERAL_OFFSET = 3.5;

/**
 * A serverless `NetworkPort` for developing/verifying the remote-car path: it
 * records the local poses pushed via `sendTransform` and replays them, lagged
 * and shifted sideways, as a single "ghost" remote player. No sockets, no
 * clock (the lag is a fixed-size buffer), so it is deterministic. The real
 * Colyseus adapter will implement this same interface.
 */
export class LoopbackNetworkAdapter implements NetworkPort {
  readonly localId = 'local';
  private connected = false;
  private joined = false;
  private buffer: RemoteTransform[] = [];
  private readonly joinedCallbacks = new Set<(id: string) => void>();
  private readonly leftCallbacks = new Set<(id: string) => void>();
  private readonly transformCallbacks = new Set<(transform: RemoteTransform) => void>();

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
    if (this.joined) {
      this.joined = false;
      this.leftCallbacks.forEach((callback) => callback(GHOST_ID));
    }
    this.buffer = [];
    this.joinedCallbacks.clear();
    this.leftCallbacks.clear();
    this.transformCallbacks.clear();
  }

  sendTransform(transform: CarTransform): void {
    if (!this.connected) return;

    // Offset perpendicular to the heading so the ghost holds a parallel line.
    const left = { x: Math.cos(transform.headingRad), z: -Math.sin(transform.headingRad) };
    this.buffer.push({
      id: GHOST_ID,
      position: {
        x: transform.position.x + left.x * LATERAL_OFFSET,
        y: transform.position.y,
        z: transform.position.z + left.z * LATERAL_OFFSET,
      },
      headingRad: transform.headingRad,
      velocity: transform.velocity,
      speedKmh: transform.speedKmh,
    });

    if (this.buffer.length <= DELAY_SAMPLES) return;
    const replayed = this.buffer.shift()!;
    // The ghost "joins" right before its first pose — by now the local player
    // has been ticking for ~2 s, so every subscriber is mounted and listening.
    if (!this.joined) {
      this.joined = true;
      this.joinedCallbacks.forEach((callback) => callback(GHOST_ID));
    }
    this.transformCallbacks.forEach((callback) => callback(replayed));
  }

  onPlayerJoined(callback: (id: string) => void): Unsubscribe {
    this.joinedCallbacks.add(callback);
    return () => this.joinedCallbacks.delete(callback);
  }

  onPlayerLeft(callback: (id: string) => void): Unsubscribe {
    this.leftCallbacks.add(callback);
    return () => this.leftCallbacks.delete(callback);
  }

  onRemoteTransform(callback: (transform: RemoteTransform) => void): Unsubscribe {
    this.transformCallbacks.add(callback);
    return () => this.transformCallbacks.delete(callback);
  }
}
