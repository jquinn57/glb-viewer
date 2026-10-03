import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision'
import { drawRingGuide } from '../handTracking/drawRingGuide'
import type { RingGuideEstimate } from '../handTracking/ringGuide'
import type { HandLandmarkerResult } from './handLandmarkTypes'

export type HandOverlaySettings = {
  showLandmarks: boolean
  showPoseGuide: boolean
}

export function createHandLandmarkRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The landmark overlay canvas is unavailable.')

  const drawingUtils = new DrawingUtils(context)

  return {
    draw(
      result: HandLandmarkerResult,
      ringGuide: RingGuideEstimate | null,
      settings: HandOverlaySettings,
    ) {
      context.clearRect(0, 0, canvas.width, canvas.height)

      if (settings.showLandmarks) {
        for (const landmarks of result.landmarks) {
          drawingUtils.drawConnectors(
            landmarks,
            HandLandmarker.HAND_CONNECTIONS,
            { color: '#65d58a', lineWidth: 4 },
          )
          drawingUtils.drawLandmarks(landmarks, {
            color: '#ff5f57',
            fillColor: '#ff5f57',
            lineWidth: 2,
            radius: 5,
          })
        }
      }

      if (ringGuide && settings.showPoseGuide) drawRingGuide(context, ringGuide)
    },
    clear() {
      context.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
