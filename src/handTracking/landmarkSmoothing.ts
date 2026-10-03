import type {
  HandLandmarkerResult,
  Landmark,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'

const REFERENCE_FRAME_MS = 1_000 / 60
const RESET_AFTER_MS = 250

function blendLandmark<T extends Landmark | NormalizedLandmark>(
  previous: T,
  current: T,
  retention: number,
): T {
  const currentWeight = 1 - retention
  return {
    x: previous.x * retention + current.x * currentWeight,
    y: previous.y * retention + current.y * currentWeight,
    z: previous.z * retention + current.z * currentWeight,
    visibility:
      previous.visibility * retention + current.visibility * currentWeight,
  } as T
}

function blendHands<T extends Landmark | NormalizedLandmark>(
  previousHands: T[][],
  currentHands: T[][],
  retention: number,
) {
  return currentHands.map((currentHand, handIndex) => {
    const previousHand = previousHands[handIndex]
    if (!previousHand || previousHand.length !== currentHand.length) {
      return currentHand.map((landmark) => ({ ...landmark }))
    }
    return currentHand.map((landmark, landmarkIndex) =>
      blendLandmark(previousHand[landmarkIndex], landmark, retention),
    )
  })
}

/**
 * Applies an exponential moving average whose strength is normalized to a
 * 60 Hz reference. This keeps the slider response comparable across cameras
 * with different frame rates.
 */
export class HandLandmarkSmoother {
  private previous: HandLandmarkerResult | null = null
  private previousTimestamp = 0

  reset() {
    this.previous = null
    this.previousTimestamp = 0
  }

  smooth(
    result: HandLandmarkerResult,
    smoothing: number,
    timestamp: number,
  ): HandLandmarkerResult {
    const previous = this.previous
    const elapsed = timestamp - this.previousTimestamp
    const handCountChanged =
      previous?.landmarks.length !== result.landmarks.length

    if (
      !previous ||
      result.landmarks.length === 0 ||
      handCountChanged ||
      elapsed <= 0 ||
      elapsed > RESET_AFTER_MS
    ) {
      const initial = {
        ...result,
        landmarks: result.landmarks.map((hand) =>
          hand.map((landmark) => ({ ...landmark })),
        ),
        worldLandmarks: result.worldLandmarks.map((hand) =>
          hand.map((landmark) => ({ ...landmark })),
        ),
      }
      this.previous = initial
      this.previousTimestamp = timestamp
      return initial
    }

    const referenceRetention = Math.min(Math.max(smoothing, 0), 0.98)
    const retention = Math.pow(
      referenceRetention,
      elapsed / REFERENCE_FRAME_MS,
    )
    const smoothed = {
      ...result,
      landmarks: blendHands(
        previous.landmarks,
        result.landmarks,
        retention,
      ),
      worldLandmarks: blendHands(
        previous.worldLandmarks,
        result.worldLandmarks,
        retention,
      ),
    }

    this.previous = smoothed
    this.previousTimestamp = timestamp
    return smoothed
  }
}
