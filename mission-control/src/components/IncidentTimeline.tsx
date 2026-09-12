import { motion } from 'framer-motion'
import type { Incident, TimelineEvent, TimelineStep } from '../types/automedic'

const HEAL_STEPS: TimelineStep[] = [
  'DETECTED',
  'DIAGNOSING',
  'DIAGNOSED',
  'GATE',
  'PATCHING',
  'PATCHED',
  'RE_RUNNING',
  'VERIFIED',
]

const ESCALATE_STEPS: TimelineStep[] = [
  'DETECTED',
  'DIAGNOSING',
  'DIAGNOSED',
  'GATE',
  'ESCALATED',
]

type Props = {
  incident?: Incident | null
  incidents?: Incident[]
  activeIncidentId?: string | null
  onSelectIncident?: (id: string) => void
}

export function IncidentTimeline({
  incident,
  incidents = [],
  activeIncidentId,
  onSelectIncident,
}: Props) {
  const isEscalated =
    incident?.status === 'escalated' ||
    incident?.gate?.passed === false ||
    incident?.timeline.some((e) => e.step === 'ESCALATED' && e.status === 'done')

  const stepOrder = isEscalated ? ESCALATE_STEPS : HEAL_STEPS
  const byStep = new Map((incident?.timeline ?? []).map((e) => [e.step, e]))

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 h-full flex flex-col min-h-0">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Incident timeline
      </h2>

      {incidents.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {incidents.map((inc) => {
            const active = inc.id === activeIncidentId
            return (
              <button
                key={inc.id}
                type="button"
                onClick={() => onSelectIncident?.(inc.id)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                  active
                    ? 'border-amber-500/50 bg-amber-500/10 text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--pill)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <div className="font-medium text-sm text-[var(--text)]">{inc.workflowName}</div>
                <div className="uppercase tracking-wide opacity-80">
                  {inc.status} · {inc.diagnosis?.failureType ?? 'pending'}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {!incident && (
        <p className="text-sm text-[var(--muted)]">No active incident — waiting for /state.</p>
      )}

      {incident && (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">
            {incident.errorMessage || 'Heal loop in progress'}
          </p>
          <ol className="relative space-y-0 overflow-auto pr-1 flex-1">
            {stepOrder.map((step, index) => {
              const event = byStep.get(step)
              const status = event?.status ?? 'pending'
              return (
                <TimelineRow
                  key={step}
                  step={step}
                  event={event}
                  status={status}
                  isLast={index === stepOrder.length - 1}
                  escalateStyle={isEscalated && (step === 'GATE' || step === 'ESCALATED')}
                />
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

function TimelineRow({
  step,
  event,
  status,
  isLast,
  escalateStyle,
}: {
  step: TimelineStep
  event?: TimelineEvent
  status: TimelineEvent['status'] | 'pending'
  isLast: boolean
  escalateStyle?: boolean
}) {
  const dot =
    status === 'done'
      ? escalateStyle
        ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
        : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]'
      : status === 'active'
        ? 'bg-sky-400 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.55)]'
        : status === 'failed'
          ? 'bg-rose-400'
          : status === 'skipped'
            ? 'bg-amber-500/80'
            : 'bg-slate-600'

  const label =
    status === 'skipped' && step === 'GATE'
      ? 'ESCALATED TO HUMAN'
      : step.replaceAll('_', '-')

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex gap-3 pb-5"
    >
      {!isLast && (
        <span className="absolute left-[7px] top-4 bottom-0 w-px bg-[var(--border)]" aria-hidden />
      )}
      <span className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className={`text-sm font-semibold ${
              escalateStyle ? 'text-amber-300' : 'text-[var(--text)]'
            }`}
          >
            {label}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{status}</span>
          {event?.at && (
            <span className="text-[11px] text-[var(--muted)] ml-auto">
              {new Date(event.at).toLocaleTimeString()}
              {event.durationMs != null ? ` · ${event.durationMs}ms` : ''}
            </span>
          )}
        </div>
        {event?.message && (
          <p className="mt-0.5 text-xs text-[var(--muted)] leading-relaxed">{event.message}</p>
        )}
      </div>
    </motion.li>
  )
}
