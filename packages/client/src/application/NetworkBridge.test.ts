import { describe, expect, it } from 'vitest';
import { EventBus } from '@domain/events/EventBus';
import type { CarTransform, GameEvents } from '@domain/events/GameEvents';
import { NetworkBridge } from './NetworkBridge';
import type { NetworkPort, RemoteTransform } from './ports/NetworkPort';

/** A NetworkPort spy that also lets the test drive remote-side callbacks. */
class FakeNetwork implements NetworkPort {
  readonly localId = 'me';
  connected = false;
  disconnected = false;
  sent: CarTransform[] = [];
  private joinedCb?: (id: string) => void;
  private leftCb?: (id: string) => void;
  private transformCb?: (t: RemoteTransform) => void;

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }
  disconnect(): void {
    this.disconnected = true;
  }
  sendTransform(transform: CarTransform): void {
    this.sent.push(transform);
  }
  onPlayerJoined(callback: (id: string) => void) {
    this.joinedCb = callback;
    return () => (this.joinedCb = undefined);
  }
  onPlayerLeft(callback: (id: string) => void) {
    this.leftCb = callback;
    return () => (this.leftCb = undefined);
  }
  onRemoteTransform(callback: (t: RemoteTransform) => void) {
    this.transformCb = callback;
    return () => (this.transformCb = undefined);
  }

  emitJoined(id: string) {
    this.joinedCb?.(id);
  }
  emitLeft(id: string) {
    this.leftCb?.(id);
  }
  emitTransform(t: RemoteTransform) {
    this.transformCb?.(t);
  }
}

const pose = (x: number): CarTransform => ({
  position: { x, y: 0, z: 0 },
  headingRad: 0,
  velocity: { x: 0, y: 0, z: 0 },
  speedKmh: 0,
});

const setup = () => {
  const events = new EventBus<GameEvents>();
  const network = new FakeNetwork();
  const bridge = new NetworkBridge(events, network);
  bridge.start();
  return { events, network, bridge };
};

describe('NetworkBridge', () => {
  it('connects on start', () => {
    const { network } = setup();
    expect(network.connected).toBe(true);
  });

  it('throttles local transforms to 1 of every 3 ticks', () => {
    const { events, network } = setup();
    for (let i = 0; i < 6; i++) events.publish('net/localTransform', pose(i));
    // Ticks 0 and 3 pass the SEND_EVERY=3 gate.
    expect(network.sent.map((t) => t.position.x)).toEqual([0, 3]);
  });

  it('forwards remote events from the port onto the bus', () => {
    const { events, network } = setup();
    const joined: string[] = [];
    const left: string[] = [];
    const remote: RemoteTransform[] = [];
    events.subscribe('net/playerJoined', ({ id }) => joined.push(id));
    events.subscribe('net/playerLeft', ({ id }) => left.push(id));
    events.subscribe('net/remoteTransform', (t) => remote.push(t));

    network.emitJoined('ghost');
    network.emitTransform({ ...pose(5), id: 'ghost' });
    network.emitLeft('ghost');

    expect(joined).toEqual(['ghost']);
    expect(left).toEqual(['ghost']);
    expect(remote).toHaveLength(1);
    expect(remote[0].id).toBe('ghost');
  });

  it('stops forwarding and disconnects after dispose', () => {
    const { events, network, bridge } = setup();
    bridge.dispose();
    expect(network.disconnected).toBe(true);

    const remote: RemoteTransform[] = [];
    events.subscribe('net/remoteTransform', (t) => remote.push(t));
    events.publish('net/localTransform', pose(1));
    network.emitTransform({ ...pose(9), id: 'ghost' });

    expect(network.sent).toHaveLength(0);
    expect(remote).toHaveLength(0);
  });
});
