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

  emit(type: string, code = ''): void {
    const event = { code, preventDefault: () => {} } as KeyboardEvent;
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
  it('sin teclas pulsadas todo está en reposo', () => {
    const { adapter } = createAttached();
    expect(adapter.read()).toEqual({ throttle: 0, brake: 0, steering: 0 });
  });

  it('W acelera y al soltar vuelve a 0', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyW');
    expect(adapter.read().throttle).toBe(1);

    source.emit('keyup', 'KeyW');
    expect(adapter.read().throttle).toBe(0);
  });

  it('las flechas son equivalentes a WASD', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'ArrowUp');
    source.emit('keydown', 'ArrowLeft');

    expect(adapter.read()).toEqual({ throttle: 1, brake: 0, steering: 1 });
  });

  it('izquierda y derecha a la vez se anulan', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyA');
    source.emit('keydown', 'KeyD');

    expect(adapter.read().steering).toBe(0);
  });

  it('al perder el foco se sueltan todas las teclas', () => {
    const { source, adapter } = createAttached();

    source.emit('keydown', 'KeyW');
    source.emit('keydown', 'KeyA');
    source.emit('blur');

    expect(adapter.read()).toEqual({ throttle: 0, brake: 0, steering: 0 });
  });

  it('tras detach deja de escuchar', () => {
    const { source, adapter } = createAttached();

    adapter.detach();
    source.emit('keydown', 'KeyW');

    expect(adapter.read().throttle).toBe(0);
  });
});
