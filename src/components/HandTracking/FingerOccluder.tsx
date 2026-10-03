import { forwardRef } from 'react'
import * as THREE from 'three'

type FingerOccluderProps = {
  debug: boolean
}

// The unit proxy is tapered from a 0.40 proximal radius to a 0.34 distal
// radius. Its parent scales it from the current hand estimate each frame.
export const FingerOccluder = forwardRef<THREE.Group, FingerOccluderProps>(
  function FingerOccluder({ debug }, ref) {
    return (
      <group ref={ref} rotation-x={Math.PI / 2}>
        <mesh renderOrder={-100}>
          <cylinderGeometry args={[0.34, 0.4, 1, 32, 1, false]} />
          <meshBasicMaterial
            colorWrite={false}
            depthWrite
            depthTest
            depthFunc={THREE.LessEqualDepth}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh visible={debug} renderOrder={100}>
          <cylinderGeometry args={[0.34, 0.4, 1, 32, 1, false]} />
          <meshBasicMaterial
            color="#00e5ff"
            opacity={0.38}
            transparent
            colorWrite
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    )
  },
)
