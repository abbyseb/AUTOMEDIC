import { useMemo, useState } from 'react'
import { DemoControls } from './components/DemoControls'
import { HeaderBar } from './components/HeaderBar'
import { IncidentTimeline } from './components/IncidentTimeline'
import { StatsBar } from './components/StatsBar'
import { WorkflowHealthRail } from './components/WorkflowHealthRail'
import { useAutomedicState } from './hooks/useAutomedicState'

export default function App() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useAutomedicState()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeIncidentId = selectedId ?? data?.activeIncidentId ?? null
  const activeIncident = useMemo(
    () => data?.incidents.find((i) => i.id === activeIncidentId) ?? data?.incidents[0],
    [data, activeIncidentId],
  )

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar
        status={data?.status}
        watchedCount={data?.stats.watchedCount}
        lastScanAt={data?.lastScanAt}
      >
        <DemoControls />
      </HeaderBar>

      <main className="flex-1 grid grid-cols-[280px_1fr_420px] gap-4 p-4 max-lg:grid-cols-1 min-h-0">
        <WorkflowHealthRail
          workflows={data?.watchedWorkflows}
          loading={isLoading}
          error={isError ? (error instanceof Error ? error.message : 'Failed to load') : null}
        />

        <IncidentTimeline
          incident={activeIncident}
          incidents={data?.incidents}
          activeIncidentId={activeIncident?.id}
          onSelectIncident={setSelectedId}
        />

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
