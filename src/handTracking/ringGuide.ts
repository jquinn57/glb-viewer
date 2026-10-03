import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type RingFinger = 'off' | 'index' | 'middle' | 'ring' | 'pinky'

export type RingGuideSettings = {
  finger: RingFinger
  sizeScale: number
  positionOffset: number
}

export type Point2D = {
  x: number
  y: number
}

export type RingGuideEstimate = {
  center: Point2D
  fingerDirection: Point2D
  ringDirection: Point2D
  fingerDepthDelta: number
  proximalLength: number
  positionAlongFinger: number
  baseDiameter: number
  diameter: number
  bandDepth: number
  handScale: number
}

export type RingGuideListener = (guide: RingGuideEstimate | null) => void

type FingerDefinition = {
  mcp: number
  pip: number
  diameterRatio: number
}

const FINGER_DEFINITIONS: Record<Exclude<RingFinger, 'off'>, FingerDefinition> = {
  index: { mcp: 5, pip: 6, diameterRatio: 0.22 },
  middle: { mcp: 9, pip: 10, diameterRatio: 0.23 },
  ring: { mcp: 13, pip: 14, diameterRatio: 0.22 },
  pinky: { mcp: 17, pip: 18, diameterRatio: 0.18 },
}

// Natural placement is 55% of the MCP→PIP segment toward the fingertip. The
// UI offset remains centered at zero around this calibrated starting point.
const NATURAL_POSITION = 0.55

export function getFingerMcpIndex(finger: RingFinger) {
  return finger === 'off' ? null : FINGER_DEFINITIONS[finger].mcp
}

function toCanvasPoint(
  landmark: NormalizedLandmark,
  width: number,
  height: number,
): Point2D {
  return { x: landmark.x * width, y: landmark.y * height }
}

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalizedDirection(from: Point2D, to: Point2D): Point2D | null {
  const length = distance(from, to)
  if (length < 0.001) return null
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

export function estimateRingGuide(
  landmarks: NormalizedLandmark[] | undefined,
  canvasWidth: number,
  canvasHeight: number,
  settings: RingGuideSettings,
): RingGuideEstimate | null {
  if (!landmarks || settings.finger === 'off') return null

  const finger = FINGER_DEFINITIONS[settings.finger]
  const wrist = landmarks[0]
  const indexMcp = landmarks[5]
  const middleMcp = landmarks[9]
  const pinkyMcp = landmarks[17]
  const selectedMcp = landmarks[finger.mcp]
  const selectedPip = landmarks[finger.pip]

  if (
    !wrist ||
    !indexMcp ||
    !middleMcp ||
    !pinkyMcp ||
    !selectedMcp ||
    !selectedPip
  ) {
    return null
  }

  const mcp = toCanvasPoint(selectedMcp, canvasWidth, canvasHeight)
  const pip = toCanvasPoint(selectedPip, canvasWidth, canvasHeight)
  const fingerDirection = normalizedDirection(mcp, pip)
  if (!fingerDirection) return null

  const proximalLength = distance(mcp, pip)
  const palmWidth = distance(
    toCanvasPoint(indexMcp, canvasWidth, canvasHeight),
    toCanvasPoint(pinkyMcp, canvasWidth, canvasHeight),
  )
  const palmLength = distance(
    toCanvasPoint(wrist, canvasWidth, canvasHeight),
    toCanvasPoint(middleMcp, canvasWidth, canvasHeight),
  )

  // Blending two palm measurements makes scale less sensitive to a single
  // partially foreshortened axis than either measurement alone.
  const handScale = palmWidth * 0.7 + palmLength * 0.3
  if (handScale < 0.001) return null

  const position = NATURAL_POSITION + settings.positionOffset
  const center = {
    x: mcp.x + fingerDirection.x * proximalLength * position,
    y: mcp.y + fingerDirection.y * proximalLength * position,
  }
  const baseDiameter = handScale * finger.diameterRatio
  const diameter = baseDiameter * settings.sizeScale

  return {
    center,
    fingerDirection,
    ringDirection: { x: -fingerDirection.y, y: fingerDirection.x },
    // MediaPipe Z uses roughly the same scale as normalized X. Converting it
    // to horizontal pixels lets the explicit Three.js adapter treat X/Y/Z in
    // one consistent image-relative unit system.
    fingerDepthDelta: (selectedPip.z - selectedMcp.z) * canvasWidth,
    proximalLength,
    positionAlongFinger: position,
    baseDiameter,
    diameter,
    bandDepth: Math.max(4, diameter * 0.16),
    handScale,
  }
}
