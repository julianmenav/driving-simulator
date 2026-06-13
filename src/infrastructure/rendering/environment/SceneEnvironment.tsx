import { Sky, Stars } from '@react-three/drei';
import { Glow } from './Glow';
import { usePreset } from './environmentStore';
import type { EnvironmentPreset } from './presets';

/**
 * Renders the whole environment (background, fog, key + fill light and the sky
 * backdrop) from the active preset. Swapping the day/night phase swaps every
 * value here at once, so the lighting stays internally consistent.
 *
 * Lives on layer 0 (the world), so the moon and stars show up in the mirrors.
 */
export function SceneEnvironment() {
  const preset = usePreset();
  return (
    <>
      <color attach="background" args={[preset.background]} />
      <fog attach="fog" args={[preset.fog.color, preset.fog.near, preset.fog.far]} />

      <hemisphereLight
        args={[preset.hemisphere.sky, preset.hemisphere.ground, preset.hemisphere.intensity]}
      />
      <directionalLight
        castShadow
        position={preset.sun.position}
        color={preset.sun.color}
        intensity={preset.sun.intensity}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={200}
      />

      {preset.sky === 'day' ? (
        <Sky sunPosition={preset.sun.position} />
      ) : (
        <>
          <Stars radius={320} depth={80} count={3500} factor={6} saturation={0} fade speed={0} />
          <Moon preset={preset} />
        </>
      )}
    </>
  );
}

/** A glowing moon placed far along the key-light direction, so it sits where the moonlight comes from. */
function Moon({ preset }: { preset: EnvironmentPreset }) {
  const [x, y, z] = preset.sun.position;
  const length = Math.hypot(x, y, z) || 1;
  const distance = 300;
  const position: [number, number, number] = [(x / length) * distance, (y / length) * distance, (z / length) * distance];
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[13, 32, 32]} />
        <meshBasicMaterial color="#eef2ff" toneMapped={false} fog={false} />
      </mesh>
      <Glow color="#cdd8f6" size={70} opacity={0.8} />
    </group>
  );
}
