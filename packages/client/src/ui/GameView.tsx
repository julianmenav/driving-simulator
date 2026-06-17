import { useEffect, useState } from 'react';
import { createGame, type Game } from '@application/createGame';
import type { ControlsPort } from '@application/ports/ControlsPort';
import type { MapRepository } from '@application/ports/MapRepository';
import type { NetworkPort } from '@application/ports/NetworkPort';
import type { SessionConfig } from '@application/session';
import { findCarPreset } from '@domain/vehicle/carPresets';
import { SimulatorCanvas } from '@infrastructure/rendering/SimulatorCanvas';
import { useEnvironmentStore } from '@infrastructure/rendering/environment/environmentStore';
import { InfractionWarning } from './InfractionWarning';
import { useMultiplayerStore } from './multiplayerStore';
import { useSessionStore } from './sessionStore';

/**
 * The "playing" branch: composes a fresh game from the session config (chosen
 * map + car + mode + laps) and mounts the canvas. Building happens here, after
 * Play, so the heavy 3D/physics scene only exists while actually playing.
 */
export function GameView({
  controls,
  mapRepository,
  network,
  config,
  spawnIndex,
}: {
  controls: ControlsPort;
  mapRepository: MapRepository;
  network?: NetworkPort;
  config: SessionConfig;
  spawnIndex?: number;
}) {
  const quit = useSessionStore((s) => s.quit);
  const leaveRoom = useMultiplayerStore((s) => s.leave);
  const phase = useEnvironmentStore((s) => s.phase);
  const toggle = useEnvironmentStore((s) => s.toggle);

  // Back to the menu: also leave any multiplayer room (no-op in single-player).
  const exitToMenu = () => {
    leaveRoom();
    quit();
  };

  const [game, setGame] = useState<Game | null>(null);

  // Some maps (the circuit) are always night and hide the day/night toggle.
  const lockedNight = game?.map.lockedNight ?? false;
  useEffect(() => {
    if (lockedNight) useEnvironmentStore.getState().setPhase('night');
  }, [lockedNight]);

  useEffect(() => {
    let alive = true;
    let created: Game | null = null;
    setGame(null);
    mapRepository.load(config.mapId).then((map) => {
      if (!alive) return;
      const { spec } = findCarPreset(config.carId);
      created = createGame({
        controls,
        map,
        vehicleSpec: spec,
        mode: config.mode,
        laps: config.laps,
        network,
        spawnIndex,
      });
      setGame(created);
    });
    return () => {
      alive = false;
      created?.dispose();
    };
  }, [controls, mapRepository, network, config, spawnIndex]);

  if (!game) {
    return (
      <div className="loading-root">
        <p>Cargando…</p>
      </div>
    );
  }

  return (
    <>
      <SimulatorCanvas game={game} />
      <InfractionWarning game={game} />
      <div className="overlay">
        <p>
          <kbd>W</kbd>/<kbd>↑</kbd> acelerar · <kbd>S</kbd>/<kbd>↓</kbd> frenar · <kbd>A</kbd>/<kbd>D</kbd> dirección ·{' '}
          <kbd>E</kbd>/<kbd>Q</kbd> marcha (R·N·D)
        </p>
      </div>
      <div className="game-buttons">
        {!lockedNight && (
          <button className="env-toggle" onClick={toggle} title="Cambiar día/noche">
            {phase === 'night' ? '☀️ Día' : '🌙 Noche'}
          </button>
        )}
        <button className="env-toggle" onClick={exitToMenu} title="Volver al menú">
          ☰ Menú
        </button>
      </div>
    </>
  );
}
