import type { Stats } from '../types/automedic'

type Props = {
  stats?: Stats
  dataUpdatedAt?: number
  mockSource?: string
}

export function StatsBar({ stats, dataUpdatedAt, mockSource = '/mock/state.json' }: Props) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--panel)]/90 px-5 py-2.5 text-sm flex flex-wrap items-center gap-x-8 gap-y-2 text-[var(--muted)]">
      <Stat label="Auto-healed" value={stats ? String(stats.autoHealedCount) : '—'} />
      <Stat
        label="MTTR"
        value={stats?.mttrSeconds == null ? '—' : `${stats.mttrSeconds}s`}
      />
      <Stat label="Human touches" value={stats ? String(stats.humanTouches) : '—'} />
      <Stat label="Open incidents" value={stats ? String(stats.openIncidents) : '—'} />
      <span className="ml-auto text-xs">
        last poll {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'} · mock{' '}
        <code className="text-[var(--text)]/70">{mockSource}</code>
      </span>
    </footer>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <strong className="text-[var(--text)] tabular-nums">{value}</strong>
    </span>
  )
}
