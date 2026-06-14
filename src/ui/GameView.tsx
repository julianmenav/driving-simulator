import { useEffect, useState } from 'react';
import { createGame, type Game } from '@application/createGame';
import type { ControlsPort } from '@application/ports/ControlsPort';
import type { MapRepository } from '@application/ports/MapRepository';
import type { SessionConfig } from '@application/session';
import { findCarPreset } from '@domain/vehicle/carPresets';
import { SimulatorCanvas } from '@infrastructure/rendering/SimulatorCanvas';
import { useEnvironmentStore } from '@infrastructure/rendering/environment/environmentStore';
import { InfractionWarning } from './InfractionWarning';
import { useSessionStore } from './sessionStore';

/**
 * The "playing" branch: composes a fresh game from the session config (chosen
 * map + car + mode + laps) and mounts the canvas. Building happens here, after
 * Play, so the heavy 3D/physics scene only exists while actually playing.
 */
export function GameView({
  controls,
  mapRepository,
  config,
}: {
  controls: ControlsPort;
  mapRepository: MapRepository;
  config: SessionConfig;
}) {
  const quit = useSessionStore((s) => s.quit);
  const phase = useEnvironmentStore((s) => s.phase);
  const toggle = useEnvironmentStore((s) => s.toggle);

  const [game, setGame] = useState<Game | null>(null);

  // Some maps (the circuit) are always night and hide the day/night toggle.
  const lockedNight = game?.map.lockedNight ?? false;
  useEffect(() => {
    if (lockedNight) useEnvironmentStore.getState().setPhase('night');
  }, [lockedNight]);

  useEffect(() => {
    let alive = true;
    setGame(null);
    mapRepository.load(config.mapId).then((map) => {
      if (!alive) return;
      const { spec } = findCarPreset(config.carId);
      setGame(
        createGame({
          controls,
          map,
          vehicleSpec: spec,
          mode: config.mode,
          laps: config.laps,
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [controls, mapRepository, config]);

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
        <button className="env-toggle" onClick={quit} title="Volver al menú">
          ☰ Menú
        </button>
      </div>
    </>
  );
}
