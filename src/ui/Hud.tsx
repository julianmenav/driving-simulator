import { useEffect, useRef, useState } from 'react';
import type { Game } from '@application/createGame';
import type { Gear } from '@domain/vehicle/Gear';

const GEARS: Gear[] = ['R', 'N', 'D'];

/**
 * Speedometer + gear indicator. Speed arrives at 60 Hz over the bus, so it
 * is written straight to the DOM (ref) to avoid re-rendering React on every
 * tick; the gear is state because it changes rarely.
 */
export function Hud({ game }: { game: Game }) {
  const speedRef = useRef<HTMLSpanElement>(null);
  const [gear, setGear] = useState<Gear>(game.gearbox.gear);

  useEffect(() => {
    const unsubscribeSpeed = game.events.subscribe('vehicle/stateUpdated', ({ speedKmh }) => {
      if (speedRef.current) speedRef.current.textContent = String(Math.round(Math.abs(speedKmh)));
    });
    const unsubscribeGear = game.events.subscribe('vehicle/gearChanged', ({ current }) => setGear(current));
    return () => {
      unsubscribeSpeed();
      unsubscribeGear();
    };
  }, [game]);

  return (
    <div className="hud">
      <div className="hud-speed">
        <span ref={speedRef}>0</span>
        <small>km/h</small>
      </div>
      <div className="hud-gears">
        {GEARS.map((g) => (
          <span key={g} className={g === gear ? 'active' : ''}>
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}
