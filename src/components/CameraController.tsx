import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ModelBounds } from '../types'

type CameraControllerProps = {
  bounds: ModelBounds | null
  resetToken: number
}

export function CameraController({ bounds, resetToken }: CameraControllerProps) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const size = useThree((state) => state.size)
  const controls = useRef<OrbitControlsImpl>(null)

  useEffect(() => {
    if (!bounds || !controls.current) return

    const [width, height, depth] = bounds.size
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1)
    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const heightDistance = height / (2 * Math.tan(verticalFov / 2))
    const widthDistance = width / (2 * Math.tan(verticalFov / 2) * aspect)
    const distance = Math.max(heightDistance, widthDistance) * 1.35 + depth / 2
    const viewDirection = new THREE.Vector3(1, 0.55, 1).normalize()

    camera.near = Math.max(bounds.radius / 500, 0.00001)
    camera.far = Math.max(bounds.radius * 100, distance * 20)
    camera.position.copy(viewDirection.multiplyScalar(distance))
    camera.updateProjectionMatrix()

    controls.current.target.set(0, 0, 0)
    controls.current.minDistance = bounds.radius * 0.65
    controls.current.maxDistance = bounds.radius * 25
    controls.current.update()
  }, [bounds, camera, resetToken, size.height, size.width])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      enablePan
      screenSpacePanning
    />
  )
}
