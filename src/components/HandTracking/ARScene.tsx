import { Environment } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { landmarkFingerOcclusionSource } from '../../handTracking/handOcclusion'
import type { ARRingPose } from '../../handTracking/poseToThreeTransform'
import { FingerOccluder } from './FingerOccluder'
import { TrackedRingAsset } from './TrackedRingAsset'

export type ARSceneSettings = {
  showRing: boolean
  showPoseAxes: boolean
  showOccluder: boolean
  poseSmoothing: number
  fingerRadius: number
}

type ARSceneProps = {
  poseRef: RefObject<ARRingPose | null>
  modelUrl: string
  environmentUrl: string
  modelAvailable: boolean
  environmentAvailable: boolean
  width: number
  height: number
  mirrored: boolean
  settings: ARSceneSettings
}

const TRACKING_GRACE_MS = 120

function ARCameraProjection({ width, height }: { width: number; height: number }) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.near = 0.1
    camera.far = 2_000
    camera.position.set(0, 0, 1_000)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, height, width])

  return null
}

function ARTrackedObjects({
  poseRef,
  modelUrl,
  modelAvailable,
  settings,
}: Pick<
  ARSceneProps,
  'poseRef' | 'modelUrl' | 'modelAvailable' | 'settings'
>) {
  const trackedRoot = useRef<THREE.Group>(null)
  const ringScaleRoot = useRef<THREE.Group>(null)
  const rawAxes = useRef<THREE.Group>(null)
  const occluder = useRef<THREE.Group>(null)
  const initialized = useRef(false)
  const currentScale = useRef(1)
  const currentFingerLength = useRef(1)
  const currentFingerOffset = useRef(0)
  const currentFingerDiameter = useRef(1)

  useFrame((_, delta) => {
    const root = trackedRoot.current
    const ringRoot = ringScaleRoot.current
    const axes = rawAxes.current
    const proxy = occluder.current
    if (!root || !ringRoot || !axes || !proxy) return

    const pose = poseRef.current
    const tracked = Boolean(
      pose && performance.now() - pose.timestamp <= TRACKING_GRACE_MS,
    )

    root.visible = tracked && (settings.showRing || settings.showOccluder)
    axes.visible = tracked && settings.showPoseAxes
    if (!pose || !tracked) {
      initialized.current = false
      return
    }

    axes.position.copy(pose.position)
    axes.quaternion.copy(pose.orientation)
    axes.scale.setScalar(pose.scale)

    const occlusion = landmarkFingerOcclusionSource.getFrame(pose).fingerProxy
    const targetLength = occlusion
      ? occlusion.length
      : 1
    const targetOffset = occlusion
      ? occlusion.centerOffset
      : 0

    if (!initialized.current) {
      root.position.copy(pose.position)
      root.quaternion.copy(pose.orientation)
      currentScale.current = pose.scale
      currentFingerLength.current = targetLength
      currentFingerOffset.current = targetOffset
      currentFingerDiameter.current = pose.fingerDiameter
      initialized.current = true
    } else {
      const retention = Math.min(Math.max(settings.poseSmoothing, 0), 0.98)
      const follow = 1 - Math.pow(retention, delta * 60)
      root.position.lerp(pose.position, follow)
      root.quaternion.slerp(pose.orientation, follow)
      currentScale.current = THREE.MathUtils.lerp(
        currentScale.current,
        pose.scale,
        follow,
      )
      currentFingerLength.current = THREE.MathUtils.lerp(
        currentFingerLength.current,
        targetLength,
        follow,
      )
      currentFingerOffset.current = THREE.MathUtils.lerp(
        currentFingerOffset.current,
        targetOffset,
        follow,
      )
      currentFingerDiameter.current = THREE.MathUtils.lerp(
        currentFingerDiameter.current,
        pose.fingerDiameter,
        follow,
      )
    }

    root.scale.setScalar(1)
    ringRoot.scale.setScalar(currentScale.current)
    proxy.visible = settings.showRing || settings.showOccluder
    proxy.position.z = currentFingerOffset.current
    proxy.scale.set(
      currentFingerDiameter.current * settings.fingerRadius,
      currentFingerLength.current,
      currentFingerDiameter.current * settings.fingerRadius,
    )
  })

  return (
    <>
      <group ref={trackedRoot} visible={false}>
        <group ref={ringScaleRoot} visible={settings.showRing}>
          {modelAvailable && <TrackedRingAsset url={modelUrl} />}
        </group>
        <FingerOccluder ref={occluder} debug={settings.showOccluder} />
      </group>
      <group ref={rawAxes} visible={false}>
        <axesHelper args={[0.8]} />
      </group>
    </>
  )
}

export function ARScene({
  poseRef,
  modelUrl,
  environmentUrl,
  modelAvailable,
  environmentAvailable,
  width,
  height,
  mirrored,
  settings,
}: ARSceneProps) {
  return (
    <Canvas
      className={`hand-ar-canvas${mirrored ? ' is-mirrored' : ''}`}
      style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      orthographic
      dpr={[1, 2]}
      camera={{
        position: [0, 0, 1_000],
        near: 0.1,
        far: 2_000,
        left: -width / 2,
        right: width / 2,
        top: height / 2,
        bottom: -height / 2,
        // Ring poses use source-video pixels. Without a manual camera, R3F
        // rewrites this frustum from the canvas's CSS size on every resize,
        // which breaks alignment most visibly for portrait video.
        manual: true,
      }}
      gl={{
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0)
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1
        gl.transmissionResolutionScale = 0.75
        scene.background = null
      }}
    >
      <ARCameraProjection width={width} height={height} />
      <Suspense fallback={null}>
        {environmentAvailable && (
          <Environment
            files={environmentUrl}
            background={false}
            environmentIntensity={1}
            resolution={512}
          />
        )}
        {!environmentAvailable && <ambientLight intensity={1.5} />}
        <ARTrackedObjects
          poseRef={poseRef}
          modelUrl={modelUrl}
          modelAvailable={modelAvailable}
          settings={settings}
        />
      </Suspense>
    </Canvas>
  )
}
