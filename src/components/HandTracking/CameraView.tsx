import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ARRingPose } from '../../handTracking/poseToThreeTransform'
import { ARScene, type ARSceneSettings } from './ARScene'
import { HandLandmarkOverlay } from './HandLandmarkOverlay'
import { SceneErrorBoundary } from '../SceneErrorBoundary'

type CameraViewProps = {
  stageRef: RefObject<HTMLDivElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
  mirrored: boolean
  arPoseRef: RefObject<ARRingPose | null>
  modelUrl: string
  environmentUrl: string
  modelAvailable: boolean
  environmentAvailable: boolean
  arAvailable: boolean
  arSettings: ARSceneSettings
}

type StageSize = {
  width: number
  height: number
}

export function CameraView({
  stageRef,
  videoRef,
  canvasRef,
  width,
  height,
  mirrored,
  arPoseRef,
  modelUrl,
  environmentUrl,
  modelAvailable,
  environmentAvailable,
  arAvailable,
  arSettings,
}: CameraViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateStageSize = () => {
      const availableWidth = viewport.clientWidth
      const availableHeight = viewport.clientHeight
      const aspectRatio = width / height

      let fittedWidth = availableWidth
      let fittedHeight = fittedWidth / aspectRatio
      if (fittedHeight > availableHeight) {
        fittedHeight = availableHeight
        fittedWidth = fittedHeight * aspectRatio
      }

      setStageSize({
        width: Math.max(1, Math.floor(fittedWidth)),
        height: Math.max(1, Math.floor(fittedHeight)),
      })
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [height, width])

  const mirrorClass = mirrored ? ' is-mirrored' : ''

  return (
    <div className="hand-camera-viewport" ref={viewportRef}>
      <div
        className="hand-camera-stage"
        ref={stageRef}
        style={{ width: stageSize.width, height: stageSize.height }}
      >
        <video
          ref={videoRef}
          className={`hand-camera-video${mirrorClass}`}
          autoPlay
          playsInline
          muted
        />
        {arAvailable && (
          <SceneErrorBoundary
            fallback={
              <div className="hand-ar-error" role="alert">
                AR ring rendering unavailable
              </div>
            }
          >
            <ARScene
              poseRef={arPoseRef}
              modelUrl={modelUrl}
              environmentUrl={environmentUrl}
              modelAvailable={modelAvailable}
              environmentAvailable={environmentAvailable}
              width={width}
              height={height}
              mirrored={mirrored}
              settings={arSettings}
            />
          </SceneErrorBoundary>
        )}
        <HandLandmarkOverlay
          canvasRef={canvasRef}
          width={width}
          height={height}
          mirrored={mirrored}
        />
      </div>
    </div>
  )
}
