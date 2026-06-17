import { useMultiplayerStore } from './multiplayerStore';

const MIN_PLAYERS = 2;

/**
 * Pre-race lobby: shows the join code to share, the connected players, and —
 * for the host — the Empezar button (enabled at ≥2 players). When the host
 * starts, the room phase flips to 'racing' and `App` mounts the game for
 * everyone.
 */
export function Lobby() {
  const { code, players, localId, startRace, leave } = useMultiplayerStore();
  const isHost = players.find((p) => p.sessionId === localId)?.isHost ?? false;
  const canStart = players.length >= MIN_PLAYERS;

  return (
    <div className="menu-root">
      <div className="menu-card">
        <h1 className="menu-title">Sala</h1>
        <p className="menu-subtitle">Comparte este código con tus amigos</p>

        <div className="lobby-code">{code}</div>

        <section className="menu-section">
          <h2>Jugadores ({players.length})</h2>
          <ul className="lobby-players">
            {players.map((p) => (
              <li key={p.sessionId} className="lobby-player">
                <span>{p.name}{p.sessionId === localId ? ' (tú)' : ''}</span>
                {p.isHost && <span className="menu-badge">anfitrión</span>}
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <button type="button" className="menu-play" disabled={!canStart} onClick={startRace}>
            {canStart ? '▶ Empezar' : 'Esperando jugadores…'}
          </button>
        ) : (
          <p className="lobby-hint">Esperando a que el anfitrión empiece la carrera…</p>
        )}

        <button type="button" className="menu-secondary" onClick={leave}>
          ← Salir
        </button>
      </div>
    </div>
  );
}
