import { useEffect, useRef, useState } from 'react'
import {
  estimateRingGuide,
  getFingerMcpIndex,
  type RingFinger,
  type RingGuideListener,
  type RingGuideSettings,
} from '../../handTracking/ringGuide'
import { HandLandmarkSmoother } from '../../handTracking/landmarkSmoothing'
import {
  poseToThreeTransform,
  type ARRingPose,
} from '../../handTracking/poseToThreeTransform'
import { createHandLandmarker } from '../../mediapipe/handLandmarker'
import {
  createHandLandmarkRenderer,
  type HandOverlaySettings,
} from '../../mediapipe/drawHandLandmarks'
import type {
  HandResultListener,
  HandTrackingDebug,
} from '../../mediapipe/handLandmarkTypes'
import { CameraView } from './CameraView'
import type { ARSceneSettings } from './ARScene'

type FacingMode = 'environment' | 'user'

type SessionStatus =
  | { kind: 'initializing'; message: string }
  | { kind: 'requesting'; message: string }
  | { kind: 'active'; message: string }
  | { kind: 'error'; message: string }

type CameraResolution = {
  width: number
  height: number
}

type HandTrackingViewProps = {
  modelUrl: string
  environmentUrl: string
  modelAvailable: boolean
  environmentAvailable: boolean
  arAvailable: boolean
  onHandResult?: HandResultListener
  onSmoothedHandResult?: HandResultListener
  onRingGuide?: RingGuideListener
}

const INITIAL_DEBUG: HandTrackingDebug = {
  handDetected: false,
  handedness: null,
  handednessConfidence: null,
  inferenceFps: 0,
  selectedFingerMcp: null,
  ringGuideDiameter: null,
}

const INITIAL_RING_GUIDE: RingGuideSettings = {
  finger: 'ring',
  sizeScale: 1.4,
  positionOffset: 0,
}

const INITIAL_AR_SETTINGS: ARSceneSettings & HandOverlaySettings = {
  showRing: true,
  showLandmarks: true,
  showPoseAxes: true,
  showPoseGuide: true,
  showOccluder: false,
  poseSmoothing: 0.7,
  fingerRadius: 1.25,
}

function DebugToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <span className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch__track" aria-hidden="true" />
      </span>
    </label>
  )
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Camera permission denied. Allow camera access in your browser settings and try again.'
    }
    if (
      error.name === 'NotFoundError' ||
      error.name === 'OverconstrainedError' ||
      error.name === 'NotReadableError'
    ) {
      return 'Camera unavailable. Check that a camera is connected and not in use by another app.'
    }
  }
  return error instanceof Error ? error.message : 'Camera unavailable.'
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function drawSnapshotLayer(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  mirrored: boolean,
) {
  context.save()
  if (mirrored) {
    context.translate(width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(source, 0, 0, width, height)
  context.restore()
}

function snapshotFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `ring-viewer-${timestamp}.png`
}

export function HandTrackingView({
  modelUrl,
  environmentUrl,
  modelAvailable,
  environmentAvailable,
  arAvailable,
  onHandResult,
  onSmoothedHandResult,
  onRingGuide,
}: HandTrackingViewProps) {
  const cameraStageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const arPoseRef = useRef<ARRingPose | null>(null)
  const resultListenerRef = useRef(onHandResult)
  const smoothedResultListenerRef = useRef(onSmoothedHandResult)
  const ringGuideListenerRef = useRef(onRingGuide)
  const [ringGuideSettings, setRingGuideSettings] =
    useState<RingGuideSettings>(INITIAL_RING_GUIDE)
  const ringGuideSettingsRef = useRef(ringGuideSettings)
  const [smoothing, setSmoothing] = useState(0.85)
  const smoothingRef = useRef(smoothing)
  const [arSettings, setARSettings] = useState(INITIAL_AR_SETTINGS)
  const overlaySettingsRef = useRef<HandOverlaySettings>(INITIAL_AR_SETTINGS)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [mirrored, setMirrored] = useState(false)
  const [resolution, setResolution] = useState<CameraResolution>({
    width: 1280,
    height: 720,
  })
  const [debug, setDebug] = useState<HandTrackingDebug>(INITIAL_DEBUG)
  const [snapshotStatus, setSnapshotStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [status, setStatus] = useState<SessionStatus>({
    kind: 'initializing',
    message: 'Initializing MediaPipe…',
  })

  useEffect(() => {
    resultListenerRef.current = onHandResult
  }, [onHandResult])

  useEffect(() => {
    smoothedResultListenerRef.current = onSmoothedHandResult
  }, [onSmoothedHandResult])

  useEffect(() => {
    ringGuideListenerRef.current = onRingGuide
  }, [onRingGuide])

  useEffect(() => {
    ringGuideSettingsRef.current = ringGuideSettings
  }, [ringGuideSettings])

  useEffect(() => {
    smoothingRef.current = smoothing
  }, [smoothing])

  useEffect(() => {
    overlaySettingsRef.current = {
      showLandmarks: arSettings.showLandmarks,
      showPoseGuide: arSettings.showPoseGuide,
    }
  }, [arSettings.showLandmarks, arSettings.showPoseGuide])

  useEffect(() => {
    let active = true
    let animationFrame = 0
    let stream: MediaStream | null = null
    let landmarker: Awaited<ReturnType<typeof createHandLandmarker>> | null = null
    let overlay: ReturnType<typeof createHandLandmarkRenderer> | null = null
    let detachVideoResize: (() => void) | null = null
    const landmarkSmoother = new HandLandmarkSmoother()

    const cleanUp = () => {
      active = false
      cancelAnimationFrame(animationFrame)
      stopStream(stream)
      stream = null
      overlay?.clear()
      overlay = null
      landmarkSmoother.reset()
      arPoseRef.current = null
      ringGuideListenerRef.current?.(null)
      detachVideoResize?.()
      detachVideoResize = null
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
      landmarker?.close()
      landmarker = null
    }

    const start = async () => {
      setDebug(INITIAL_DEBUG)
      setStatus({ kind: 'initializing', message: 'Initializing MediaPipe…' })

      try {
        landmarker = await createHandLandmarker()
      } catch (error) {
        if (!active) return
        console.error('[Hand tracking] MediaPipe initialization failed', error)
        setStatus({
          kind: 'error',
          message: 'MediaPipe initialization failed. Check your connection and reload the mode.',
        })
        return
      }

      if (!active) {
        cleanUp()
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: 'error',
          message:
            'Camera access is unavailable. Use HTTPS or localhost in a supported browser.',
        })
        cleanUp()
        return
      }

      setStatus({ kind: 'requesting', message: 'Requesting camera permission…' })

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
      } catch (error) {
        if (!active) return
        console.error('[Hand tracking] Camera request failed', error)
        setStatus({ kind: 'error', message: cameraErrorMessage(error) })
        cleanUp()
        return
      }

      if (!active) {
        cleanUp()
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !landmarker) {
        setStatus({ kind: 'error', message: 'Camera preview could not be created.' })
        cleanUp()
        return
      }

      video.srcObject = stream

      try {
        await video.play()
      } catch (error) {
        if (!active) return
        console.error('[Hand tracking] Camera playback failed', error)
        setStatus({ kind: 'error', message: cameraErrorMessage(error) })
        cleanUp()
        return
      }

      if (!active) {
        cleanUp()
        return
      }

      const syncVideoDimensions = () => {
        const videoWidth = video.videoWidth || 1280
        const videoHeight = video.videoHeight || 720
        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth
          canvas.height = videoHeight
        }
        setResolution((current) =>
          current.width === videoWidth && current.height === videoHeight
            ? current
            : { width: videoWidth, height: videoHeight },
        )
      }
      video.addEventListener('resize', syncVideoDimensions)
      detachVideoResize = () =>
        video.removeEventListener('resize', syncVideoDimensions)
      syncVideoDimensions()

      const actualFacingMode = stream.getVideoTracks()[0]?.getSettings().facingMode
      const shouldMirror = actualFacingMode
        ? actualFacingMode === 'user'
        : facingMode === 'user'

      setMirrored(shouldMirror)
      setStatus({ kind: 'active', message: 'Camera active' })

      try {
        overlay = createHandLandmarkRenderer(canvas)
      } catch (error) {
        console.error('[Hand tracking] Overlay initialization failed', error)
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Landmark overlay unavailable.',
        })
        cleanUp()
        return
      }

      let lastVideoTime = -1
      let fpsWindowStart = performance.now()
      let framesInWindow = 0
      let currentFps = 0
      let lastDetected: boolean | null = null

      const detectFrame = () => {
        if (!active || !landmarker || !overlay) return

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const videoTime = video.currentTime
          if (videoTime !== lastVideoTime) {
            lastVideoTime = videoTime
            const now = performance.now()

            try {
              const rawResult = landmarker.detectForVideo(video, now)
              const result = landmarkSmoother.smooth(
                rawResult,
                smoothingRef.current,
                now,
              )
              const guide = estimateRingGuide(
                result.landmarks[0],
                canvas.width,
                canvas.height,
                ringGuideSettingsRef.current,
              )
              arPoseRef.current = guide
                ? poseToThreeTransform(
                    guide,
                    canvas.width,
                    canvas.height,
                    now,
                  )
                : null
              overlay.draw(result, guide, overlaySettingsRef.current)
              resultListenerRef.current?.(rawResult)
              smoothedResultListenerRef.current?.(result)
              ringGuideListenerRef.current?.(guide)

              framesInWindow += 1
              const elapsed = now - fpsWindowStart
              const handDetected = result.landmarks.length > 0
              const detectionChanged = handDetected !== lastDetected

              if (elapsed >= 1_000) {
                currentFps = (framesInWindow * 1_000) / elapsed
                framesInWindow = 0
                fpsWindowStart = now
              }

              if (detectionChanged || elapsed >= 1_000) {
                const handedness = result.handedness[0]?.[0]
                const selectedMcpIndex = getFingerMcpIndex(
                  ringGuideSettingsRef.current.finger,
                )
                const selectedFingerMcp =
                  selectedMcpIndex === null
                    ? null
                    : (result.landmarks[0]?.[selectedMcpIndex] ?? null)
                setDebug({
                  handDetected,
                  handedness: handedness?.categoryName ?? null,
                  handednessConfidence: handedness?.score ?? null,
                  inferenceFps: currentFps,
                  selectedFingerMcp: selectedFingerMcp
                    ? {
                        x: selectedFingerMcp.x,
                        y: selectedFingerMcp.y,
                        z: selectedFingerMcp.z,
                      }
                    : null,
                  ringGuideDiameter: guide?.diameter ?? null,
                })
                lastDetected = handDetected
              }
            } catch (error) {
              console.error('[Hand tracking] Video inference failed', error)
              setStatus({
                kind: 'error',
                message: 'Hand tracking stopped after an inference error.',
              })
              cleanUp()
              return
            }
          }
        }

        animationFrame = requestAnimationFrame(detectFrame)
      }

      animationFrame = requestAnimationFrame(detectFrame)
    }

    void start()
    return cleanUp
  }, [facingMode])

  const isActive = status.kind === 'active'

  const saveSnapshot = async () => {
    const video = videoRef.current
    const landmarkCanvas = canvasRef.current
    const stage = cameraStageRef.current
    if (!video || !landmarkCanvas || !stage || video.readyState < 2) return

    setSnapshotStatus('saving')

    try {
      const width = video.videoWidth || resolution.width
      const height = video.videoHeight || resolution.height
      const snapshot = document.createElement('canvas')
      snapshot.width = width
      snapshot.height = height

      const context = snapshot.getContext('2d')
      if (!context) throw new Error('Could not create the snapshot canvas.')

      drawSnapshotLayer(context, video, width, height, mirrored)

      const arCanvas =
        stage.querySelector<HTMLCanvasElement>('.hand-ar-canvas canvas') ??
        stage.querySelector<HTMLCanvasElement>('canvas.hand-ar-canvas')
      if (arCanvas) {
        drawSnapshotLayer(context, arCanvas, width, height, mirrored)
      }

      drawSnapshotLayer(context, landmarkCanvas, width, height, mirrored)

      const blob = await new Promise<Blob>((resolve, reject) => {
        snapshot.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('The browser could not encode the snapshot.'))
        }, 'image/png')
      })

      const url = URL.createObjectURL(blob)
      const download = document.createElement('a')
      download.href = url
      download.download = snapshotFilename()
      document.body.appendChild(download)
      download.click()
      download.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setSnapshotStatus('saved')
    } catch (error) {
      console.error('[Hand tracking] Snapshot failed', error)
      setSnapshotStatus('error')
    }
  }

  return (
    <>
      <section className="viewer-frame hand-tracking-frame" aria-label="Live hand tracking">
        <CameraView
          stageRef={cameraStageRef}
          videoRef={videoRef}
          canvasRef={canvasRef}
          width={resolution.width}
          height={resolution.height}
          mirrored={mirrored}
          arPoseRef={arPoseRef}
          modelUrl={modelUrl}
          environmentUrl={environmentUrl}
          modelAvailable={modelAvailable}
          environmentAvailable={environmentAvailable}
          arAvailable={arAvailable}
          arSettings={arSettings}
        />

        {!isActive && (
          <div
            className={`hand-tracking-status${status.kind === 'error' ? ' hand-tracking-status--error' : ''}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            <span className="eyebrow">
              {status.kind === 'error' ? 'Hand tracking unavailable' : 'Hand tracking'}
            </span>
            <p>{status.message}</p>
          </div>
        )}

        {isActive && (
          <div className="hand-detection-hint" role="status">
            Camera active · {debug.handDetected ? 'Hand detected' : 'No hand detected'}
          </div>
        )}

        <div className="viewer-caption" aria-hidden="true">
          <span>02</span>
          <span>Live landmark study</span>
        </div>
      </section>

      <aside className="control-panel hand-debug-panel" aria-label="Hand tracking status">
        <div className="control-panel__header">
          <span className="eyebrow">Tracking diagnostics</span>
          <span className={`live-indicator${isActive ? '' : ' is-inactive'}`}>
            {isActive ? 'Live' : 'Idle'}
          </span>
        </div>

        <div className="ar-debug-controls">
          <DebugToggle
            label="AR ring"
            checked={arSettings.showRing}
            onChange={(showRing) =>
              setARSettings((current) => ({ ...current, showRing }))
            }
          />
          <DebugToggle
            label="Landmarks"
            checked={arSettings.showLandmarks}
            onChange={(showLandmarks) =>
              setARSettings((current) => ({ ...current, showLandmarks }))
            }
          />
          <DebugToggle
            label="Pose axes + guide"
            checked={arSettings.showPoseAxes && arSettings.showPoseGuide}
            onChange={(showPose) =>
              setARSettings((current) => ({
                ...current,
                showPoseAxes: showPose,
                showPoseGuide: showPose,
              }))
            }
          />
          <DebugToggle
            label="Finger occluder debug"
            checked={arSettings.showOccluder}
            onChange={(showOccluder) =>
              setARSettings((current) => ({ ...current, showOccluder }))
            }
          />
        </div>

        <div className="ring-guide-controls">
          <div className="ring-guide-control ring-guide-control--select">
            <label htmlFor="ring-guide-finger">Ring guide</label>
            <select
              id="ring-guide-finger"
              value={ringGuideSettings.finger}
              onChange={(event) =>
                setRingGuideSettings((current) => ({
                  ...current,
                  finger: event.target.value as RingFinger,
                }))
              }
            >
              <option value="ring">Ring finger</option>
              <option value="middle">Middle finger</option>
              <option value="index">Index finger</option>
              <option value="pinky">Pinky finger</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div className="ring-guide-control control-group--slider">
            <label htmlFor="ring-guide-size">
              <span>Ring scale multiplier</span>
              <output>{Math.round(ringGuideSettings.sizeScale * 100)}%</output>
            </label>
            <input
              id="ring-guide-size"
              type="range"
              min="0.6"
              max="1.5"
              step="0.01"
              value={ringGuideSettings.sizeScale}
              disabled={ringGuideSettings.finger === 'off'}
              onChange={(event) =>
                setRingGuideSettings((current) => ({
                  ...current,
                  sizeScale: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="ring-guide-control control-group--slider">
            <label htmlFor="ring-guide-position">
              <span>Position offset</span>
              <output>
                {ringGuideSettings.positionOffset >= 0 ? '+' : ''}
                {Math.round(ringGuideSettings.positionOffset * 100)}%
              </output>
            </label>
            <input
              id="ring-guide-position"
              type="range"
              min="-0.3"
              max="0.3"
              step="0.01"
              value={ringGuideSettings.positionOffset}
              disabled={ringGuideSettings.finger === 'off'}
              onChange={(event) =>
                setRingGuideSettings((current) => ({
                  ...current,
                  positionOffset: Number(event.target.value),
                }))
              }
            />
            <div className="range-directions" aria-hidden="true">
              <span>Palm</span>
              <span>Fingertip</span>
            </div>
          </div>
        </div>

        <div className="tracking-smoothing control-group--slider">
          <label htmlFor="landmark-smoothing">
            <span>Temporal smoothing</span>
            <output>{Math.round(smoothing * 100)}%</output>
          </label>
          <input
            id="landmark-smoothing"
            type="range"
            min="0"
            max="0.95"
            step="0.01"
            value={smoothing}
            onChange={(event) => setSmoothing(Number(event.target.value))}
          />
          <div className="range-directions" aria-hidden="true">
            <span>Responsive</span>
            <span>Stable</span>
          </div>
        </div>

        <div className="ar-tuning-controls">
          <div className="control-group--slider">
            <label htmlFor="pose-smoothing">
              <span>AR pose smoothing</span>
              <output>{Math.round(arSettings.poseSmoothing * 100)}%</output>
            </label>
            <input
              id="pose-smoothing"
              type="range"
              min="0"
              max="0.95"
              step="0.01"
              value={arSettings.poseSmoothing}
              onChange={(event) =>
                setARSettings((current) => ({
                  ...current,
                  poseSmoothing: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="control-group--slider">
            <label htmlFor="finger-radius">
              <span>Finger radius</span>
              <output>{arSettings.fingerRadius.toFixed(2)}×</output>
            </label>
            <input
              id="finger-radius"
              type="range"
              min="0.65"
              max="2"
              step="0.01"
              value={arSettings.fingerRadius}
              onChange={(event) =>
                setARSettings((current) => ({
                  ...current,
                  fingerRadius: Number(event.target.value),
                }))
              }
            />
          </div>
        </div>

        <dl className="hand-debug-list">
          <div>
            <dt>MediaPipe</dt>
            <dd>{status.kind === 'initializing' ? 'Loading' : status.kind === 'error' ? 'Error' : 'Ready'}</dd>
          </div>
          <div>
            <dt>Camera</dt>
            <dd>{isActive ? `${resolution.width} × ${resolution.height}` : 'Inactive'}</dd>
          </div>
          <div>
            <dt>Hand detected</dt>
            <dd>{debug.handDetected ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Handedness</dt>
            <dd>{debug.handedness ?? '—'}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              {debug.handednessConfidence === null
                ? '—'
                : debug.handednessConfidence.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>Inference FPS</dt>
            <dd>{debug.inferenceFps > 0 ? debug.inferenceFps.toFixed(1) : '—'}</dd>
          </div>
        </dl>

        <div className="hand-landmark-readout">
          <span className="eyebrow">Selected MCP / guide width</span>
          {debug.selectedFingerMcp ? (
            <code>
              x {debug.selectedFingerMcp.x.toFixed(3)} · y{' '}
              {debug.selectedFingerMcp.y.toFixed(3)} · z{' '}
              {debug.selectedFingerMcp.z.toFixed(3)}
              {debug.ringGuideDiameter === null
                ? ''
                : ` · ${debug.ringGuideDiameter.toFixed(1)} px`}
            </code>
          ) : (
            <code>Waiting for landmarks…</code>
          )}
        </div>

        <div className="button-row">
          <button
            className="button button--primary"
            onClick={() => void saveSnapshot()}
            disabled={!isActive || snapshotStatus === 'saving'}
          >
            {snapshotStatus === 'saving'
              ? 'Saving snapshot…'
              : snapshotStatus === 'saved'
                ? 'Snapshot saved'
                : 'Save snapshot'}
          </button>
          <button
            className="button button--secondary"
            onClick={() =>
              setFacingMode((current) =>
                current === 'environment' ? 'user' : 'environment',
              )
            }
            disabled={status.kind === 'initializing' || status.kind === 'requesting'}
          >
            Use {facingMode === 'environment' ? 'front' : 'rear'} camera
          </button>
        </div>

        {snapshotStatus === 'error' && (
          <p className="snapshot-error" role="alert">
            Snapshot failed. Try again or check browser download permissions.
          </p>
        )}

        <p className="interaction-hint">
          Camera access requires HTTPS or localhost
        </p>
      </aside>
    </>
  )
}
