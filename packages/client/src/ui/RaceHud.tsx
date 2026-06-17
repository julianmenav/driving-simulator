import { useEffect, useRef, useState } from 'react';
import type { Game } from '@application/createGame';
import { useMultiplayerStore } from './multiplayerStore';

/** ms → "m:ss.s" (e.g. 83400 → "1:23.4"). */
function formatMs(ms: number): string {
  const totalSec = Math.max(0, ms) / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * Race overlay: 3·2·1 countdown, lap N/M + live timer (written imperatively to
 * a ref on each physics tick — no re-render), live position in multiplayer, and
 * a finish panel with the standings. Mounted by GameView only on circuit maps.
 */
export function RaceHud({ game }: { game: Game }) {
  const timerRef = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const [lap, setLap] = useState(1);
  const [totalLaps, setTotalLaps] = useState(game.race?.laps ?? 1);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);

  const isMultiplayer = useMultiplayerStore((s) => s.status === 'racing');
  const racePositions = useMultiplayerStore((s) => s.racePositions);
  const localId = useMultiplayerStore((s) => s.localId);

  useEffect(() => {
    const events = game.events;
    const subs = [
      events.subscribe('race/countdown', ({ secondsLeft }) => {
        setCount(secondsLeft);
        if (secondsLeft === 0) setTimeout(() => setCount(null), 800);
      }),
      events.subscribe('race/started', ({ totalLaps: n }) => setTotalLaps(n)),
      events.subscribe('race/lapCompleted', ({ lap: done, totalLaps: n }) => setLap(Math.min(done + 1, n))),
      events.subscribe('race/finished', ({ totalMs }) => setFinishedMs(totalMs)),
      // Drive the timer text imperatively at the physics-tick cadence (no re-render).
      events.subscribe('vehicle/stateUpdated', () => {
        if (timerRef.current) timerRef.current.textContent = formatMs(game.race?.totalMs ?? 0);
      }),
    ];
    return () => subs.forEach((off) => off());
  }, [game]);

  const myIndex = racePositions.findIndex((p) => p.sessionId === localId);
  const position = isMultiplayer && racePositions.length > 1 && myIndex >= 0 ? myIndex + 1 : null;

  return (
    <>
      {count !== null && <div className="race-countdown">{count > 0 ? count : '¡YA!'}</div>}

      <div className="race-hud">
        <span className="race-lap">
          Vuelta {lap}/{totalLaps}
        </span>
        <span className="race-timer" ref={timerRef}>
          0:00.0
        </span>
        {position !== null && (
          <span className="race-pos">
            P{position}/{racePositions.length}
          </span>
        )}
      </div>

      {finishedMs !== null && (
        <div className="race-finish">
          <h2>¡Terminaste!</h2>
          <p className="race-finish-time">{formatMs(finishedMs)}</p>
          {isMultiplayer && racePositions.length > 1 && (
            <ol className="race-standings">
              {racePositions.map((p, i) => (
                <li key={p.sessionId} className={p.sessionId === localId ? 'is-me' : undefined}>
                  <span>
                    {i + 1}. {p.name}
                    {p.sessionId === localId ? ' (tú)' : ''}
                  </span>
                  <span>{p.finished ? formatMs(p.finishMs) : '—'}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
