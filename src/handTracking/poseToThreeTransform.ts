import * as THREE from 'three'
import type { RingGuideEstimate } from './ringGuide'

export type ARRingPose = {
  position: THREE.Vector3
  orientation: THREE.Quaternion
  scale: number
  fingerDiameter: number
  fingerLength: number
  fingerCenterOffset: number
  timestamp: number
}

const CAMERA_FACING_NORMAL = new THREE.Vector3(0, 0, 1)
const FALLBACK_UP = new THREE.Vector3(0, 1, 0)

/**
 * Coordinate conversion for the orthographic AR scene:
 *
 * MediaPipe/canvas: +X right, +Y down, smaller Z closer to the camera.
 * Three camera space: +X right, +Y up, +Z toward the camera.
 *
 * The full WebGL/video stack is mirrored with CSS for a front camera, so this
 * conversion always receives and emits unmirrored coordinates.
 */
export function poseToThreeTransform(
  guide: RingGuideEstimate,
  viewportWidth: number,
  viewportHeight: number,
  timestamp: number,
): ARRingPose {
  const fingerAxis = new THREE.Vector3(
    guide.fingerDirection.x,
    -guide.fingerDirection.y,
    -guide.fingerDepthDelta / Math.max(guide.proximalLength, 0.001),
  ).normalize()

  // Keep the gemstone side camera-facing while projecting that direction onto
  // the plane perpendicular to the finger. This remains stable as the finger
  // tilts toward or away from the camera.
  const gemstoneUp = CAMERA_FACING_NORMAL.clone().addScaledVector(
    fingerAxis,
    -CAMERA_FACING_NORMAL.dot(fingerAxis),
  )
  if (gemstoneUp.lengthSq() < 0.0001) {
    gemstoneUp.copy(FALLBACK_UP).addScaledVector(
      fingerAxis,
      -FALLBACK_UP.dot(fingerAxis),
    )
  }
  gemstoneUp.normalize()

  // The asset uses local +Z as its hole/finger axis and local +Y as its
  // gemstone direction. X = Y × Z completes the right-handed basis.
  const ringRight = new THREE.Vector3()
    .crossVectors(gemstoneUp, fingerAxis)
    .normalize()
  gemstoneUp.crossVectors(fingerAxis, ringRight).normalize()
  const orientationMatrix = new THREE.Matrix4().makeBasis(
    ringRight,
    gemstoneUp,
    fingerAxis,
  )

  const fingerLength = Math.hypot(
    guide.proximalLength,
    guide.fingerDepthDelta,
  )

  return {
    position: new THREE.Vector3(
      guide.center.x - viewportWidth / 2,
      viewportHeight / 2 - guide.center.y,
      0,
    ),
    orientation: new THREE.Quaternion().setFromRotationMatrix(orientationMatrix),
    scale: guide.diameter,
    fingerDiameter: guide.baseDiameter,
    fingerLength,
    fingerCenterOffset:
      (0.5 - guide.positionAlongFinger) * fingerLength,
    timestamp,
  }
}
