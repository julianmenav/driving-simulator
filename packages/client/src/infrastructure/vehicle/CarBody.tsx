/**
 * Presentational car mesh (body + greenhouse + four wheels), parametrised by
 * half-extents and colour. Shared by the NPC traffic and the remote-player
 * cars so the silhouette stays consistent and there is one place to evolve it.
 * Layer 0 (the default), so these cars also show up in the mirrors.
 *
 * The local player's own exterior stays bespoke (animated wheels driven by the
 * suspension, headlights), so it does not use this component.
 */
export function CarBody({
  halfExtents: [hx, hy, hz],
  color,
  wheelRadius = 0.32,
  wheelWidth = 0.22,
}: {
  halfExtents: [number, number, number];
  color: string;
  wheelRadius?: number;
  wheelWidth?: number;
}) {
  const wheelZ = hz * 0.65;
  return (
    <>
      {/* Lower body */}
      <mesh castShadow>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Cabin / greenhouse */}
      <mesh castShadow position={[0, hy + 0.28, -0.15]}>
        <boxGeometry args={[hx * 1.7, 0.56, hz * 1.1]} />
        <meshStandardMaterial color="#20242b" />
      </mesh>
      {/* Wheels */}
      {[
        [hx, -hy, wheelZ],
        [-hx, -hy, wheelZ],
        [hx, -hy, -wheelZ],
        [-hx, -hy, -wheelZ],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 16]} />
          <meshStandardMaterial color="#15171c" />
        </mesh>
      ))}
    </>
  );
}
