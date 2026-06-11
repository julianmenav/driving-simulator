import type { GameEventBus } from '@domain/events/GameEvents';
import type { Gear } from './Gear';
import type { VehicleSpec } from './VehicleSpec';

export type ShiftDirection = 'up' | 'down';

export interface DriveCommand {
  /** Fuerza de motor en N; el signo lo decide la marcha. */
  engineForce: number;
  /** Freno por rueda. */
  brakeForce: number;
}

/** Orden de la palanca: 'up' avanza hacia D, 'down' hacia R. */
const GEAR_ORDER: Gear[] = ['R', 'N', 'D'];

/** Velocidad máxima (km/h) a la que se permite engranar en sentido contrario. */
const ENGAGE_MAX_SPEED_KMH = 6;

/**
 * Caja de cambios automática con selector D/N/R. Es quien decide qué hace
 * el acelerador según la marcha: en D empuja hacia delante, en R hacia
 * atrás (con menos fuerza), en N el motor no tracciona. El freno siempre
 * frena. Publica vehicle/gearChanged al engranar.
 */
export class AutomaticGearbox {
  private current: Gear = 'N';

  constructor(
    private readonly spec: VehicleSpec,
    private readonly events?: GameEventBus,
  ) {}

  get gear(): Gear {
    return this.current;
  }

  /** Intenta mover la palanca; devuelve si la marcha llegó a engranar. */
  shift(direction: ShiftDirection, speedKmh: number): boolean {
    const index = GEAR_ORDER.indexOf(this.current) + (direction === 'up' ? 1 : -1);
    const target = GEAR_ORDER[index];
    if (!target || !this.canEngage(target, speedKmh)) return false;

    const previous = this.current;
    this.current = target;
    this.events?.publish('vehicle/gearChanged', { previous, current: target });
    return true;
  }

  computeDrive(input: { throttle: number; brake: number }, speedKmh: number): DriveCommand {
    // Potencia constante: a más velocidad, menos fuerza disponible.
    const speedMs = Math.max(Math.abs(speedKmh) / 3.6, 1);
    const availableForce = Math.min(this.spec.maxEngineForce, this.spec.maxPowerWatts / speedMs);

    let engineForce = 0;
    if (this.current === 'D') {
      engineForce = input.throttle * availableForce;
    } else if (this.current === 'R') {
      engineForce = -input.throttle * availableForce * this.spec.reverseForceRatio;
    }

    let brakeForce = input.brake * this.spec.maxBrakeForce;
    if (input.throttle === 0) brakeForce += this.spec.engineBrakeForce;

    return { engineForce, brakeForce };
  }

  private canEngage(gear: Gear, speedKmh: number): boolean {
    if (gear === 'D') return speedKmh > -ENGAGE_MAX_SPEED_KMH;
    if (gear === 'R') return speedKmh < ENGAGE_MAX_SPEED_KMH;
    return true;
  }
}
