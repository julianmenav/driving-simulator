import { Sky } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import type { Game } from '@application/createGame';
import { CityMap } from './CityMap';
import { PlayerVehicle } from '@infrastructure/vehicle/PlayerVehicle';
import { TrafficCars } from '@infrastructure/vehicle/TrafficCars';

export function SimulatorCanvas({ game }: { game: Game }) {
  return (
    <Canvas shadows>
      <Sky sunPosition={[80, 60, 100]} />
      <fog attach="fog" args={['#bcd2e3', 100, 400]} />
      <hemisphereLight args={['#bcd2e3', '#5d7052', 0.7]} />
      <directionalLight
        castShadow
        position={[40, 60, 25]}
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={200}
      />
      <Suspense fallback={null}>
        <Physics>
          <CityMap game={game} />
          <PlayerVehicle game={game} />
          <TrafficCars game={game} />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
