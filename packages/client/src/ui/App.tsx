import { useMemo } from 'react';
import type { ControlsPort } from '@application/ports/ControlsPort';
import type { MapRepository } from '@application/ports/MapRepository';
import type { NetworkPort } from '@application/ports/NetworkPort';
import { ColyseusNetworkAdapter } from '@infrastructure/networking/ColyseusNetworkAdapter';
import { GameView } from './GameView';
import { Lobby } from './Lobby';
import { MultiplayerMenu } from './MultiplayerMenu';
import { useMultiplayerStore } from './multiplayerStore';
import { StartMenu } from './StartMenu';
import { useSessionStore } from './sessionStore';

/**
 * Top-level flow. Single-player: start menu → game. Multiplayer: start menu →
 * multiplayer menu → lobby → game (mounted when the host starts the race). The
 * `network` prop is the optional dev loopback (?ghost); a multiplayer race uses
 * the Colyseus adapter built from the connected room instead.
 */
export function App({
  controls,
  mapRepository,
  network,
}: {
  controls: ControlsPort;
  mapRepository: MapRepository;
  network?: NetworkPort;
}) {
  const sessionStatus = useSessionStore((s) => s.status);
  const sessionConfig = useSessionStore((s) => s.config);

  const mpStatus = useMultiplayerStore((s) => s.status);
  const mpRoom = useMultiplayerStore((s) => s.room);
  const mpConfig = useMultiplayerStore((s) => s.config);
  const mpPlayers = useMultiplayerStore((s) => s.players);
  const mpLocalId = useMultiplayerStore((s) => s.localId);

  // One adapter per connected room; rebuilt only when the room changes.
  const mpNetwork = useMemo(() => (mpRoom ? new ColyseusNetworkAdapter(mpRoom) : undefined), [mpRoom]);
  const seat = mpPlayers.find((p) => p.sessionId === mpLocalId)?.seat ?? 0;

  let content;
  if (mpStatus === 'racing' && mpConfig && mpNetwork) {
    content = (
      <GameView
        controls={controls}
        mapRepository={mapRepository}
        network={mpNetwork}
        config={mpConfig}
        spawnIndex={seat}
      />
    );
  } else if (mpStatus === 'menu' || mpStatus === 'connecting' || mpStatus === 'error') {
    content = <MultiplayerMenu mapRepository={mapRepository} />;
  } else if (mpStatus === 'lobby') {
    content = <Lobby />;
  } else if (sessionStatus === 'playing' && sessionConfig) {
    content = <GameView controls={controls} mapRepository={mapRepository} network={network} config={sessionConfig} />;
  } else {
    content = <StartMenu mapRepository={mapRepository} />;
  }

  return <div className="app-root">{content}</div>;
}
