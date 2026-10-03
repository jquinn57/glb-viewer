import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export type { HandLandmarkerResult }

export type HandResultListener = (result: HandLandmarkerResult) => void

export type HandTrackingDebug = {
  handDetected: boolean
  handedness: string | null
  handednessConfidence: number | null
  inferenceFps: number
  selectedFingerMcp: { x: number; y: number; z: number } | null
  ringGuideDiameter: number | null
}
