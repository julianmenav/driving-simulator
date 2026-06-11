import type { ShiftDirection } from '@domain/vehicle/Gearbox';

export interface ControlsState {
  /** Acelerador, 0..1. */
  throttle: number;
  /** Freno, 0..1. */
  brake: number;
  /** Dirección, -1..1; positivo = izquierda. */
  steering: number;
}

/**
 * Puerto de entrada de conducción. Hoy lo implementa el teclado;
 * mañana puede implementarlo un gamepad o un volante.
 */
export interface ControlsPort {
  read(): ControlsState;
  /**
   * Devuelve y vacía la cola de peticiones de cambio de marcha acumuladas
   * desde la última llamada (pulsaciones, no estado mantenido).
   */
  consumeShiftRequests(): ShiftDirection[];
}
