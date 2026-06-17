import type { Unsubscribe } from '@domain/events/EventBus';
import type { GameEventBus } from '@domain/events/GameEvents';
import type { NetworkPort } from './ports/NetworkPort';

/**
 * Forward 1 of every N local-transform ticks. The player publishes its pose
 * every physics step (~60 Hz); broadcasting all of them would spam the socket,
 * so we down-sample to ~20 Hz. Counting ticks (not a wall clock) keeps the
 * bridge pure and unit-testable.
 */
const SEND_EVERY = 3;

/**
 * Glue between the event bus and the `NetworkPort`. It keeps the bus as the
 * single source of truth: the local pose flows bus → port (throttled), and
 * remote events flow port → bus, so the rendering layer only ever reads bus
 * events (`net/remoteTransform`, `net/playerJoined`...), never the port.
 */
export class NetworkBridge {
  private readonly subscriptions: Unsubscribe[] = [];
  private tick = 0;

  constructor(
    private readonly events: GameEventBus,
    private readonly network: NetworkPort,
  ) {}

  start(): void {
    this.subscriptions.push(
      this.events.subscribe('net/localTransform', (transform) => {
        if (this.tick++ % SEND_EVERY !== 0) return;
        this.network.sendTransform(transform);
      }),
      this.network.onPlayerJoined((id) => this.events.publish('net/playerJoined', { id })),
      this.network.onPlayerLeft((id) => this.events.publish('net/playerLeft', { id })),
      this.network.onRemoteTransform((transform) => this.events.publish('net/remoteTransform', transform)),
    );
    void this.network.connect();
  }

  dispose(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.length = 0;
    this.network.disconnect();
  }
}
