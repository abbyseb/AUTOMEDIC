import { motion } from 'framer-motion'
import type { Diagnosis, FailureType, Gate } from '../types/automedic'

const FAILURE_COLORS: Record<FailureType, string> = {
  FIELD_MAPPING: 'border-sky-500/45 bg-sky-500/15 text-sky-200',
  AUTH_EXPIRED: 'border-amber-500/45 bg-amber-500/15 text-amber-200',
  RATE_LIMIT: 'border-violet-500/45 bg-violet-500/15 text-violet-200',
  TIMEOUT: 'border-orange-500/45 bg-orange-500/15 text-orange-200',
  API_ERROR: 'border-rose-500/45 bg-rose-500/15 text-rose-200',
  UNKNOWN: 'border-slate-500/45 bg-slate-500/15 text-slate-200',
}

type Props = {
  diagnosis?: Diagnosis | null
  gate?: Gate | null
}

export function DiagnosisPanel({ diagnosis, gate }: Props) {
  if (!diagnosis) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Diagnosis
        </h2>
        <p className="text-sm text-[var(--muted)]">Waiting for classifier output…</p>
      </section>
    )
  }

  const threshold = gate?.threshold ?? 0.8
  const confidencePct = Math.round(Math.min(1, Math.max(0, diagnosis.confidence)) * 100)
  const thresholdPct = Math.round(threshold * 100)
  const aboveGate = diagnosis.confidence >= threshold

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Diagnosis
      </h2>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide ${FAILURE_COLORS[diagnosis.failureType]}`}
        >
          {diagnosis.failureType}
        </span>
        <span
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
            diagnosis.autoRepairSafe
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          }`}
        >
          {diagnosis.autoRepairSafe ? 'AUTO-REPAIR SAFE' : 'NOT AUTO-REPAIRABLE'}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs text-[var(--muted)]">Confidence</span>
          <span className="text-sm font-semibold tabular-nums">
            {diagnosis.confidence.toFixed(2)}
            <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">
              {aboveGate ? '≥' : '<'} {threshold.toFixed(2)} gate
            </span>
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--pill)] border border-[var(--border)]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              aboveGate && diagnosis.autoRepairSafe ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            style={{ width: `${confidencePct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--text)]/80"
            style={{ left: `${thresholdPct}%` }}
            title={`Gate threshold ≥ ${threshold.toFixed(2)}`}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
          <span>0</span>
          <span className="font-medium text-[var(--text)]/70">≥ {threshold.toFixed(2)}</span>
          <span>1</span>
        </div>
      </div>

      {gate?.summary && (
        <p
          className={`mb-3 text-xs leading-relaxed ${
            gate.passed ? 'text-emerald-300/90' : 'text-amber-300/90'
          }`}
        >
          {gate.summary}
        </p>
      )}

      <p className="mb-3 text-sm leading-relaxed text-[var(--text)]/90">{diagnosis.reason}</p>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <Meta label="Failed node" value={diagnosis.failedNodeName} />
        <Meta
          label="Mapping"
          value={
            diagnosis.sourceField || diagnosis.targetField
              ? `${diagnosis.sourceField ?? '—'} → ${diagnosis.targetField ?? '—'}`
              : '—'
          }
        />
      </div>

      {diagnosis.observedFields.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Observed fields
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.observedFields.map((field) => (
              <span
                key={field}
                className="rounded border border-[var(--border)] bg-[var(--pill)] px-2 py-0.5 font-mono text-[11px] text-[var(--text)]/85"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--pill)] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate font-medium text-[var(--text)]" title={value}>
        {value}
      </div>
    </div>
  )
}
