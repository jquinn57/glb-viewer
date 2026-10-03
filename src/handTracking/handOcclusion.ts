import type { ARRingPose } from './poseToThreeTransform'

export type FingerProxyOcclusion = {
  length: number
  centerOffset: number
}

export type HandOcclusionFrame = {
  fingerProxy?: FingerProxyOcclusion
  // A future segmentation source can add a mask here. A binary mask refines
  // silhouette only; it cannot replace the proxy's front/behind depth test.
  segmentationMask?: unknown
}

export interface HandOcclusionSource {
  getFrame(pose: ARRingPose): HandOcclusionFrame
}

export const landmarkFingerOcclusionSource: HandOcclusionSource = {
  getFrame(pose) {
    return {
      fingerProxy: {
        length: pose.fingerLength,
        centerOffset: pose.fingerCenterOffset,
      },
    }
  },
}
