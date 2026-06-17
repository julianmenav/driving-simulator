import { create } from 'zustand';
import { PRESETS, type DayPhase, type EnvironmentPreset } from './presets';

/**
 * Global day/night state. This is the one toggle everything reads from: the
 * scene environment, the building windows, streetlights, lamp halos and the
 * headlights all derive their behaviour from the active preset.
 *
 * The game stays at night by default (per design); the toggle is exposed in
 * the UI for switching to day. Toggling is a rare, user-driven event, so a
 * React-state store (zustand) is the right home — not a per-frame ref.
 */
interface EnvironmentState {
  phase: DayPhase;
  setPhase: (phase: DayPhase) => void;
  toggle: () => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  phase: 'night',
  setPhase: (phase) => set({ phase }),
  toggle: () => set((state) => ({ phase: state.phase === 'night' ? 'day' : 'night' })),
}));

/** The active environment preset. Re-renders the caller only when the phase changes. */
export function usePreset(): EnvironmentPreset {
  return PRESETS[useEnvironmentStore((state) => state.phase)];
}

/** Whether the city's artificial lights are currently on. */
export function useLightsOn(): boolean {
  return PRESETS[useEnvironmentStore((state) => state.phase)].lightsOn;
}
