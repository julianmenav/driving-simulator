import { AdditiveBlending } from 'three';
import { haloTexture } from './glowTexture';

type Vec3 = [number, number, number];

/**
 * A soft additive halo around a light source, drawn as a camera-facing sprite.
 * Because it is a sprite it orients to whichever camera is rendering, so it
 * looks right in the first-person view and in the mirrors alike. Cheap enough
 * to put one on every lamp; the gradient comes from the shared halo texture.
 */
export function Glow({
  position = [0, 0, 0],
  color,
  size,
  opacity = 1,
}: {
  position?: Vec3;
  color: string;
  size: number;
  opacity?: number;
}) {
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial
        map={haloTexture()}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </sprite>
  );
}

/**
 * A pool of light cast on the ground beneath a lamp: a flat, ground-facing
 * additive disc. A cheap fake for real point-light illumination (which would
 * not scale to dozens of streetlights), and it scales to any number of lamps.
 */
export function LightPool({
  position,
  color,
  radius,
  opacity = 0.5,
}: {
  position: Vec3;
  color: string;
  radius: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={haloTexture()}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
