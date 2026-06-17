import type { Unsubscribe } from '@domain/events/EventBus';
import type { CarTransform } from '@domain/events/GameEvents';

/** A remote player's pose, carrying the id of the player it belongs to. */
export type RemoteTransform = CarTransform & { id: string };

/**
 * Transport-agnostic seam to the multiplayer backend. Single-player simply
 * never instantiates it (consistent with `MapRepository`/`ControlsPort`); the
 * future Colyseus adapter and today's loopback fake implement the same shape,
 * so the rest of the game only ever talks to this interface.
 */
export interface NetworkPort {
  /** This client's stable id within the room. */
  readonly localId: string;
  connect(): Promise<void>;
  disconnect(): void;
  /** Push the local car pose (the bridge throttles before calling this). */
  sendTransform(transform: CarTransform): void;
  onPlayerJoined(callback: (id: string) => void): Unsubscribe;
  onPlayerLeft(callback: (id: string) => void): Unsubscribe;
  onRemoteTransform(callback: (transform: RemoteTransform) => void): Unsubscribe;
}
