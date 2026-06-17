/**
 * Physical and driving parameters of the vehicle. It lives in the domain:
 * it is the definition of the car, not of the physics engine. The
 * infrastructure (Rapier) consumes it to configure the raycast vehicle
 * controller.
 *
 * Axis convention (chassis local space): +z = front of the car,
 * +y = up, +x = driver's left.
 */
export interface VehicleSpec {
  /** Chassis (collider) half extents, in meters. */
  chassisHalfExtents: [number, number, number];
  /** Chassis mass in kg. */
  chassisMass: number;
  wheelRadius: number;
  /** Suspension anchor points in local space: FL, FR, RL, RR. */
  wheelPositions: [number, number, number][];
  suspensionRestLength: number;
  suspensionStiffness: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
  /** Maximum engine force in N (rear-wheel drive), available at low speed. */
  maxEngineForce: number;
  /**
   * Maximum engine power in W. At speed v the available force is
   * min(maxEngineForce, maxPowerWatts / v): a realistic acceleration curve
   * that decays with speed.
   */
  maxPowerWatts: number;
  /** Brake per wheel (empirical scale of the Rapier/Bullet raycast vehicle). */
  maxBrakeForce: number;
  /** Engine braking + rolling resistance applied when the throttle is released (brake scale). */
  engineBrakeForce: number;
  /** Aerodynamic drag: F = -coef · |v| · v on the chassis (N·s²/m²). */
  aeroDragCoefficient: number;
  /** Fraction of the engine force available in reverse. */
  reverseForceRatio: number;
  /** Maximum front wheel steering angle in radians (at low speed). */
  maxSteeringAngle: number;
  /** Steering response speed (1/s, for the smoothing). */
  steeringSpeed: number;
}

export const DEFAULT_VEHICLE_SPEC: VehicleSpec = {
  chassisHalfExtents: [0.85, 0.35, 2.1],
  chassisMass: 800,
  wheelRadius: 0.34,
  wheelPositions: [
    [0.78, -0.15, 1.35],
    [-0.78, -0.15, 1.35],
    [0.78, -0.15, -1.35],
    [-0.78, -0.15, -1.35],
  ],
  suspensionRestLength: 0.35,
  suspensionStiffness: 24,
  suspensionCompression: 4.4,
  suspensionRelaxation: 2.3,
  maxEngineForce: 2400,
  maxPowerWatts: 50_000,
  maxBrakeForce: 45,
  engineBrakeForce: 3,
  aeroDragCoefficient: 0.45,
  reverseForceRatio: 0.5,
  maxSteeringAngle: 0.5,
  steeringSpeed: 6,
};
