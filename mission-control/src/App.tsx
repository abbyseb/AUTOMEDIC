import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAutomedicState } from './hooks/useAutomedicState'
import { postAutomedicAudit, postAutomedicBreak, postAutomedicBreakAuth, postAutomedicHitlPatch, postAutomedicReset, postAutomedicScan, postAutomedicScenario } from './lib/api'
import type { MissionStatus } from './types/automedic'
import { RecordPanel } from './components/RecordPanel'
import { StagePanel } from './components/StagePanel'
import { isEscalatedIncident } from './lib/timeline'

const TINT: Record<MissionStatus, string> = {
  WATCHING: 'var(--tint-watch)',
  SCANNING: 'var(--tint-scan)',
  HEALING: 'var(--tint-heal)',
  HEALED: 'var(--tint-healed)',
  ERROR: 'var(--tint-error)',
}

const BAND: Record<MissionStatus, string> = {
  WATCHING: 'var(--rule)',
  SCANNING: 'var(--sig-live)',
  HEALING: 'var(--sig-hold)',
  HEALED: 'var(--sig-ok)',
  ERROR: 'var(--sig-fault)',
}

export default function App() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, dataUpdatedAt, isFetching } = useAutomedicState()
  const [mutating, setMutating] = useState(false)
  const [mutateError, setMutateError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const status = data?.status ?? 'WATCHING'

  const active = useMemo(() => {
    const id = selectedId ?? data?.activeIncidentId
    return data?.incidents.find((i) => i.id === id) ?? data?.incidents[0] ?? null
  }, [data, selectedId])

  const stageWash =
    active && isEscalatedIncident(active)
      ? 'var(--tint-heal)'
      : TINT[status]

  const pollAgeSec =
    dataUpdatedAt > 0 ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)) : null

  async function run(fn: () => Promise<unknown>) {
    setMutating(true)
    setMutateError(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['automedic-state'] })
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setMutating(false)
    }
  }

  return (
    <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[var(--plate)]">
      <div
        className="status-band h-1.5 w-full shrink-0"
        style={{ backgroundColor: BAND[status] }}
        aria-hidden
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
        <RecordPanel
          status={status}
          watchedCount={data?.stats.watchedCount}
          incident={active}
          incidents={data?.incidents ?? []}
          selectedId={selectedId ?? active?.id ?? null}
          onSelect={setSelectedId}
          mutating={mutating}
          mutateError={mutateError}
          pollAgeSec={isFetching && pollAgeSec === 0 ? 0 : pollAgeSec}
          onScan={() => void run(postAutomedicScan)}
          onAudit={() => void run(postAutomedicAudit)}
          onReset={() => void run(postAutomedicReset)}
          onBreak={() => void run(postAutomedicBreak)}
          onBreakAuth={() => void run(postAutomedicBreakAuth)}
          onScenarioL1={() => void run(() => postAutomedicScenario('l1'))}
          onScenarioL2={() => void run(() => postAutomedicScenario('l2'))}
          onScenarioL3={() => void run(() => postAutomedicScenario('l3'))}
        />

        <main
          className="stage-wash min-h-0 overflow-auto px-8 py-8 md:px-12 md:py-10"
          style={{ backgroundColor: stageWash }}
        >
          <header className="mb-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ink-3)]">
              Mission Control
            </p>
          </header>
          <StagePanel
            incident={active}
            workflows={data?.watchedWorkflows ?? []}
            patientGraph={data?.patientGraph}
            loading={isLoading && !data}
            mutating={mutating}
            onHitlPatch={(id) => void run(() => postAutomedicHitlPatch(id, 'patch'))}
            onHitlIgnore={(id) => void run(() => postAutomedicHitlPatch(id, 'ignore'))}
            loadError={
              isError ? (error instanceof Error ? error.message : 'Could not load state') : null
            }
          />
        </main>
      </div>
    </div>
  )
}
