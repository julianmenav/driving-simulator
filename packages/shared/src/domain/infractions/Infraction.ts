/** Kinds of traffic infraction the rules can detect. */
export type InfractionType = 'speeding' | 'red-light';

/** Driving over the speed limit in force at the vehicle's position. */
export interface SpeedingInfraction {
  type: 'speeding';
  /** Speed (km/h) at the moment it was committed. */
  speedKmh: number;
  /** Limit (km/h) that was exceeded. */
  limitKmh: number;
}

/** Crossing a stop line while the governing light is red. */
export interface RedLightInfraction {
  type: 'red-light';
  /** Speed (km/h) at the moment the stop line was crossed. */
  speedKmh: number;
}

/**
 * A committed infraction: the domain's scoreable unit. A discriminated union
 * on `type` so each kind carries only its relevant data and new kinds slot in
 * additively. Data only, no behavior — game-mode policies decide what to do.
 */
export type Infraction = SpeedingInfraction | RedLightInfraction;
