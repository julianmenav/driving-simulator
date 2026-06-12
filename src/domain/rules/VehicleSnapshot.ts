/**
 * Read model the domain rules evaluate each tick. It mirrors what
 * infrastructure publishes on `vehicle/stateUpdated`, but lives in the domain
 * so rules never depend on the event shape — it can grow (position, gear,
 * heading...) as more rules need more context.
 */
export interface VehicleSnapshot {
  /** Signed speed in km/h: positive forward, negative in reverse. */
  speedKmh: number;
}
