import { MapSchema, Schema, type } from '@colyseus/schema';

/** Lobby phase: players gather, then the host launches the race. */
export type RacePhase = 'lobby' | 'racing';

export class Player extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('boolean') isHost = false;
  /** Starting-grid slot (join order); the client offsets the spawn by it. */
  @type('number') seat = 0;
  /** Live race progress (reported by the client): current lap and a monotonic
   *  progress value (laps×gates + gates passed), for live positions. */
  @type('number') lap = 0;
  @type('number') progress = 0;
  /** Set when the client reports finishing; finishMs is its total race time. */
  @type('boolean') finished = false;
  @type('number') finishMs = 0;
}

/**
 * Authoritative room state synced to every client. High-frequency car poses do
 * NOT live here — they go through `transform` messages (relay) — so the synced
 * state stays small: membership, the join code, the host's session config (so
 * everyone loads the same map/car/laps), and the lobby→racing phase.
 */
export class RaceState extends Schema {
  @type('string') phase: RacePhase = 'lobby';
  @type('string') code = '';
  @type('string') mapId = '';
  @type('string') carId = '';
  @type('number') laps = 3;
  @type({ map: Player }) players = new MapSchema<Player>();
}
