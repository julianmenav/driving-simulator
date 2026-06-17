import { Room, type Client } from 'colyseus';
import type { CarTransform } from '@driving-sim/shared';
import { Player, RaceState } from './schema/RaceState';

interface CreateOptions {
  code: string;
  name: string;
  mapId: string;
  carId: string;
  laps: number;
}

/**
 * One race room = one lobby + race. The creator makes it (carrying a 4-char
 * `code` + the chosen map/car/laps), others join by code, the host presses
 * Empezar once ≥2 players are in. For the MVP the server is a **relay**: it
 * owns membership and the lobby→racing phase, and fans out player car poses;
 * lap/finish scoring is server-authoritative in a later phase.
 */
export class RaceRoom extends Room<RaceState> {
  maxClients = 8;
  private hostId = '';

  onCreate(options: CreateOptions) {
    const state = new RaceState();
    state.code = options.code;
    state.mapId = options.mapId;
    state.carId = options.carId;
    state.laps = options.laps;
    state.phase = 'lobby';
    this.setState(state);

    // Lets clients find this room by its code (matchMaker filterBy(['code'])).
    this.setMetadata({ code: options.code });

    console.log(`[${options.code}] room created (${this.roomId}) · map ${options.mapId} · ${options.laps} laps`);

    // High-frequency car pose: stamp the sender and fan out to everyone else.
    this.onMessage('transform', (client, message: CarTransform) => {
      this.broadcast('transform', { id: client.sessionId, ...message }, { except: client });
    });

    // Only the host can start, and only with at least two players.
    this.onMessage('start', (client) => {
      if (client.sessionId === this.hostId && this.state.players.size >= 2 && this.state.phase === 'lobby') {
        this.state.phase = 'racing';
        console.log(`[${this.state.code}] race started · ${this.state.players.size} players`);
      }
    });
  }

  onJoin(client: Client, options: CreateOptions) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options.name || 'Piloto';
    // Join order = starting-grid slot, so each car spawns in its own spot.
    player.seat = this.state.players.size;
    // First player in is the host.
    if (this.state.players.size === 0) {
      this.hostId = client.sessionId;
      player.isHost = true;
    }
    this.state.players.set(client.sessionId, player);
    console.log(
      `[${this.state.code}] + ${player.name} (${client.sessionId})${player.isHost ? ' [host]' : ''} · ${this.state.players.size} player(s)`,
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    // If the host left, promote the next remaining player so the room stays usable.
    if (client.sessionId === this.hostId) {
      const next = this.state.players.values().next().value as Player | undefined;
      if (next) {
        this.hostId = next.sessionId;
        next.isHost = true;
      }
    }
    console.log(`[${this.state.code}] − ${client.sessionId} · ${this.state.players.size} left`);
  }

  onDispose() {
    console.log(`[${this.state.code}] room disposed`);
  }
}
