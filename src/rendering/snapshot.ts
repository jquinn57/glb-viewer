import * as THREE from 'three'

type SnapshotOptions = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  size: number
  filename?: string
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not encode the snapshot as PNG.'))
    }, 'image/png')
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function renderSnapshot({
  renderer,
  scene,
  camera,
  size,
  filename = `glb-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
}: SnapshotOptions) {
  const snapshotCamera = camera.clone()
  snapshotCamera.aspect = 1
  snapshotCamera.updateProjectionMatrix()
  snapshotCamera.updateMatrixWorld(true)

  const target = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: true,
  })
  const maxSamples = renderer.capabilities.maxSamples
  target.samples = Math.min(4, maxSamples)

  const previousTarget = renderer.getRenderTarget()
  const previousXrEnabled = renderer.xr.enabled
  const pixels = new Uint8Array(size * size * 4)

  try {
    renderer.xr.enabled = false
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, snapshotCamera)
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
  } finally {
    renderer.setRenderTarget(previousTarget)
    renderer.xr.enabled = previousXrEnabled
    target.dispose()
  }

  const flipped = new Uint8ClampedArray(pixels.length)
  const rowBytes = size * 4
  for (let row = 0; row < size; row += 1) {
    const sourceStart = (size - row - 1) * rowBytes
    flipped.set(pixels.subarray(sourceStart, sourceStart + rowBytes), row * rowBytes)
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas is unavailable for PNG export.')
  context.putImageData(new ImageData(flipped, size, size), 0, 0)

  const blob = await canvasToBlob(canvas)
  downloadBlob(blob, filename)
}
