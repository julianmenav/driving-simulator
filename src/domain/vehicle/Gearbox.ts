import type { GameEventBus } from '@domain/events/GameEvents';
import type { Gear } from './Gear';
import type { VehicleSpec } from './VehicleSpec';

export type ShiftDirection = 'up' | 'down';

export interface DriveCommand {
  /** Engine force in N; the gear decides the sign. */
  engineForce: number;
  /** Brake force per wheel. */
  brakeForce: number;
}

/** Lever order: 'up' moves towards D, 'down' towards R. */
const GEAR_ORDER: Gear[] = ['R', 'N', 'D'];

/** Maximum speed (km/h) at which engaging against the direction of travel is allowed. */
const ENGAGE_MAX_SPEED_KMH = 6;

/**
 * Automatic gearbox with a D/N/R selector. It decides what the throttle
 * does for each gear: D pushes forward, R pushes backward (with reduced
 * force), N provides no traction. The brake always brakes. Publishes
 * vehicle/gearChanged when a gear engages.
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

  /** Tries to move the lever; returns whether the gear actually engaged. */
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
    // Constant power: the faster you go, the less force is available.
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
