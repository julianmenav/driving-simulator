import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

interface TestEvents {
  'test/ping': { value: number };
  'test/pong': { label: string };
}

const createBus = (reportError?: (error: unknown, eventType: PropertyKey) => void) =>
  new EventBus<TestEvents>(reportError);

describe('EventBus', () => {
  it('delivers the payload to subscribers of the published type', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribe('test/ping', handler);
    bus.publish('test/ping', { value: 42 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 42 });
  });

  it('does not deliver events of other types', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribe('test/ping', handler);
    bus.publish('test/pong', { label: 'hi' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers for the same type', () => {
    const bus = createBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.subscribe('test/ping', first);
    bus.subscribe('test/ping', second);
    bus.publish('test/ping', { value: 1 });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('stops delivering after unsubscribing', () => {
    const bus = createBus();
    const handler = vi.fn();

    const unsubscribe = bus.subscribe('test/ping', handler);
    unsubscribe();
    bus.publish('test/ping', { value: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('subscribeAll receives every event with its type', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribeAll(handler);
    bus.publish('test/ping', { value: 1 });
    bus.publish('test/pong', { label: 'hi' });

    expect(handler).toHaveBeenNthCalledWith(1, 'test/ping', { value: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, 'test/pong', { label: 'hi' });
  });

  it('once runs only a single time', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.once('test/ping', handler);
    bus.publish('test/ping', { value: 1 });
    bus.publish('test/ping', { value: 2 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 1 });
  });

  it('a throwing handler does not interrupt the rest and the error is reported', () => {
    const reportError = vi.fn();
    const bus = createBus(reportError);
    const boom = new Error('boom');
    const survivor = vi.fn();

    bus.subscribe('test/ping', () => {
      throw boom;
    });
    bus.subscribe('test/ping', survivor);
    bus.publish('test/ping', { value: 1 });

    expect(survivor).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(boom, 'test/ping');
  });

  it('a handler can unsubscribe itself during publication without affecting the rest', () => {
    const bus = createBus();
    const second = vi.fn();

    const unsubscribe = bus.subscribe('test/ping', () => unsubscribe());
    bus.subscribe('test/ping', second);
    bus.publish('test/ping', { value: 1 });

    expect(second).toHaveBeenCalledOnce();
  });

  it('clear removes every subscription', () => {
    const bus = createBus();
    const handler = vi.fn();
    const wildcard = vi.fn();

    bus.subscribe('test/ping', handler);
    bus.subscribeAll(wildcard);
    bus.clear();
    bus.publish('test/ping', { value: 1 });

    expect(handler).not.toHaveBeenCalled();
    expect(wildcard).not.toHaveBeenCalled();
  });
});
