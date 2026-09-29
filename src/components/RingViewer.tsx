import { Stats } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ModelBounds, SnapshotRenderer } from '../types'
import { renderSnapshot } from '../rendering/snapshot'
import { CameraController } from './CameraController'
import { Ground } from './Ground'
import { RingModel } from './RingModel'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { StudioEnvironment } from './StudioEnvironment'

type RingViewerProps = {
  modelUrl: string
  environmentUrl: string
  modelAvailable: boolean
  environmentAvailable: boolean
  showEnvironment: boolean
  showGround: boolean
  showLights: boolean
  showStats: boolean
  environmentIntensity: number
  resetToken: number
  snapshotSize: number
  onSnapshotRenderer: (renderer: SnapshotRenderer | null) => void
}

function RendererSettings({ shadows }: { shadows: boolean }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    gl.shadowMap.enabled = shadows
    gl.shadowMap.needsUpdate = true
  }, [gl, shadows])

  return null
}

function SnapshotBridge({
  size,
  onReady,
}: {
  size: number
  onReady: (renderer: SnapshotRenderer | null) => void
}) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const snapshotRenderer: SnapshotRenderer = async (requestedSize) => {
      if (!(camera instanceof THREE.PerspectiveCamera)) {
        throw new Error('Snapshot export currently requires a perspective camera.')
      }
      await renderSnapshot({
        renderer: gl,
        scene,
        camera,
        size: requestedSize || size,
      })
    }
    onReady(snapshotRenderer)
    return () => onReady(null)
  }, [camera, gl, onReady, scene, size])

  return null
}

function LoadingIndicator() {
  const ring = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z -= delta * 1.8
  })

  return (
    <mesh ref={ring}>
      <torusGeometry args={[0.22, 0.012, 16, 80, Math.PI * 1.65]} />
      <meshBasicMaterial color="#d8bc85" toneMapped={false} />
    </mesh>
  )
}

export function RingViewer({
  modelUrl,
  environmentUrl,
  modelAvailable,
  environmentAvailable,
  showEnvironment,
  showGround,
  showLights,
  showStats,
  environmentIntensity,
  resetToken,
  snapshotSize,
  onSnapshotRenderer,
}: RingViewerProps) {
  const [bounds, setBounds] = useState<ModelBounds | null>(null)

  return (
    <SceneErrorBoundary>
      <Canvas
        dpr={[1, 2]}
        shadows={showLights ? 'soft' : false}
        camera={{ fov: 38, near: 0.01, far: 1_000, position: [0, 0, 5] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        fallback={
          <div className="viewer-message viewer-message--error" role="alert">
            WebGL2 could not be initialized on this device.
          </div>
        }
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
          gl.shadowMap.enabled = showLights
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          gl.transmissionResolutionScale = 1

          const context = gl.getContext()
          const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
          console.info('[GLB viewer] WebGL renderer', {
            threeRevision: THREE.REVISION,
            webgl2: gl.capabilities.isWebGL2,
            renderer: debugInfo
              ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
              : 'Unavailable',
            vendor: debugInfo
              ? context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
              : 'Unavailable',
            maxTextureSize: gl.capabilities.maxTextureSize,
            maxSamples: gl.capabilities.maxSamples,
          })
        }}
      >
        {!showEnvironment && <color attach="background" args={['#77736b']} />}
        <RendererSettings shadows={showLights} />

        <Suspense fallback={<LoadingIndicator />}>
          {environmentAvailable && (
            <StudioEnvironment
              url={environmentUrl}
              background={showEnvironment}
              intensity={environmentIntensity}
            />
          )}

          {modelAvailable && <RingModel url={modelUrl} onBounds={setBounds} />}

          {showGround && bounds && <Ground bounds={bounds} />}

          {showLights && bounds && (
            <>
              <directionalLight
                position={[bounds.radius * 3, bounds.radius * 5, bounds.radius * 2]}
                intensity={2.25}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={bounds.radius * 0.1}
                shadow-camera-far={bounds.radius * 12}
                shadow-camera-left={-bounds.radius * 2.5}
                shadow-camera-right={bounds.radius * 2.5}
                shadow-camera-top={bounds.radius * 2.5}
                shadow-camera-bottom={-bounds.radius * 2.5}
              />
              <pointLight
                position={[-bounds.radius * 2, bounds.radius, -bounds.radius * 2]}
                intensity={Math.max(bounds.radius * bounds.radius * 4, 0.5)}
              />
            </>
          )}
        </Suspense>

        <CameraController bounds={bounds} resetToken={resetToken} />
        <SnapshotBridge size={snapshotSize} onReady={onSnapshotRenderer} />
        {showStats && <Stats className="performance-stats" />}
      </Canvas>
    </SceneErrorBoundary>
  )
}
