import { useEffect, useRef, useState } from 'react';
import type { Game } from '@application/createGame';
import type { Gear } from '@domain/vehicle/Gear';

const GEARS: Gear[] = ['D', 'N', 'R'];

/**
 * Pantalla provisional del paso 1: demuestra el event bus de extremo a
 * extremo (UI publica cambios de marcha y un log los recibe vía
 * subscribeAll). Se sustituirá por la escena 3D en el paso 2.
 */
export function App({ game }: { game: Game }) {
  const [gear, setGear] = useState<Gear>('N');
  const [log, setLog] = useState<string[]>([]);
  const gearRef = useRef(gear);
  gearRef.current = gear;

  useEffect(() => {
    return game.events.subscribeAll((type, payload) => {
      setLog((lines) => [...lines.slice(-9), `${type} ${JSON.stringify(payload)}`]);
    });
  }, [game]);

  const changeGear = (next: Gear) => {
    if (next === gearRef.current) return;
    game.events.publish('vehicle/gearChanged', { previous: gearRef.current, current: next });
    setGear(next);
  };

  return (
    <main className="app">
      <h1>Simulador de conducción</h1>
      <p>Fase 1 · paso 1 — esqueleto y event bus</p>

      <div className="gears">
        {GEARS.map((g) => (
          <button key={g} className={g === gear ? 'active' : ''} onClick={() => changeGear(g)}>
            {g}
          </button>
        ))}
      </div>

      <section className="event-log">
        <h2>Eventos de dominio</h2>
        {log.length === 0 ? (
          <p className="empty">Cambia de marcha para publicar un evento.</p>
        ) : (
          <ol>
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
