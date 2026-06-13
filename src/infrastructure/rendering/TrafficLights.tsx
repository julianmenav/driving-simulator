import { useEffect, useState } from 'react';
import type { Game } from '@application/createGame';
import type { TrafficLightSpec } from '@domain/map/MapManifest';
import { elevationAt } from '@domain/map/elevation';
import type { TrafficColor } from '@domain/traffic/TrafficSignals';
import { Glow } from './environment/Glow';
import { useLightsOn } from './environment/environmentStore';

const LAMP = {
  red: { y: 1.0, on: '#ff3b30' },
  amber: { y: 0.7, on: '#ffb300' },
  green: { y: 0.4, on: '#36d05a' },
} as const;
const OFF = '#1b1d22';

/** All traffic lights in the map, each coloured by the live signal state. */
export function TrafficLights({ game }: { game: Game }) {
  return (
    <>
      {game.map.trafficLights.map((light) => (
        <Light key={light.id} game={game} light={light} />
      ))}
    </>
  );
}

function Light({ game, light }: { game: Game; light: TrafficLightSpec }) {
  const [color, setColor] = useState<TrafficColor>(game.signals.colorOf(light.id));
  const lightsOn = useLightsOn();

  useEffect(() => {
    return game.events.subscribe('traffic/lightChanged', ({ id, color: c }) => {
      if (id === light.id) setColor(c);
    });
  }, [game, light.id]);

  // Face the housing toward oncoming traffic (opposite the direction of travel).
  const facing = light.axis === 'z' ? -light.travelSign : 0;
  const rotY = light.axis === 'z' ? (facing > 0 ? 0 : Math.PI) : light.travelSign > 0 ? -Math.PI / 2 : Math.PI / 2;

  const baseY = elevationAt(game.map.terrain, light.x, light.z);
  return (
    <group position={[light.x, baseY, light.z]} rotation-y={rotY}>
      {/* Pole */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 4.8, 8]} />
        <meshStandardMaterial color="#2b2f36" />
      </mesh>
      {/* Housing + three lamps stacked red/amber/green. */}
      <group position={[0, 4.0, 0.15]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 1.0, 0.25]} />
          <meshStandardMaterial color="#15171b" />
        </mesh>
        {(Object.keys(LAMP) as TrafficColor[]).map((c) => {
          const lit = c === color;
          return (
            <group key={c}>
              <mesh position={[0, LAMP[c].y - 0.7, 0.16]}>
                <sphereGeometry args={[0.13, 16, 16]} />
                <meshStandardMaterial
                  color={lit ? LAMP[c].on : OFF}
                  emissive={lit ? LAMP[c].on : '#000000'}
                  emissiveIntensity={lit ? (lightsOn ? 2.4 : 1.4) : 0}
                />
              </mesh>
              {lit && lightsOn && (
                <Glow position={[0, LAMP[c].y - 0.7, 0.3]} color={LAMP[c].on} size={1.0} opacity={0.9} />
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
}
