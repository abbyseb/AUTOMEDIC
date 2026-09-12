import type { Incident, PatientGraph, WatchedWorkflow } from '../types/automedic'
import { formatClock, glossFailure, isEscalatedIncident } from '../lib/timeline'
import { SurgicalDiff } from './SurgicalDiff'
import { WorkflowPreview } from './WorkflowPreview'

type Props = {
  incident?: Incident | null
  workflows: WatchedWorkflow[]
  patientGraph?: PatientGraph | null
  loading: boolean
  loadError: string | null
}

export function StagePanel({ incident, workflows, patientGraph, loading, loadError }: Props) {
  if (loading) {
    return <p className="font-mono text-[12px] text-[var(--ink-3)]">Loading state…</p>
  }
  if (loadError) {
    return <p className="font-mono text-[13px] text-[var(--sig-fault)]">{loadError}</p>
  }

  const preview = <WorkflowPreview graph={patientGraph} incident={incident} />

  if (!incident) {
    return (
      <div>
        <IdleStage workflows={workflows} />
        {preview}
      </div>
    )
  }
  if (isEscalatedIncident(incident)) {
    return (
      <div>
        <EscalateStage incident={incident} />
        {preview}
      </div>
    )
  }
  return (
    <div>
      <HealStage incident={incident} />
      {preview}
    </div>
  )
}

function IdleStage({ workflows }: { workflows: WatchedWorkflow[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Stage</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">WATCHING</h2>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-[var(--ink-2)]">
        Break a watched workflow field mapping, then Scan. AutoMedic diagnoses, patches only what
        evidence supports, and re-runs to verify.
      </p>
      <ul className="mt-8 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {workflows.map((w) => (
          <li key={w.id} className="flex items-stretch gap-3 py-3">
            <span
              className={`w-0.5 shrink-0 ${
                w.health === 'healthy'
                  ? 'bg-[var(--sig-ok)]'
                  : w.health === 'unhealthy'
                    ? 'bg-[var(--sig-fault)]'
                    : 'bg-[var(--rule)]'
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] text-[var(--ink)]">{w.name}</div>
              <div className="mt-0.5 font-mono text-[11px] text-[var(--ink-3)]">
                exec {w.lastExecutionId ?? '—'} · {formatClock(w.lastExecutionAt)} · {w.health}
              </div>
            </div>
          </li>
        ))}
        {workflows.length === 0 && (
          <li className="py-3 font-mono text-[12px] text-[var(--ink-3)]">No watched workflows</li>
        )}
      </ul>
    </div>
  )
}

function EscalateStage({ incident }: { incident: Incident }) {
  const ft = incident.diagnosis?.failureType ?? 'UNKNOWN'
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sig-hold)]">
        Escalated
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
        {ft}
      </h2>
      <p className="mt-1 text-[13px] text-[var(--ink-3)]">{glossFailure(ft)}</p>

      <p className="mt-6 text-xl font-semibold tracking-tight text-[var(--sig-hold)]">
        GATE REFUSED
        {incident.diagnosis?.confidence != null &&
          incident.gate?.threshold != null &&
          ` · ${incident.diagnosis.confidence.toFixed(2)} / ${incident.gate.threshold.toFixed(2)}`}
      </p>
      {incident.gate?.summary && (
        <p className="mt-2 font-mono text-[12px] text-[var(--ink-2)]">{incident.gate.summary}</p>
      )}
      {incident.diagnosis?.reason && (
        <div className="mt-4 max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            OpenAI reason
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
            {incident.diagnosis.reason}
          </p>
        </div>
      )}
      <p className="mt-8 border border-[var(--sig-hold)] bg-[color-mix(in_srgb,var(--sig-hold)_12%,var(--plate))] px-4 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--sig-hold)]">
        No workflow mutation performed
      </p>
      {incident.id.includes('seed') && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
          Seeded demo incident
        </p>
      )}
    </div>
  )
}

function HealStage({ incident }: { incident: Incident }) {
  const ft = incident.diagnosis?.failureType
  const d = incident.diagnosis
  const gate = incident.gate
  const patch = incident.patch
  const verify = incident.verify
  const showDiff =
    !!patch &&
    (patch.before || patch.after || patch.oldMapping || patch.newMapping) &&
    gate?.passed !== false

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
        {incident.status.split('_').join(' ').toUpperCase()} · exec {incident.executionId}
      </p>
      {ft && (
        <>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
            {ft}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--ink-3)]">{glossFailure(ft)}</p>
        </>
      )}
      {!ft && (
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
          {incident.status.toUpperCase()}
        </h2>
      )}

      {d?.reason && (
        <div className="mt-4 max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            OpenAI reason
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">{d.reason}</p>
        </div>
      )}

      {d && d.observedFields.length > 0 && (
        <p className="mt-3 font-mono text-[11px] text-[var(--ink-3)]">
          observed:{' '}
          {d.observedFields.slice(0, 8).join(', ')}
          {d.observedFields.length > 8 ? ` (+${d.observedFields.length - 8} more)` : ''}
        </p>
      )}

      {gate && (
        <p
          className={`mt-6 text-xl font-semibold tracking-tight ${
            gate.passed ? 'text-[var(--sig-ok)]' : 'text-[var(--sig-hold)]'
          }`}
        >
          {gate.passed ? 'GATE PASS' : 'GATE REFUSED'}
          {d?.confidence != null
            ? ` · ${d.confidence.toFixed(2)} ≥ ${gate.threshold.toFixed(2)}`
            : ''}
        </p>
      )}
      {gate?.summary && (
        <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">{gate.summary}</p>
      )}

      {showDiff && patch && (
        <div className="mt-8">
          <SurgicalDiff patch={patch} />
        </div>
      )}

      {verify?.status === 'success' && (
        <p className="mt-6 font-mono text-[13px] font-medium text-[var(--sig-ok)]">
          exec {verify.newExecutionId ?? '—'} · success
          {verify.durationMs != null ? ` · ${(verify.durationMs / 1000).toFixed(1)}s` : ''}
        </p>
      )}
      {verify?.status === 'error' && (
        <p className="mt-6 font-mono text-[13px] font-medium text-[var(--sig-fault)]">
          verify failed · exec {verify.newExecutionId ?? '—'}
        </p>
      )}
    </div>
  )
}
