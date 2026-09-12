import { DemoControls } from './components/DemoControls'
import { HeaderBar } from './components/HeaderBar'
import { StatsBar } from './components/StatsBar'
import { WorkflowHealthRail } from './components/WorkflowHealthRail'
import { useAutomedicState } from './hooks/useAutomedicState'

export default function App() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useAutomedicState()

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar
        status={data?.status}
        watchedCount={data?.stats.watchedCount}
        lastScanAt={data?.lastScanAt}
      >
        <DemoControls />
      </HeaderBar>

      <main className="flex-1 grid grid-cols-[280px_1fr_420px] gap-4 p-4 max-lg:grid-cols-1">
        <WorkflowHealthRail
          workflows={data?.watchedWorkflows}
          loading={isLoading}
          error={isError ? (error instanceof Error ? error.message : 'Failed to load') : null}
        />

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Incident timeline
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Timeline UI is ticket #16. Polling contract every 1.5s.
          </p>
          {data?.activeIncidentId && (
            <p className="mt-3 text-sm">
              Active incident: <code className="text-amber-200">{data.activeIncidentId}</code>
            </p>
          )}
          <div className="mt-3 space-y-2">
            {data?.incidents.map((inc) => (
              <button
                key={inc.id}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  inc.id === data.activeIncidentId
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-[var(--border)] bg-[var(--pill)]'
                }`}
              >
                <div className="font-medium">{inc.workflowName}</div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
                  {inc.status} · {inc.diagnosis?.failureType ?? 'pending'}
                </div>
              </button>
            ))}
          </div>
          <pre className="mt-4 max-h-[280px] overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--muted)]">
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

      <StatsBar stats={data?.stats} dataUpdatedAt={dataUpdatedAt} />
    </div>
  )
}
