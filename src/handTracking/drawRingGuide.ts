import type { Point2D, RingGuideEstimate } from './ringGuide'

function offset(point: Point2D, direction: Point2D, amount: number): Point2D {
  return {
    x: point.x + direction.x * amount,
    y: point.y + direction.y * amount,
  }
}

function line(context: CanvasRenderingContext2D, from: Point2D, to: Point2D) {
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
}

export function drawRingGuide(
  context: CanvasRenderingContext2D,
  guide: RingGuideEstimate,
) {
  const halfWidth = guide.diameter / 2
  const halfDepth = guide.bandDepth / 2
  const nearCenter = offset(
    guide.center,
    guide.fingerDirection,
    -halfDepth,
  )
  const farCenter = offset(guide.center, guide.fingerDirection, halfDepth)
  const nearLeft = offset(nearCenter, guide.ringDirection, -halfWidth)
  const nearRight = offset(nearCenter, guide.ringDirection, halfWidth)
  const farLeft = offset(farCenter, guide.ringDirection, -halfWidth)
  const farRight = offset(farCenter, guide.ringDirection, halfWidth)

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.shadowColor = 'rgba(0, 0, 0, 0.65)'
  context.shadowBlur = 5

  // The two long edges are the estimated ring planes. Their direction is
  // exactly perpendicular to the selected finger's MCP-to-PIP axis.
  context.beginPath()
  line(context, nearLeft, nearRight)
  line(context, farLeft, farRight)
  context.strokeStyle = '#ffd36a'
  context.lineWidth = Math.max(3, guide.diameter * 0.07)
  context.stroke()

  context.beginPath()
  line(context, nearLeft, farLeft)
  line(context, nearRight, farRight)
  context.strokeStyle = 'rgba(255, 211, 106, 0.75)'
  context.lineWidth = Math.max(2, guide.diameter * 0.035)
  context.stroke()

  // A center line makes changes in position and orientation easier to judge.
  context.shadowBlur = 0
  context.setLineDash([Math.max(3, guide.diameter * 0.08), 4])
  context.beginPath()
  line(
    context,
    offset(guide.center, guide.ringDirection, -halfWidth * 1.18),
    offset(guide.center, guide.ringDirection, halfWidth * 1.18),
  )
  context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  context.lineWidth = 1.5
  context.stroke()
  context.restore()
}
