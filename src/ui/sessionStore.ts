import { create } from 'zustand';
import type { SessionConfig } from '@application/session';

/**
 * Drives the top-level flow: the start menu collects a `SessionConfig`, then
 * `start()` mounts the game; `quit()` tears it back down to the menu. Kept in
 * React/zustand state (not a per-frame ref) because it changes only on menu
 * actions, never inside the game loop.
 */
interface SessionState {
  status: 'menu' | 'playing';
  config: SessionConfig | null;
  start: (config: SessionConfig) => void;
  quit: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'menu',
  config: null,
  start: (config) => set({ status: 'playing', config }),
  quit: () => set({ status: 'menu', config: null }),
}));
