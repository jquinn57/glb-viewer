import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { RingViewer } from './components/RingViewer'
import { ViewerControls } from './components/ViewerControls'
import { useAssetAvailability } from './hooks/useAssetAvailability'
import type { SnapshotRenderer } from './types'

const MODEL_PATH = 'models/ring.glb'
const ENVIRONMENT_PATH = 'environments/studio.exr'
const MODEL_URL = `${import.meta.env.BASE_URL}${MODEL_PATH}`
const ENVIRONMENT_URL = `${import.meta.env.BASE_URL}${ENVIRONMENT_PATH}`
const HandTrackingView = lazy(() =>
  import('./components/HandTracking/HandTrackingView').then((module) => ({
    default: module.HandTrackingView,
  })),
)

type AppMode = 'ring' | 'hand'

function supportsWebGL2() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('ring')
  const model = useAssetAvailability(MODEL_URL)
  const environment = useAssetAvailability(ENVIRONMENT_URL)
  const [showEnvironment, setShowEnvironment] = useState(true)
  const [showGround, setShowGround] = useState(true)
  const [showLights, setShowLights] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [environmentIntensity, setEnvironmentIntensity] = useState(1)
  const [snapshotSize, setSnapshotSize] = useState(2048)
  const [snapshotBusy, setSnapshotBusy] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const snapshotRenderer = useRef<SnapshotRenderer | null>(null)
  const webgl2Available = useMemo(supportsWebGL2, [])

  const setRenderer = useCallback((renderer: SnapshotRenderer | null) => {
    snapshotRenderer.current = renderer
  }, [])

  const handleSnapshot = async () => {
    if (!snapshotRenderer.current) return
    setSnapshotBusy(true)
    setSnapshotError(null)
    try {
      await snapshotRenderer.current(snapshotSize)
    } catch (error) {
      console.error('[GLB viewer] Snapshot failed', error)
      setSnapshotError(
        error instanceof Error ? error.message : 'Snapshot rendering failed.',
      )
    } finally {
      setSnapshotBusy(false)
    }
  }

  const assetsChecking =
    model.state === 'checking' || environment.state === 'checking'
  const missingAssets = [
    model.state === 'missing' || model.state === 'error'
      ? `public/${MODEL_PATH}`
      : null,
    environment.state === 'missing' || environment.state === 'error'
      ? `public/${ENVIRONMENT_PATH}`
      : null,
  ].filter(Boolean) as string[]

  return (
    <main className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Atelier GLB viewer home"
        >
          <span className="brand__mark" aria-hidden="true" />
          <span>Atelier / GLB Viewer</span>
        </a>
        <nav className="mode-selector" aria-label="Application mode">
          <button
            className={mode === 'ring' ? 'is-active' : ''}
            type="button"
            aria-pressed={mode === 'ring'}
            onClick={() => setMode('ring')}
          >
            Ring Viewer
          </button>
          <button
            className={mode === 'hand' ? 'is-active' : ''}
            type="button"
            aria-pressed={mode === 'hand'}
            onClick={() => setMode('hand')}
          >
            Hand Tracking
          </button>
        </nav>
        <div className="render-label">
          <span>{mode === 'ring' ? 'Realtime PBR' : 'MediaPipe'}</span>
          <span className="render-label__divider" />
          <span>{mode === 'ring' ? 'WebGL2' : 'Camera'}</span>
        </div>
      </header>

      {mode === 'ring' ? (
        <>
          <section className="viewer-frame" aria-label="Interactive GLB viewer">
            {webgl2Available ? (
              <RingViewer
                modelUrl={MODEL_URL}
                environmentUrl={ENVIRONMENT_URL}
                modelAvailable={model.state === 'available'}
                environmentAvailable={environment.state === 'available'}
                showEnvironment={
                  showEnvironment && environment.state === 'available'
                }
                showGround={showGround}
                showLights={showLights}
                showStats={showStats}
                environmentIntensity={environmentIntensity}
                resetToken={resetToken}
                snapshotSize={snapshotSize}
                onSnapshotRenderer={setRenderer}
              />
            ) : (
              <div className="viewer-message viewer-message--error" role="alert">
                <span className="eyebrow">Unsupported browser</span>
                <h2>WebGL2 is required.</h2>
                <p>
                  Try a current desktop browser with hardware acceleration enabled.
                </p>
              </div>
            )}

            {assetsChecking && (
              <div className="asset-status asset-status--checking" role="status">
                Checking scene assets…
              </div>
            )}

            {!assetsChecking && missingAssets.length > 0 && (
              <div className="asset-status asset-status--warning" role="alert">
                <div>
                  <span className="eyebrow">Assets needed</span>
                  <strong>Add the source files to preview the ring.</strong>
                  <ul>
                    {missingAssets.map((asset) => (
                      <li key={asset}>
                        <code>{asset}</code>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    model.retry()
                    environment.retry()
                  }}
                >
                  Check again
                </button>
              </div>
            )}

            {snapshotError && (
              <div className="toast" role="alert">
                Snapshot failed: {snapshotError}
              </div>
            )}

            <div className="viewer-caption" aria-hidden="true">
              <span>01</span>
              <span>Interactive material study</span>
            </div>
          </section>

          <ViewerControls
            showEnvironment={showEnvironment}
            showGround={showGround}
            showLights={showLights}
            showStats={showStats}
            environmentIntensity={environmentIntensity}
            snapshotSize={snapshotSize}
            snapshotBusy={snapshotBusy}
            snapshotDisabled={model.state !== 'available'}
            onShowEnvironment={setShowEnvironment}
            onShowGround={setShowGround}
            onShowLights={setShowLights}
            onShowStats={setShowStats}
            onEnvironmentIntensity={setEnvironmentIntensity}
            onSnapshotSize={setSnapshotSize}
            onReset={() => setResetToken((value) => value + 1)}
            onSnapshot={() => void handleSnapshot()}
          />
        </>
      ) : (
        <Suspense
          fallback={
            <>
              <section className="viewer-frame hand-tracking-frame">
                <div className="hand-tracking-status" role="status">
                  <span className="eyebrow">Hand tracking</span>
                  <p>Loading hand-tracking tools…</p>
                </div>
              </section>
              <aside className="control-panel" aria-label="Hand tracking status">
                <div className="control-panel__header">
                  <span className="eyebrow">Tracking diagnostics</span>
                  <span className="live-indicator is-inactive">Idle</span>
                </div>
              </aside>
            </>
          }
        >
          <HandTrackingView
            modelUrl={MODEL_URL}
            environmentUrl={ENVIRONMENT_URL}
            modelAvailable={model.state === 'available'}
            environmentAvailable={environment.state === 'available'}
            arAvailable={webgl2Available}
          />
        </Suspense>
      )}
    </main>
  )
}
