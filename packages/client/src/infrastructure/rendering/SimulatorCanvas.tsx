import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import type { Game } from '@application/createGame';
import { CityMap } from './CityMap';
import { SceneEnvironment } from './environment/SceneEnvironment';
import { PlayerVehicle } from '@infrastructure/vehicle/PlayerVehicle';
import { RemoteVehicles } from '@infrastructure/vehicle/RemoteVehicles';
import { TrafficCars } from '@infrastructure/vehicle/TrafficCars';

export function SimulatorCanvas({ game }: { game: Game }) {
  return (
    <Canvas shadows>
      {/* Background, fog, sky and the key/fill lights all come from the active
          day/night preset, so the whole scene stays visually consistent. */}
      <SceneEnvironment />
      <Suspense fallback={null}>
        <Physics>
          <CityMap game={game} />
          <PlayerVehicle game={game} />
          <TrafficCars game={game} />
          <RemoteVehicles game={game} />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
