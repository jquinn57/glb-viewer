import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
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
  zoom: number
  onZoomChange: (zoom: number) => void
}

type StageSize = {
  width: number
  height: number
}

export const MIN_CAMERA_ZOOM = 1
export const MAX_CAMERA_ZOOM = 3

function clampZoom(zoom: number) {
  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom))
}

function pointerDistance(points: Map<number, { x: number; y: number }>) {
  const [first, second] = Array.from(points.values())
  if (!first || !second) return null
  return Math.hypot(second.x - first.x, second.y - first.y)
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
  zoom,
  onZoomChange,
}: CameraViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
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

  const startPinchIfReady = () => {
    const distance = pointerDistance(touchPointsRef.current)
    pinchStartRef.current = distance ? { distance, zoom } : null
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return
    event.currentTarget.setPointerCapture(event.pointerId)
    touchPointsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (touchPointsRef.current.size === 2) startPinchIfReady()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!touchPointsRef.current.has(event.pointerId)) return
    touchPointsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    const pinchStart = pinchStartRef.current
    const distance = pointerDistance(touchPointsRef.current)
    if (!pinchStart || !distance) return

    event.preventDefault()
    onZoomChange(clampZoom(pinchStart.zoom * (distance / pinchStart.distance)))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    touchPointsRef.current.delete(event.pointerId)
    if (touchPointsRef.current.size >= 2) startPinchIfReady()
    else pinchStartRef.current = null
  }

  return (
    <div className="hand-camera-viewport" ref={viewportRef}>
      <div
        className="hand-camera-stage"
        ref={stageRef}
        style={{ width: stageSize.width, height: stageSize.height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className="hand-camera-content"
          style={{ transform: `scale(${zoom})` }}
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
    </div>
  )
}
