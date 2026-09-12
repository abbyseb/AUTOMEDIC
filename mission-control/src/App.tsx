import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ActivityToasts } from './components/ActivityToasts'
import { DemoControls } from './components/DemoControls'
import { DiagnosisPanel } from './components/DiagnosisPanel'
import { HeaderBar } from './components/HeaderBar'
import { IncidentTimeline } from './components/IncidentTimeline'
import { PatchDiffPanel } from './components/PatchDiffPanel'
import { StatsBar } from './components/StatsBar'
import { WorkflowHealthRail } from './components/WorkflowHealthRail'
import { useAutomedicState } from './hooks/useAutomedicState'
import { postAutomedicBreak, postAutomedicReset, postAutomedicScan } from './lib/api'

export default function App() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, dataUpdatedAt } = useAutomedicState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)

  const activeIncidentId = selectedId ?? data?.activeIncidentId ?? null
  const activeIncident = useMemo(
    () => data?.incidents.find((i) => i.id === activeIncidentId) ?? data?.incidents[0],
    [data, activeIncidentId],
  )

  async function runMutation(fn: () => Promise<unknown>) {
    setMutating(true)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['automedic-state'] })
    } catch (err) {
      console.error(err)
    } finally {
      setMutating(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar
        status={data?.status}
        watchedCount={data?.stats.watchedCount}
        lastScanAt={data?.lastScanAt}
      >
        <DemoControls
          disabled={mutating}
          onBreak={() => void runMutation(postAutomedicBreak)}
          onScan={() => void runMutation(postAutomedicScan)}
          onReset={() => void runMutation(postAutomedicReset)}
        />
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

        <aside className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-6 overflow-auto min-h-0">
          <DiagnosisPanel diagnosis={activeIncident?.diagnosis} gate={activeIncident?.gate} />
          <PatchDiffPanel patch={activeIncident?.patch ?? null} />
        </aside>
      </main>

      <StatsBar stats={data?.stats} dataUpdatedAt={dataUpdatedAt} />
      <ActivityToasts incident={activeIncident} />
    </div>
  )
}
