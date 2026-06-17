import { Client, type Room } from 'colyseus.js';
import { create } from 'zustand';
import type { SessionConfig } from '@application/session';

/**
 * Where to reach the multiplayer server. `VITE_SERVER_URL` wins when set (prod
 * uses `wss://<railway>`). Otherwise derive it from where the page was served:
 * a LAN guest who loaded the client from the host's IP talks to the server at
 * that same IP, and the host (localhost) talks to localhost — so same-network
 * play needs **no** configuration. The server's port is fixed at 2567.
 */
function defaultEndpoint(): string {
  if (typeof window === 'undefined') return 'ws://localhost:2567';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:2567`;
}

const ENDPOINT = import.meta.env.VITE_SERVER_URL || defaultEndpoint();
// Unambiguous alphabet (no O/0, I/1) for human-friendly codes.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface LobbyPlayer {
  sessionId: string;
  name: string;
  isHost: boolean;
  seat: number;
}

export type MultiplayerStatus = 'idle' | 'menu' | 'connecting' | 'lobby' | 'racing' | 'error';

interface CreateConfig {
  name: string;
  mapId: string;
  carId: string;
  laps: number;
}

interface MultiplayerState {
  status: MultiplayerStatus;
  code: string;
  players: LobbyPlayer[];
  localId: string;
  error: string | null;
  /** The room's shared session config (host's map/car/laps) — used to mount the game. */
  config: SessionConfig | null;
  room: Room | null;
  openMenu: () => void;
  createRoom: (config: CreateConfig) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  startRace: () => void;
  leave: () => void;
}

let client: Client | null = null;
const getClient = () => (client ??= new Client(ENDPOINT));

/**
 * Lobby/matchmaking state for multiplayer, fed by the Colyseus room's synced
 * state (membership, code, host's config, lobby→racing phase). High-frequency
 * car poses do NOT flow through here — they go through the `ColyseusNetworkAdapter`
 * (`transform` messages). The same room is reused in-game by that adapter.
 */
export const useMultiplayerStore = create<MultiplayerState>((set, get) => {
  const wire = (room: Room) => {
    room.onStateChange((state: any) => {
      const players: LobbyPlayer[] = [];
      state.players?.forEach((player: any, sessionId: string) =>
        players.push({ sessionId, name: player.name, isHost: player.isHost, seat: player.seat }),
      );
      set((prev) => ({
        players,
        code: state.code || prev.code,
        config: { mode: 'free-roam', mapId: state.mapId, carId: state.carId, laps: state.laps },
        // Lobby launches into the race when the host flips the phase.
        status: state.phase === 'racing' ? 'racing' : prev.status,
      }));
    });
    room.onLeave(() => {
      // Only reset if we still think we're in this room (avoids clobbering a fresh session).
      if (get().room === room) set({ status: 'idle', room: null, players: [], code: '', config: null, localId: '' });
    });
  };

  return {
    status: 'idle',
    code: '',
    players: [],
    localId: '',
    error: null,
    config: null,
    room: null,

    openMenu: () => set({ status: 'menu', error: null }),

    createRoom: async (config) => {
      set({ status: 'connecting', error: null });
      try {
        const code = genCode();
        const room = await getClient().create('race', { code, ...config });
        set({ room, localId: room.sessionId, code, status: 'lobby' });
        wire(room);
      } catch (error) {
        set({ status: 'error', error: message(error) });
      }
    },

    joinRoom: async (code, name) => {
      set({ status: 'connecting', error: null });
      const normalized = code.trim().toUpperCase();
      try {
        const room = await getClient().join('race', { code: normalized, name });
        set({ room, localId: room.sessionId, code: normalized, status: 'lobby' });
        wire(room);
      } catch (error) {
        set({ status: 'error', error: `No se pudo unir a "${normalized}". ${message(error)}` });
      }
    },

    startRace: () => get().room?.send('start'),

    leave: () => {
      get().room?.leave();
      set({ status: 'idle', room: null, players: [], code: '', config: null, localId: '', error: null });
    },
  };
});
