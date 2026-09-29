import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ModelBounds } from '../types'

type RingModelProps = {
  url: string
  onBounds: (bounds: ModelBounds) => void
}

function describeMaterial(material: THREE.Material) {
  const pbr = material as THREE.MeshStandardMaterial &
    Partial<THREE.MeshPhysicalMaterial>

  return {
    name: material.name || '(unnamed)',
    type: material.type,
    metalness: pbr.metalness,
    roughness: pbr.roughness,
    transmission: pbr.transmission,
    ior: pbr.ior,
    thickness: pbr.thickness,
    attenuationDistance: pbr.attenuationDistance,
    dispersion: pbr.dispersion,
    hasBaseColorMap: Boolean(pbr.map),
    hasMetalnessMap: Boolean(pbr.metalnessMap),
    hasRoughnessMap: Boolean(pbr.roughnessMap),
    hasNormalMap: Boolean(pbr.normalMap),
  }
}

export function RingModel({ url, onBounds }: RingModelProps) {
  const gltf = useGLTF(url)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useLayoutEffect(() => {
    const sourceBounds = new THREE.Box3().setFromObject(model)
    if (sourceBounds.isEmpty()) {
      throw new Error('The GLB loaded, but it does not contain visible geometry.')
    }

    const center = sourceBounds.getCenter(new THREE.Vector3())
    model.position.sub(center)
    model.updateWorldMatrix(true, true)

    const centeredBounds = new THREE.Box3().setFromObject(model)
    const size = centeredBounds.getSize(new THREE.Vector3())
    const sphere = centeredBounds.getBoundingSphere(new THREE.Sphere())

    const materials = new Set<THREE.Material>()
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const meshMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      meshMaterials.forEach((material) => materials.add(material))
    })

    console.groupCollapsed(
      `[GLB viewer] Loaded ${model.name || 'ring.glb'} (${materials.size} materials)`,
    )
    console.log('Asset metadata', gltf.asset)
    const resourceTiming = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith(url))
      .at(-1)
    console.log(
      'Model transfer/load time',
      resourceTiming ? `${resourceTiming.duration.toFixed(1)} ms` : 'Unavailable',
    )
    console.log('Model dimensions', size.toArray())
    console.table([...materials].map(describeMaterial))
    console.groupEnd()

    onBounds({
      size: size.toArray(),
      radius: Math.max(sphere.radius, Number.EPSILON),
      minY: centeredBounds.min.y,
    })
  }, [gltf.asset, model, onBounds, url])

  return <primitive object={model} dispose={null} />
}
