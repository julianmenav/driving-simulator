import { useEffect, useRef, useState } from 'react';
import type { Game } from '@application/createGame';
import type { RemoteTransform } from '@application/ports/NetworkPort';
import { RemoteVehicle } from './RemoteVehicle';

/**
 * Spawns/despawns one `RemoteVehicle` per connected remote player, driven off
 * the bus (`net/playerJoined`/`net/playerLeft`). The id list is occasional
 * React state (not per-frame) — same reasoning as the infraction banner. A
 * pose arriving for an unseen id also adds it, so join-vs-pose ordering never
 * matters. First-pose-per-id is stashed in a ref for the spawn position.
 */
export function RemoteVehicles({ game }: { game: Game }) {
  const [ids, setIds] = useState<string[]>([]);
  const initial = useRef(new Map<string, RemoteTransform>());

  useEffect(() => {
    const add = (id: string) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    const subscriptions = [
      game.events.subscribe('net/playerJoined', ({ id }) => add(id)),
      game.events.subscribe('net/playerLeft', ({ id }) => setIds((prev) => prev.filter((x) => x !== id))),
      game.events.subscribe('net/remoteTransform', (transform) => {
        if (!initial.current.has(transform.id)) {
          initial.current.set(transform.id, transform);
          add(transform.id);
        }
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [game.events]);

  return (
    <>
      {ids.map((id) => (
        <RemoteVehicle key={id} game={game} id={id} initial={initial.current.get(id)} />
      ))}
    </>
  );
}
