import type { ControlsPort } from '@application/ports/ControlsPort';
import type { MapRepository } from '@application/ports/MapRepository';
import { GameView } from './GameView';
import { StartMenu } from './StartMenu';
import { useSessionStore } from './sessionStore';

/**
 * Top-level flow: the start menu collects the session config, then the game
 * mounts. The map is loaded (through the repository port) only after Play, so
 * the menu stays cheap and a future HTTP/glTF map source needs no UI change.
 */
export function App({
  controls,
  mapRepository,
}: {
  controls: ControlsPort;
  mapRepository: MapRepository;
}) {
  const status = useSessionStore((s) => s.status);
  const config = useSessionStore((s) => s.config);

  return (
    <div className="app-root">
      {status === 'playing' && config ? (
        <GameView controls={controls} mapRepository={mapRepository} config={config} />
      ) : (
        <StartMenu mapRepository={mapRepository} />
      )}
    </div>
  );
}
