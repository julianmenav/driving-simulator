import { useEffect, useState } from 'react';
import type { MapRepository, MapSummary } from '@application/ports/MapRepository';
import { DEFAULT_LAPS } from '@application/session';
import { CAR_PRESETS, DEFAULT_CAR_ID } from '@domain/vehicle/carPresets';
import { useMultiplayerStore } from './multiplayerStore';

const MIN_LAPS = 1;
const MAX_LAPS = 20;

/**
 * Multiplayer entry: pick a name, then either create a room (choosing the
 * shared map/car/laps) or join an existing one by its 4-char code. Drives the
 * multiplayer store, which connects to the server and moves on to the lobby.
 */
export function MultiplayerMenu({ mapRepository }: { mapRepository: MapRepository }) {
  const { status, error, createRoom, joinRoom, leave } = useMultiplayerStore();

  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [name, setName] = useState('Piloto');
  const [mapId, setMapId] = useState('');
  const [carId, setCarId] = useState(DEFAULT_CAR_ID);
  const [laps, setLaps] = useState(DEFAULT_LAPS);
  const [joinCode, setJoinCode] = useState('');

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

  const busy = status === 'connecting';
  const trimmedName = name.trim() || 'Piloto';
  // Laps apply only to race tracks (circuits).
  const showLaps = maps.find((m) => m.id === mapId)?.isCircuit ?? false;

  return (
    <div className="menu-root">
      <div className="menu-card">
        <h1 className="menu-title">Multijugador</h1>
        <p className="menu-subtitle">Crea una sala o únete con un código</p>

        <section className="menu-section">
          <h2>Tu nombre</h2>
          <input
            className="menu-input"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            placeholder="Piloto"
          />
        </section>

        {error && <p className="menu-error">{error}</p>}

        <section className="menu-section">
          <h2>Crear una sala</h2>
          <h3 className="menu-subheading">Mapa</h3>
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
          <h3 className="menu-subheading">Coche</h3>
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
          {showLaps && (
            <>
              <h3 className="menu-subheading">Vueltas</h3>
              <div className="menu-laps">
                <button type="button" className="menu-step" onClick={() => setLaps((n) => Math.max(MIN_LAPS, n - 1))}>
                  −
                </button>
                <span className="menu-laps-value">{laps}</span>
                <button type="button" className="menu-step" onClick={() => setLaps((n) => Math.min(MAX_LAPS, n + 1))}>
                  +
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            className="menu-play"
            disabled={busy || mapId === ''}
            onClick={() => createRoom({ name: trimmedName, mapId, carId, laps })}
          >
            {busy ? 'Conectando…' : 'Crear sala'}
          </button>
        </section>

        <div className="mp-divider">o</div>

        <section className="menu-section">
          <h2>Unirse con código</h2>
          <input
            className="menu-input mp-code-input"
            value={joinCode}
            maxLength={4}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
          />
          <button
            type="button"
            className="menu-play"
            disabled={busy || joinCode.trim().length < 4}
            onClick={() => joinRoom(joinCode, trimmedName)}
          >
            {busy ? 'Conectando…' : 'Unirse'}
          </button>
        </section>

        <button type="button" className="menu-secondary" onClick={leave}>
          ← Volver
        </button>
      </div>
    </div>
  );
}
