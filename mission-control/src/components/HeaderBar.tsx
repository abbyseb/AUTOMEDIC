import type { MissionStatus } from '../types/automedic'

const statusColor: Record<MissionStatus, string> = {
  WATCHING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  SCANNING: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  HEALING: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  HEALED: 'bg-emerald-400/25 text-emerald-200 border-emerald-300/50',
  ERROR: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

type Props = {
  status?: MissionStatus
  watchedCount?: number
  lastScanAt?: string | null
  children?: React.ReactNode
}

export function HeaderBar({ status, watchedCount, lastScanAt, children }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-3 bg-[var(--panel)]/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight leading-none">AutoMedic</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Mission Control
          </div>
        </div>
        {status && (
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusColor[status]}`}
          >
            {status}
            {typeof watchedCount === 'number' && (
              <span className="opacity-70"> · {watchedCount} workflows</span>
            )}
          </span>
        )}
        {lastScanAt && (
          <span className="text-xs text-[var(--muted)]">
            last scan {new Date(lastScanAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      {children}
    </header>
  )
}
