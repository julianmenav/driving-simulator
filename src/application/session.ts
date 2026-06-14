/**
 * Session = the choices the start menu collects before a game is composed:
 * which mode, map and car, and how many laps. It is plain configuration data
 * (like a manifest); the composition root (`createGame`) and the UI consume it.
 */
export type GameModeId = 'free-roam' | 'time-trial';

export interface GameModeInfo {
  id: GameModeId;
  /** End-user-facing name (Spanish). */
  name: string;
  description: string;
  /** Whether the lap count applies to this mode. */
  usesLaps: boolean;
  /** Marks modes whose core is not built yet (shown but flagged in the menu). */
  comingSoon?: boolean;
}

// Note: 'time-trial' is intentionally absent until its core is built (step 3);
// the type, lap config and menu handling stay so re-adding it is one entry.
export const GAME_MODES: readonly GameModeInfo[] = [
  {
    id: 'free-roam',
    name: 'Libre',
    description: 'Conduce a tu aire por la ciudad. Sin objetivos.',
    usesLaps: false,
  },
];

export interface SessionConfig {
  mode: GameModeId;
  mapId: string;
  carId: string;
  laps: number;
}

export const DEFAULT_LAPS = 3;

export function findGameMode(id: GameModeId): GameModeInfo {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}
