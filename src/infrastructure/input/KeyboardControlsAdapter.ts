import type { ControlsPort, ControlsState } from '@application/ports/ControlsPort';

const THROTTLE_KEYS = ['KeyW', 'ArrowUp'];
const BRAKE_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

/** Códigos cuyo comportamiento por defecto (scroll) hay que anular. */
const CAPTURED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

type KeyListener = (event: KeyboardEvent) => void;

export interface KeyEventSource {
  addEventListener(type: 'keydown' | 'keyup' | 'blur', listener: KeyListener): void;
  removeEventListener(type: 'keydown' | 'keyup' | 'blur', listener: KeyListener): void;
}

export class KeyboardControlsAdapter implements ControlsPort {
  private readonly pressed = new Set<string>();
  private source: KeyEventSource | null = null;

  private readonly onKeyDown: KeyListener = (event) => {
    if (CAPTURED_KEYS.includes(event.code)) event.preventDefault();
    this.pressed.add(event.code);
  };

  private readonly onKeyUp: KeyListener = (event) => {
    this.pressed.delete(event.code);
  };

  /** Al perder el foco no llegan los keyup: soltarlo todo. */
  private readonly onBlur: KeyListener = () => {
    this.pressed.clear();
  };

  attach(source: KeyEventSource): void {
    this.detach();
    this.source = source;
    source.addEventListener('keydown', this.onKeyDown);
    source.addEventListener('keyup', this.onKeyUp);
    source.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.source) return;
    this.source.removeEventListener('keydown', this.onKeyDown);
    this.source.removeEventListener('keyup', this.onKeyUp);
    this.source.removeEventListener('blur', this.onBlur);
    this.source = null;
    this.pressed.clear();
  }

  read(): ControlsState {
    const anyOf = (codes: string[]) => codes.some((code) => this.pressed.has(code));
    return {
      throttle: anyOf(THROTTLE_KEYS) ? 1 : 0,
      brake: anyOf(BRAKE_KEYS) ? 1 : 0,
      steering: (anyOf(LEFT_KEYS) ? 1 : 0) - (anyOf(RIGHT_KEYS) ? 1 : 0),
    };
  }
}
