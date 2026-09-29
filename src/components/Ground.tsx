import type { ModelBounds } from '../types'

type GroundProps = {
  bounds: ModelBounds
}

export function Ground({ bounds }: GroundProps) {
  const [width, , depth] = bounds.size
  const planeSize = Math.max(width, depth, bounds.radius * 2) * 7
  const floorY = bounds.minY - bounds.radius * 0.035

  return (
    <mesh
      name="Neutral ground"
      position={[0, floorY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshStandardMaterial color="#77736b" metalness={0} roughness={0.72} />
    </mesh>
  )
}
