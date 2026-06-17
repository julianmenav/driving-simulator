/**
 * Environment presets: the single source of truth for the look of each time of
 * day. Pure data (colours, intensities, positions) — same spirit as a
 * MapManifest, so the rest of the rendering reads one object and stays in sync.
 *
 * Everything visual that depends on the time of day derives from a preset:
 * sky, fog, ambient/sun light and the `lightsOn` flag that turns the city's
 * artificial lights (windows, streetlights, lamp halos, headlights) on/off.
 *
 * Adding a new phase (e.g. `dusk`) is additive: add a preset and extend the
 * `DayPhase` union — no consumer needs to change.
 */

export type DayPhase = 'day' | 'night';

export interface EnvironmentPreset {
  phase: DayPhase;
  /** Whether artificial lights are on (windows, streetlights, lamp halos, headlights). */
  lightsOn: boolean;
  /** Scene background colour (hidden behind the daytime Sky mesh). */
  background: string;
  fog: { color: string; near: number; far: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  /** The key light: sun by day, moon by night. */
  sun: { position: [number, number, number]; color: string; intensity: number };
  /** Which celestial backdrop to render. */
  sky: 'day' | 'night';
}

export const DAY_PRESET: EnvironmentPreset = {
  phase: 'day',
  lightsOn: false,
  background: '#bcd2e3',
  fog: { color: '#bcd2e3', near: 100, far: 400 },
  hemisphere: { sky: '#bcd2e3', ground: '#5d7052', intensity: 0.7 },
  sun: { position: [40, 60, 25], color: '#fff4e2', intensity: 2 },
  sky: 'day',
};

export const NIGHT_PRESET: EnvironmentPreset = {
  phase: 'night',
  lightsOn: true,
  background: '#05060d',
  fog: { color: '#070912', near: 70, far: 340 },
  hemisphere: { sky: '#2a3650', ground: '#0a0c14', intensity: 0.5 },
  sun: { position: [-60, 95, -45], color: '#9fb2d6', intensity: 0.55 },
  sky: 'night',
};

export const PRESETS: Record<DayPhase, EnvironmentPreset> = {
  day: DAY_PRESET,
  night: NIGHT_PRESET,
};
