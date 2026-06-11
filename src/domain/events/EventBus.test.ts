import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

interface TestEvents {
  'test/ping': { value: number };
  'test/pong': { label: string };
}

const createBus = (reportError?: (error: unknown, eventType: PropertyKey) => void) =>
  new EventBus<TestEvents>(reportError);

describe('EventBus', () => {
  it('entrega el payload a los suscriptores del tipo publicado', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribe('test/ping', handler);
    bus.publish('test/ping', { value: 42 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 42 });
  });

  it('no entrega eventos de otros tipos', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribe('test/ping', handler);
    bus.publish('test/pong', { label: 'hola' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('soporta varios suscriptores para el mismo tipo', () => {
    const bus = createBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.subscribe('test/ping', first);
    bus.subscribe('test/ping', second);
    bus.publish('test/ping', { value: 1 });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('deja de entregar tras cancelar la suscripción', () => {
    const bus = createBus();
    const handler = vi.fn();

    const unsubscribe = bus.subscribe('test/ping', handler);
    unsubscribe();
    bus.publish('test/ping', { value: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('subscribeAll recibe todos los eventos con su tipo', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.subscribeAll(handler);
    bus.publish('test/ping', { value: 1 });
    bus.publish('test/pong', { label: 'hola' });

    expect(handler).toHaveBeenNthCalledWith(1, 'test/ping', { value: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, 'test/pong', { label: 'hola' });
  });

  it('once se ejecuta una sola vez', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.once('test/ping', handler);
    bus.publish('test/ping', { value: 1 });
    bus.publish('test/ping', { value: 2 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 1 });
  });

  it('un handler que lanza no interrumpe al resto y se reporta el error', () => {
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

  it('un handler puede desuscribirse a sí mismo durante la publicación sin afectar al resto', () => {
    const bus = createBus();
    const second = vi.fn();

    const unsubscribe = bus.subscribe('test/ping', () => unsubscribe());
    bus.subscribe('test/ping', second);
    bus.publish('test/ping', { value: 1 });

    expect(second).toHaveBeenCalledOnce();
  });

  it('clear elimina todas las suscripciones', () => {
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
