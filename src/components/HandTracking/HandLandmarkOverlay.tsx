import type { RefObject } from 'react'

type HandLandmarkOverlayProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
  mirrored: boolean
}

export function HandLandmarkOverlay({
  canvasRef,
  width,
  height,
  mirrored,
}: HandLandmarkOverlayProps) {
  return (
    <canvas
      ref={canvasRef}
      className={`hand-landmark-overlay${mirrored ? ' is-mirrored' : ''}`}
      width={width}
      height={height}
      aria-hidden="true"
    />
  )
}
