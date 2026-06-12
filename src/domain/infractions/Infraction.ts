/** Kinds of traffic infraction the rules can detect. */
export type InfractionType = 'speeding';

/**
 * A committed infraction: the domain's scoreable unit. Data only, no behavior,
 * so game-mode policies (practice warnings today, exam scoring later) decide
 * what to do with it.
 */
export interface Infraction {
  type: InfractionType;
  /** Speed (km/h) at the moment it was committed. */
  speedKmh: number;
  /** Limit (km/h) that was exceeded. */
  limitKmh: number;
}
