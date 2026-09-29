import { useCallback, useEffect, useState } from 'react'
import type { AssetState } from '../types'

type AssetAvailability = {
  state: AssetState
  detail?: string
}

export function useAssetAvailability(url: string) {
  const [result, setResult] = useState<AssetAvailability>({ state: 'checking' })
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setResult({ state: 'checking' })
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function checkAsset() {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        })
        const contentType = response.headers.get('content-type') ?? ''

        if (!response.ok || contentType.includes('text/html')) {
          setResult({
            state: 'missing',
            detail: `Expected a static asset at ${url}.`,
          })
          return
        }

        setResult({ state: 'available' })
      } catch (error) {
        if (controller.signal.aborted) return
        setResult({
          state: 'error',
          detail: error instanceof Error ? error.message : 'The asset check failed.',
        })
      }
    }

    void checkAsset()
    return () => controller.abort()
  }, [attempt, url])

  return { ...result, retry }
}
