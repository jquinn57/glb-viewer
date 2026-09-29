export type ModelBounds = {
  size: [number, number, number]
  radius: number
  minY: number
}

export type AssetState = 'checking' | 'available' | 'missing' | 'error'

export type SnapshotRenderer = (size: number) => Promise<void>
