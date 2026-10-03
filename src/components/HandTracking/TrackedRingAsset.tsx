import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

type TrackedRingAssetProps = {
  url: string
}

export function TrackedRingAsset({ url }: TrackedRingAssetProps) {
  const gltf = useGLTF(url)
  const normalized = useMemo(() => {
    const model = gltf.scene.clone(true)
    model.updateWorldMatrix(true, true)

    // Asset convention: Band lies in XY, the finger/hole axis is local +Z,
    // and the gemstone is on local +Y. Use the band rather than the complete
    // jeweled bounds so the tracking origin stays at the center of the hole.
    const band = model.getObjectByName('Band') ?? model
    const bandBounds = new THREE.Box3().setFromObject(band)
    const bandCenter = bandBounds.getCenter(new THREE.Vector3())
    const bandSize = bandBounds.getSize(new THREE.Vector3())
    const bandDiameter = Math.max(bandSize.x, bandSize.y, Number.EPSILON)

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.renderOrder = 10
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      materials.forEach((material) => {
        material.depthTest = true
      })
      object.frustumCulled = false
    })

    return { model, bandCenter, bandDiameter }
  }, [gltf.scene])

  return (
    <group scale={1 / normalized.bandDiameter}>
      <primitive
        object={normalized.model}
        position={normalized.bandCenter.clone().multiplyScalar(-1)}
        dispose={null}
      />
    </group>
  )
}
