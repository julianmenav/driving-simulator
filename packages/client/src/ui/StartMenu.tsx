import { useEffect, useState } from 'react';
import type { MapRepository, MapSummary } from '@application/ports/MapRepository';
import { DEFAULT_LAPS, GAME_MODES, type GameModeId, type SessionConfig } from '@application/session';
import { CAR_PRESETS, DEFAULT_CAR_ID } from '@domain/vehicle/carPresets';
import { useMultiplayerStore } from './multiplayerStore';
import { useSessionStore } from './sessionStore';

const MIN_LAPS = 1;
const MAX_LAPS = 20;

/**
 * Start screen: collects the session choices (mode / map / car / laps) and
 * hands them to the session store, which mounts the game. Plain React state —
 * it lives outside the game loop. The map list comes from the repository port
 * so a future HTTP/glTF source needs no change here.
 */
export function StartMenu({ mapRepository }: { mapRepository: MapRepository }) {
  const start = useSessionStore((s) => s.start);
  const openMultiplayer = useMultiplayerStore((s) => s.openMenu);

  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [mode, setMode] = useState<GameModeId>('free-roam');
  const [mapId, setMapId] = useState<string>('');
  const [carId, setCarId] = useState<string>(DEFAULT_CAR_ID);
  const [laps, setLaps] = useState<number>(DEFAULT_LAPS);

  useEffect(() => {
    let alive = true;
    mapRepository.list().then((list) => {
      if (!alive) return;
      setMaps(list);
      setMapId((current) => current || list[0]?.id || '');
    });
    return () => {
      alive = false;
    };
  }, [mapRepository]);

  const ready = mapId !== '';
  // Laps apply only to race tracks (circuits); other maps hide the stepper.
  const showLaps = maps.find((m) => m.id === mapId)?.isCircuit ?? false;

  function play() {
    if (!ready) return;
    const config: SessionConfig = { mode, mapId, carId, laps };
    start(config);
  }

  return (
    <div className="menu-root">
      <div className="menu-card">
        <h1 className="menu-title">Simulador de conducción</h1>
        <p className="menu-subtitle">Elige tu partida</p>

        <section className="menu-section">
          <h2>Modo</h2>
          <div className="menu-options">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`menu-option${mode === m.id ? ' is-selected' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="menu-option-name">
                  {m.name}
                  {m.comingSoon && <span className="menu-badge">pronto</span>}
                </span>
                <span className="menu-option-desc">{m.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="menu-section">
          <h2>Mapa</h2>
          <div className="menu-options">
            {maps.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`menu-option${mapId === m.id ? ' is-selected' : ''}`}
                onClick={() => setMapId(m.id)}
              >
                <span className="menu-option-name">{m.name}</span>
                <span className="menu-option-desc">{m.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="menu-section">
          <h2>Coche</h2>
          <div className="menu-options">
            {CAR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`menu-option${carId === c.id ? ' is-selected' : ''}`}
                onClick={() => setCarId(c.id)}
              >
                <span className="menu-option-name">{c.name}</span>
                {c.description && <span className="menu-option-desc">{c.description}</span>}
              </button>
            ))}
          </div>
        </section>

        {showLaps && (
          <section className="menu-section">
            <h2>Vueltas</h2>
            <div className="menu-laps">
              <button
                type="button"
                className="menu-step"
                onClick={() => setLaps((n) => Math.max(MIN_LAPS, n - 1))}
                aria-label="Menos vueltas"
              >
                −
              </button>
              <span className="menu-laps-value">{laps}</span>
              <button
                type="button"
                className="menu-step"
                onClick={() => setLaps((n) => Math.min(MAX_LAPS, n + 1))}
                aria-label="Más vueltas"
              >
                +
              </button>
            </div>
          </section>
        )}

        <button type="button" className="menu-play" onClick={play} disabled={!ready}>
          ▶ Jugar
        </button>

        <button type="button" className="menu-secondary" onClick={openMultiplayer}>
          👥 Multijugador
        </button>
      </div>
    </div>
  );
}
