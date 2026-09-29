type ViewerControlsProps = {
  showEnvironment: boolean
  showGround: boolean
  showLights: boolean
  showStats: boolean
  environmentIntensity: number
  snapshotSize: number
  snapshotBusy: boolean
  snapshotDisabled: boolean
  onShowEnvironment: (value: boolean) => void
  onShowGround: (value: boolean) => void
  onShowLights: (value: boolean) => void
  onShowStats: (value: boolean) => void
  onEnvironmentIntensity: (value: number) => void
  onSnapshotSize: (value: number) => void
  onReset: () => void
  onSnapshot: () => void
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <span className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch__track" aria-hidden="true" />
      </span>
    </label>
  )
}

export function ViewerControls(props: ViewerControlsProps) {
  return (
    <aside className="control-panel" aria-label="Viewer controls">
      <div className="control-panel__header">
        <span className="eyebrow">Scene controls</span>
        <span className="live-indicator">Live</span>
      </div>

      <div className="control-group">
        <Toggle
          label="Environment background"
          checked={props.showEnvironment}
          onChange={props.onShowEnvironment}
        />
        <Toggle
          label="Ground plane"
          checked={props.showGround}
          onChange={props.onShowGround}
        />
        <Toggle
          label="Supplemental lights"
          checked={props.showLights}
          onChange={props.onShowLights}
        />
        <Toggle
          label="Performance meter"
          checked={props.showStats}
          onChange={props.onShowStats}
        />
      </div>

      <div className="control-group control-group--slider">
        <label htmlFor="environment-intensity">
          <span>Environment intensity</span>
          <output>{props.environmentIntensity.toFixed(2)}</output>
        </label>
        <input
          id="environment-intensity"
          type="range"
          min="0"
          max="2.5"
          step="0.05"
          value={props.environmentIntensity}
          onChange={(event) =>
            props.onEnvironmentIntensity(Number(event.target.value))
          }
        />
      </div>

      <div className="control-group snapshot-options">
        <label htmlFor="snapshot-size">Snapshot resolution</label>
        <select
          id="snapshot-size"
          value={props.snapshotSize}
          onChange={(event) => props.onSnapshotSize(Number(event.target.value))}
        >
          <option value={1024}>1024 × 1024</option>
          <option value={2048}>2048 × 2048</option>
          <option value={4096}>4096 × 4096</option>
        </select>
      </div>

      <div className="button-row">
        <button className="button button--secondary" onClick={props.onReset}>
          Reset camera
        </button>
        <button
          className="button button--primary"
          onClick={props.onSnapshot}
          disabled={props.snapshotDisabled || props.snapshotBusy}
        >
          {props.snapshotBusy ? 'Rendering…' : 'Render snapshot'}
        </button>
      </div>

      <p className="interaction-hint">
        Drag to orbit · Scroll to zoom · Right-drag to pan
      </p>
    </aside>
  )
}
