import { Environment } from '@react-three/drei'

type StudioEnvironmentProps = {
  url: string
  background: boolean
  intensity: number
}

export function StudioEnvironment({
  url,
  background,
  intensity,
}: StudioEnvironmentProps) {
  return (
    <Environment
      files={url}
      background={background}
      backgroundIntensity={intensity}
      environmentIntensity={intensity}
      resolution={1024}
    />
  )
}
