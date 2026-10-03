import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerOptions,
} from '@mediapipe/tasks-vision'

// Keep the runtime and model versions pinned so an upstream release cannot
// unexpectedly change the hand-tracking pipeline in a deployed build.
export const MEDIAPIPE_VERSION = '1.0.1'
export const MEDIAPIPE_WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
export const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const HAND_LANDMARKER_OPTIONS = {
  runningMode: 'VIDEO',
  numHands: 1,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
} satisfies Omit<HandLandmarkerOptions, 'baseOptions'>

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL)
  const commonOptions = {
    ...HAND_LANDMARKER_OPTIONS,
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
      delegate: 'GPU' as const,
    },
  }

  try {
    return await HandLandmarker.createFromOptions(vision, commonOptions)
  } catch (gpuError) {
    console.warn(
      '[Hand tracking] GPU initialization failed; retrying on CPU.',
      gpuError,
    )
    return HandLandmarker.createFromOptions(vision, {
      ...commonOptions,
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate: 'CPU',
      },
    })
  }
}
