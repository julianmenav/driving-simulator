import { describe, expect, it } from 'vitest';
import { KeyboardControlsAdapter, type KeyEventSource } from './KeyboardControlsAdapter';

type KeyListener = (event: KeyboardEvent) => void;

class FakeEventSource implements KeyEventSource {
  private readonly listeners = new Map<string, Set<KeyListener>>();

  addEventListener(type: string, listener: KeyListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: KeyListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, code = '', repeat = false): void {
    const event = { code, repeat, preventDefault: () => {} } as KeyboardEvent;
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const createAttached = () => {
  const source = new FakeEventSource();
  const adapter = new KeyboardControlsAdapter();
  adapter.attach(source);
  return { source, adapter };
};

describe('KeyboardControlsAdapter', () => {
  it('with no keys pressed everything is at rest', () => {
    const { adapter } = createAttached();
    expect(adapter.read()).toEqual({ throttle: 0, brake: 0, steering: 0 });
  });

  it('W accelerates and returns to 0 on release', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyW');
    expect(adapter.read().throttle).toBe(1);

    source.emit('keyup', 'KeyW');
    expect(adapter.read().throttle).toBe(0);
  });

  it('arrow keys are equivalent to WASD', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'ArrowUp');
    source.emit('keydown', 'ArrowLeft');

    expect(adapter.read()).toEqual({ throttle: 1, brake: 0, steering: 1 });
  });

  it('left and right at once cancel out', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyA');
    source.emit('keydown', 'KeyD');

    expect(adapter.read().steering).toBe(0);
  });

  it('losing focus releases every key', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyW');
    source.emit('keydown', 'KeyA');
    source.emit('blur');

    expect(adapter.read()).toEqual({ throttle: 0, brake: 0, steering: 0 });
  });

  it('E and Q queue gear shifts and the queue clears when consumed', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyE');
    source.emit('keydown', 'KeyQ');

    expect(adapter.consumeShiftRequests()).toEqual(['up', 'down']);
    expect(adapter.consumeShiftRequests()).toEqual([]);
  });

  it('ignores E/Q autorepeat while the key is held', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyE');
    source.emit('keydown', 'KeyE', true);
    source.emit('keydown', 'KeyE', true);

    expect(adapter.consumeShiftRequests()).toEqual(['up']);
  });

  it('losing focus also discards the shift queue', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyE');
    source.emit('blur');

    expect(adapter.consumeShiftRequests()).toEqual([]);
  });

  it('stops listening after detach', () => {
    const { source, adapter } = createAttached();

    adapter.detach();
    source.emit('keydown', 'KeyW');

    expect(adapter.read().throttle).toBe(0);
  });
});
