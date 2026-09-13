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
  mutating?: boolean
  onHitlPatch?: (incidentId: string) => void
  onHitlIgnore?: (incidentId: string) => void
}

export function StagePanel({
  incident,
  workflows,
  patientGraph,
  loading,
  loadError,
  mutating,
  onHitlPatch,
  onHitlIgnore,
}: Props) {
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
        <EscalateStage
          incident={incident}
          mutating={mutating}
          onHitlPatch={onHitlPatch}
          onHitlIgnore={onHitlIgnore}
        />
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

function EscalateStage({
  incident,
  mutating,
  onHitlPatch,
  onHitlIgnore,
}: {
  incident: Incident
  mutating?: boolean
  onHitlPatch?: (incidentId: string) => void
  onHitlIgnore?: (incidentId: string) => void
}) {
  const ft = incident.diagnosis?.failureType ?? 'UNKNOWN'
  const suggestions = incident.suggestions ?? []
  const hitlReady =
    (ft === 'SEMANTIC_MISMATCH' || ft === 'SILENT_DRIFT') &&
    (suggestions.length > 0 ||
      (!!incident.diagnosis?.sourceField && !!incident.diagnosis?.targetField)) &&
    typeof onHitlPatch === 'function'
  const canIgnore =
    (ft === 'SEMANTIC_MISMATCH' || ft === 'SILENT_DRIFT') && typeof onHitlIgnore === 'function'
  const reasonLabel = ft === 'SILENT_DRIFT' ? 'Audit reason' : 'OpenAI reason'

  // Only show proposals when HITL can act (L1/L3). Never invent fake remap chips for FIELD_MAPPING refuses.
  const displaySuggestions =
    ft === 'SEMANTIC_MISMATCH' || ft === 'SILENT_DRIFT'
      ? suggestions.length > 0
        ? suggestions
        : incident.diagnosis?.sourceField && incident.diagnosis?.targetField
          ? [
              {
                mappedField: ft === 'SILENT_DRIFT' ? 'expression' : 'customerEmail',
                expectedField: incident.diagnosis.sourceField,
                replacementField: incident.diagnosis.targetField,
              },
            ]
          : []
      : []

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
            {reasonLabel}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
            {incident.diagnosis.reason}
          </p>
        </div>
      )}

      {displaySuggestions.length > 0 && (
        <div className="mt-6 max-w-xl border border-[var(--rule)] bg-[var(--plate)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            HITL proposals
          </p>
          <ul className="mt-2 space-y-1.5 font-mono text-[12px] text-[var(--ink)]">
            {displaySuggestions.map((s, i) => (
              <li key={`${s.mappedField}-${s.replacementField}-${i}`}>
                {s.mappedField !== 'expression' && (
                  <>
                    <span className="text-[var(--ink-2)]">{s.mappedField}</span>
                    {' ← '}
                  </>
                )}
                <span className="text-[var(--sig-fault)]">
                  {s.expectedField ? `$json.${s.expectedField}` : 'wrong source'}
                </span>
                {' → '}
                <span className="text-[var(--sig-ok)]">$json.{s.replacementField}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 border border-[var(--sig-hold)] bg-[color-mix(in_srgb,var(--sig-hold)_12%,var(--plate))] px-4 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--sig-hold)]">
        No workflow mutation performed
      </p>

      {(hitlReady || canIgnore) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hitlReady && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onHitlPatch?.(incident.id)}
              className="border border-[var(--ink)] bg-[var(--ink)] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--plate)] disabled:opacity-50"
            >
              {mutating ? 'Working…' : 'Patch'}
            </button>
          )}
          {canIgnore && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onHitlIgnore?.(incident.id)}
              className="border border-[var(--rule)] bg-transparent px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              Ignore
            </button>
          )}
        </div>
      )}

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
          {verify.newExecutionId
            ? `exec ${verify.newExecutionId} · success`
            : 'verify · success'}
          {verify.durationMs != null ? ` · ${(verify.durationMs / 1000).toFixed(1)}s` : ''}
        </p>
      )}
      {verify?.status === 'error' && (
        <p className="mt-6 font-mono text-[13px] font-medium text-[var(--sig-fault)]">
          {verify.newExecutionId
            ? `verify failed · exec ${verify.newExecutionId}`
            : 'verify failed'}
        </p>
      )}
    </div>
  )
}
