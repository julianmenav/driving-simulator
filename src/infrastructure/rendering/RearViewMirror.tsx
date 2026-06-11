import { useFBO } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type Group, PerspectiveCamera as ThreePerspectiveCamera, RepeatWrapping } from 'three';

interface RearViewMirrorProps {
  /** Position in chassis local space. */
  position: [number, number, number];
  width: number;
  height: number;
  /** Mirror tilt towards the driver (rad about Y). */
  tilt?: number;
  /** Rear camera orientation (rad about Y; positive looks to the right side). */
  cameraYaw?: number;
  /** Rear camera pitch (rad about X; negative looks down at the road). */
  cameraPitch?: number;
  fov?: number;
  /** Frame offset to spread the cost across mirrors. */
  phase?: number;
}

/** Each mirror refreshes one frame out of every N (half framerate with N=2). */
const REFRESH_INTERVAL = 2;
const FBO_WIDTH = 384;

/**
 * Rear-view mirror: a plane showing the scene rendered from a rear-facing
 * camera (chassis local -z), drawn into a low-resolution render target. The
 * texture is flipped in X because a mirror reflects.
 */
export function RearViewMirror({
  position,
  width,
  height,
  tilt = 0,
  cameraYaw = 0,
  cameraPitch = 0,
  fov = 35,
  phase = 0,
}: RearViewMirrorProps) {
  const aspect = width / height;
  const fbo = useFBO(FBO_WIDTH, Math.round(FBO_WIDTH / aspect));
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const displayRef = useRef<Group>(null);
  const frameCount = useRef(phase);

  useEffect(() => {
    fbo.texture.wrapS = RepeatWrapping;
    fbo.texture.repeat.x = -1;
    fbo.texture.offset.x = 1;
  }, [fbo]);

  // The mirror surface lives on layer 1 (seen by the first-person camera, not
  // by other mirror cameras) so mirrors never show up inside each other.
  useEffect(() => {
    displayRef.current?.traverse((o) => o.layers.set(1));
  }, []);

  useFrame(({ gl, scene }) => {
    frameCount.current += 1;
    if (frameCount.current % REFRESH_INTERVAL !== 0) return;
    const camera = cameraRef.current;
    if (!camera) return;
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  return (
    <group position={position}>
      <group ref={displayRef} rotation-y={tilt}>
        <mesh>
          <boxGeometry args={[width + 0.05, height + 0.05, 0.025]} />
          <meshStandardMaterial color="#101216" />
        </mesh>
        {/* The plane faces +z after rotating π: towards the driver */}
        <mesh position-z={-0.015} rotation-y={Math.PI}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={fbo.texture} toneMapped={false} />
        </mesh>
      </group>
      {/* Rear camera: by default looks at -z, the back of the car */}
      <perspectiveCamera
        ref={cameraRef}
        fov={fov}
        aspect={aspect}
        near={0.2}
        far={300}
        rotation={[cameraPitch, cameraYaw, 0]}
        onUpdate={(self) => self.updateProjectionMatrix()}
      />
    </group>
  );
}
