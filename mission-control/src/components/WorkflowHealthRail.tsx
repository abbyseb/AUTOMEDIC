import type { WatchedWorkflow } from '../types/automedic'

type Props = {
  workflows?: WatchedWorkflow[]
  loading?: boolean
  error?: string | null
}

export function WorkflowHealthRail({ workflows, loading, error }: Props) {
  return (
    <aside className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 h-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Watched workflows
      </h2>
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <ul className="space-y-2">
        {workflows?.map((wf) => (
          <li
            key={wf.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--pill)] px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  wf.health === 'healthy'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : wf.health === 'unhealthy'
                      ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.55)]'
                      : 'bg-slate-400'
                }`}
                aria-label={wf.health}
              />
              <span className="text-sm font-medium leading-tight">{wf.name}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span className="uppercase tracking-wide">{wf.tag}</span>
              <span>
                {wf.lastExecutionStatus ?? '—'} · {wf.lastExecutionId ?? 'n/a'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {!loading && !error && (workflows?.length ?? 0) === 0 && (
        <p className="text-sm text-[var(--muted)]">No watched workflows.</p>
      )}
    </aside>
  )
}
