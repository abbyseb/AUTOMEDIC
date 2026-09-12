type Props = {
  onBreak?: () => void
  onScan?: () => void
  onReset?: () => void
  disabled?: boolean
}

export function DemoControls({ onBreak, onScan, onReset, disabled }: Props) {
  const base =
    'rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBreak}
        disabled={disabled || !onBreak}
        className={`${base} bg-rose-600 hover:bg-rose-500 text-white`}
        title={onBreak ? 'Force FIELD_MAPPING failure' : 'Wired in later tickets'}
      >
        Break the API
      </button>
      <button
        type="button"
        onClick={onScan}
        disabled={disabled || !onScan}
        className={`${base} bg-sky-600 hover:bg-sky-500 text-white`}
        title={onScan ? 'Run AutoMedic scan now' : 'Wired in later tickets'}
      >
        Scan Now
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || !onReset}
        className={`${base} border border-[var(--border)] bg-transparent text-[var(--muted)] hover:text-[var(--text)] hover:border-slate-500`}
        title={onReset ? 'Reset demo to clean state' : 'Wired in later tickets'}
      >
        Reset Demo
      </button>
    </div>
  )
}
