import type { ShiftDirection } from '@domain/vehicle/Gearbox';

export interface ControlsState {
  /** Throttle, 0..1. */
  throttle: number;
  /** Brake, 0..1. */
  brake: number;
  /** Steering, -1..1; positive = left. */
  steering: number;
}

/**
 * Driving input port. Today a keyboard implements it; tomorrow it could be
 * a gamepad or a steering wheel.
 */
export interface ControlsPort {
  read(): ControlsState;
  /**
   * Returns and clears the queue of gear shift requests accumulated since
   * the last call (key presses, not held state).
   */
  consumeShiftRequests(): ShiftDirection[];
}
