import type { MissionStatus } from './types/automedic'
import { useAutomedicState } from './hooks/useAutomedicState'

const statusColor: Record<MissionStatus, string> = {
  WATCHING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  SCANNING: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  HEALING: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  HEALED: 'bg-emerald-400/25 text-emerald-200 border-emerald-300/50',
  ERROR: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

export default function App() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useAutomedicState()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-3 bg-[var(--panel)]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold tracking-tight">AutoMedic</div>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Mission Control
          </span>
          {data && (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor[data.status]}`}
            >
              {data.status}
              <span className="opacity-70"> · {data.stats.watchedCount} workflows</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Wired in later tickets"
            className="rounded-md bg-rose-600/80 px-3 py-1.5 text-sm font-medium opacity-60"
          >
            Break the API
          </button>
          <button
            type="button"
            disabled
            className="rounded-md bg-sky-600/80 px-3 py-1.5 text-sm font-medium opacity-60"
          >
            Scan Now
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm text-[var(--muted)] opacity-60"
          >
            Reset Demo
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[280px_1fr_420px] gap-4 p-4 max-lg:grid-cols-1">
        <aside className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Watched workflows
          </h2>
          {isLoading && <p className="text-sm text-[var(--muted)]">Loading mock /state…</p>}
          {isError && (
            <p className="text-sm text-rose-300">
              {error instanceof Error ? error.message : 'Failed to load state'}
            </p>
          )}
          <ul className="space-y-2">
            {data?.watchedWorkflows.map((wf) => (
              <li
                key={wf.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--pill)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      wf.health === 'healthy'
                        ? 'bg-emerald-400'
                        : wf.health === 'unhealthy'
                          ? 'bg-rose-400'
                          : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-sm font-medium">{wf.name}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {wf.lastExecutionStatus ?? '—'} · {wf.lastExecutionId ?? 'n/a'}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Incident timeline
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Scaffold ready — timeline UI is ticket #16. Polling contract every 1.5s.
          </p>
          {data?.activeIncidentId && (
            <p className="mt-3 text-sm">
              Active incident: <code className="text-amber-200">{data.activeIncidentId}</code>
            </p>
          )}
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--muted)]">
            {data
              ? JSON.stringify(
                  data.incidents.find((i) => i.id === data.activeIncidentId)?.timeline ?? [],
                  null,
                  2,
                )
              : '—'}
          </pre>
        </section>

        <aside className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Diagnosis
            </h2>
            <p className="text-sm text-[var(--muted)]">Panel lands in ticket #17.</p>
          </div>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Patch diff
            </h2>
            <p className="text-sm text-[var(--muted)]">Panel lands in ticket #18.</p>
          </div>
        </aside>
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--panel)]/90 px-5 py-2 text-sm flex flex-wrap gap-6 text-[var(--muted)]">
        <span>
          Auto-healed:{' '}
          <strong className="text-[var(--text)]">{data?.stats.autoHealedCount ?? '—'}</strong>
        </span>
        <span>
          MTTR:{' '}
          <strong className="text-[var(--text)]">
            {data?.stats.mttrSeconds == null ? '—' : `${data.stats.mttrSeconds}s`}
          </strong>
        </span>
        <span>
          Human touches:{' '}
          <strong className="text-[var(--text)]">{data?.stats.humanTouches ?? '—'}</strong>
        </span>
        <span className="ml-auto text-xs">
          last poll {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'} · mock{' '}
          <code>/mock/state.json</code>
        </span>
      </footer>
    </div>
  )
}
