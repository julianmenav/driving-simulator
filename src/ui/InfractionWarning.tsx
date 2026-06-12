import { useEffect, useState } from 'react';
import type { Game } from '@application/createGame';

/** How long a warning stays on screen after the infraction (ms). */
const WARNING_DURATION_MS = 3000;

/**
 * Transient on-screen warning when an infraction is committed. Infractions are
 * occasional events (not per-frame), so plain React state with a timeout is
 * fine here — the per-frame golden rule does not apply.
 */
export function InfractionWarning({ game }: { game: Game }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = game.events.subscribe('infraction/committed', ({ infraction }) => {
      if (infraction.type === 'speeding') {
        setMessage(`Exceso de velocidad · límite ${infraction.limitKmh} km/h`);
      }
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), WARNING_DURATION_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [game]);

  if (!message) return null;
  return (
    <div className="infraction-warning" role="alert">
      ⚠ {message}
    </div>
  );
}
