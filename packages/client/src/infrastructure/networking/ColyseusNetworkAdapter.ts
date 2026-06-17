import { getStateCallbacks, type Room } from 'colyseus.js';
import type { NetworkPort, RemoteTransform } from '@application/ports/NetworkPort';
import type { Unsubscribe } from '@domain/events/EventBus';
import type { CarTransform } from '@domain/events/GameEvents';

/**
 * `NetworkPort` over a connected Colyseus `Room`. Reuses the exact seam the
 * loopback proved, so `NetworkBridge` → `RemoteVehicles` work unchanged: the
 * local pose is sent as a `transform` message, remote poses arrive as relayed
 * `transform` messages, and player join/leave comes off the synced room state
 * (we skip our own id so we never spawn a ghost of ourselves). The room's
 * lifecycle is owned by the lobby store; this adapter only attaches listeners.
 */
export class ColyseusNetworkAdapter implements NetworkPort {
  readonly localId: string;
  private readonly cleanups: Unsubscribe[] = [];

  constructor(private readonly room: Room) {
    this.localId = room.sessionId;
  }

  connect(): Promise<void> {
    // Already joined during the lobby — nothing to do.
    return Promise.resolve();
  }

  disconnect(): void {
    this.cleanups.forEach((off) => off());
    this.cleanups.length = 0;
  }

  sendTransform(transform: CarTransform): void {
    this.room.send('transform', transform);
  }

  onPlayerJoined(callback: (id: string) => void): Unsubscribe {
    const $ = getStateCallbacks(this.room);
    // onAdd fires for already-present players too, so remotes already in the
    // room at race start get spawned.
    const off = ($(this.room.state) as any).players.onAdd((_player: unknown, key: string) => {
      if (key !== this.localId) callback(key);
    });
    this.cleanups.push(off);
    return off;
  }

  onPlayerLeft(callback: (id: string) => void): Unsubscribe {
    const $ = getStateCallbacks(this.room);
    const off = ($(this.room.state) as any).players.onRemove((_player: unknown, key: string) => {
      if (key !== this.localId) callback(key);
    });
    this.cleanups.push(off);
    return off;
  }

  onRemoteTransform(callback: (transform: RemoteTransform) => void): Unsubscribe {
    const off = this.room.onMessage('transform', (message: RemoteTransform) => callback(message));
    this.cleanups.push(off);
    return off;
  }
}
