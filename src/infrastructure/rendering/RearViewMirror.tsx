import { useFBO } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera as ThreePerspectiveCamera, RepeatWrapping } from 'three';

interface RearViewMirrorProps {
  /** Posición en el espacio local del chasis. */
  position: [number, number, number];
  width: number;
  height: number;
  /** Giro del espejo hacia el conductor (rad sobre Y). */
  tilt?: number;
  /** Orientación de la cámara trasera (rad sobre Y; positivo mira al lado derecho). */
  cameraYaw?: number;
  fov?: number;
  /** Desfase de frame para repartir el coste entre espejos. */
  phase?: number;
}

/** Cada espejo se refresca un frame de cada N (mitad del framerate con N=2). */
const REFRESH_INTERVAL = 2;
const FBO_WIDTH = 384;

/**
 * Retrovisor: un plano con la escena renderizada desde una cámara que mira
 * hacia atrás (-z local del chasis), volcada a un render target de baja
 * resolución. La textura se invierte en X porque un espejo refleja.
 */
export function RearViewMirror({
  position,
  width,
  height,
  tilt = 0,
  cameraYaw = 0,
  fov = 35,
  phase = 0,
}: RearViewMirrorProps) {
  const aspect = width / height;
  const fbo = useFBO(FBO_WIDTH, Math.round(FBO_WIDTH / aspect));
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const frameCount = useRef(phase);

  useEffect(() => {
    fbo.texture.wrapS = RepeatWrapping;
    fbo.texture.repeat.x = -1;
    fbo.texture.offset.x = 1;
  }, [fbo]);

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
      <group rotation-y={tilt}>
        <mesh>
          <boxGeometry args={[width + 0.05, height + 0.05, 0.025]} />
          <meshStandardMaterial color="#101216" />
        </mesh>
        {/* El plano mira a +z tras rotar π: hacia el conductor */}
        <mesh position-z={-0.015} rotation-y={Math.PI}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={fbo.texture} toneMapped={false} />
        </mesh>
      </group>
      {/* Cámara trasera: por defecto mira a -z, la zaga del coche */}
      <perspectiveCamera
        ref={cameraRef}
        fov={fov}
        aspect={aspect}
        near={0.2}
        far={300}
        rotation-y={cameraYaw}
        onUpdate={(self) => self.updateProjectionMatrix()}
      />
    </group>
  );
}
