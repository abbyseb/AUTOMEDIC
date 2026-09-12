import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Incident, MissionStatus } from '../types/automedic'
import {
  formatClock,
  isEscalatedIncident,
  stepOrderFor,
  timelineFingerprint,
} from '../lib/timeline'

type Props = {
  status: MissionStatus
  watchedCount?: number
  incident?: Incident | null
  incidents: Incident[]
  selectedId: string | null
  onSelect: (id: string) => void
  mutating: boolean
  mutateError: string | null
  pollAgeSec: number | null
  onScan: () => void
  onReset: () => void
  onBreak: () => void
  onBreakAuth: () => void
}

export function RecordPanel({
  status,
  watchedCount,
  incident,
  incidents,
  selectedId,
  onSelect,
  mutating,
  mutateError,
  pollAgeSec,
  onScan,
  onReset,
  onBreak,
  onBreakAuth,
}: Props) {
  const reduce = useReducedMotion()
  const order = stepOrderFor(incident)
  const byStep = new Map((incident?.timeline ?? []).map((e) => [e.step, e]))
  const [animateKeys, setAnimateKeys] = useState<Set<string>>(() => new Set())
  const prevFp = useRef('')

  useEffect(() => {
    if (!incident) {
      prevFp.current = ''
      return
    }
    const fp = timelineFingerprint(incident.id, incident.timeline)
    if (!prevFp.current) {
      prevFp.current = fp
      return
    }
    if (prevFp.current === fp) return

    const prevId = prevFp.current.split('::')[0]
    prevFp.current = fp
    if (prevId !== incident.id) {
      setAnimateKeys(new Set())
      return
    }

    const fresh = new Set<string>()
    for (const e of incident.timeline) {
      if (e.status === 'done' || e.status === 'active' || e.status === 'failed') {
        fresh.add(`${e.step}:${e.at ?? ''}`)
      }
    }
    setAnimateKeys(fresh)
    const t = window.setTimeout(() => setAnimateKeys(new Set()), 400)
    return () => window.clearTimeout(t)
  }, [incident])

  const pollStale = pollAgeSec != null && pollAgeSec > 5

  return (
    <aside className="relative flex h-full min-h-0 flex-col border-r border-[var(--rule)] bg-[var(--plate-recess)]">
      <div className="recess-grid absolute inset-0" aria-hidden />
      <div className="relative flex min-h-0 flex-1 flex-col px-5 py-5">
        <div>
          <h1 className="nameplate text-[28px] leading-none text-[var(--ink)] md:text-[32px]">
            AutoMedic
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-3)]">
            Mission Control
          </p>
          <div className="mt-4 h-px bg-[var(--rule)]" />
          <p className="mt-3 font-mono text-[12px] text-[var(--ink-2)]">
            <span className="text-[var(--ink)]">{status}</span>
            {typeof watchedCount === 'number' ? ` · ${watchedCount}` : ''}
          </p>
          {pollAgeSec != null && (
            <p
              className={`mt-1 font-mono text-[10px] ${
                pollStale ? 'text-[var(--sig-hold)]' : 'text-[var(--ink-3)]'
              }`}
            >
              last poll {pollAgeSec}s ago
            </p>
          )}
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            Record
          </p>
          {!incident && (
            <p className="mt-3 font-mono text-[12px] text-[var(--ink-3)]">No active incident.</p>
          )}
          {incident && (
            <ol className="mt-3 space-y-1.5">
              {order.map((step) => {
                const event = byStep.get(step)
                const st = event?.status ?? 'pending'
                const fp = `${step}:${event?.at ?? ''}`
                const shouldAnimate = !reduce && animateKeys.has(fp)
                const active = st === 'active'
                const escalate =
                  isEscalatedIncident(incident) && (step === 'GATE' || step === 'ESCALATED')

                return (
                  <motion.li
                    key={step}
                    initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className={`grid grid-cols-[4.5rem_1fr] gap-2 font-mono text-[11px] leading-snug ${
                      st === 'pending' ? 'text-[var(--ink-3)]' : 'text-[var(--ink-2)]'
                    }`}
                  >
                    <span className={active ? 'text-[var(--sig-live)]' : ''}>
                      {formatClock(event?.at)}
                    </span>
                    <span>
                      <span
                        className={
                          escalate
                            ? 'text-[var(--sig-hold)]'
                            : active
                              ? 'text-[var(--sig-live)]'
                              : st === 'failed'
                                ? 'text-[var(--sig-fault)]'
                                : 'text-[var(--ink)]'
                        }
                      >
                        {step}
                        {active ? ' ▌' : ''}
                      </span>
                      {event?.durationMs != null && (
                        <span className="text-[var(--ink-3)]"> {event.durationMs}ms</span>
                      )}
                      {event?.message && (
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-3)]">
                          {event.message}
                        </span>
                      )}
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="mt-4 border-t border-[var(--rule)] pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            Open
          </p>
          <ul className="mt-2 space-y-1">
            {incidents.map((inc) => {
              const selected = (selectedId ?? incident?.id) === inc.id
              const seeded = inc.id.includes('seed')
              return (
                <li key={inc.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(inc.id)}
                    className={`flex w-full items-start gap-2 border-l-2 px-2 py-1.5 text-left transition ${
                      selected
                        ? 'border-[var(--ink)] bg-[color-mix(in_srgb,var(--plate)_55%,transparent)]'
                        : 'border-transparent hover:border-[var(--rule)]'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[var(--ink-3)]">
                      {inc.executionId || inc.id.replace(/^inc_/, '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-[var(--ink)]">
                        {inc.workflowName}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ink-3)]">
                        {inc.diagnosis?.failureType ?? inc.status}
                        {seeded ? ' · SEEDED' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
            {incidents.length === 0 && (
              <li className="font-mono text-[11px] text-[var(--ink-3)]">None</li>
            )}
          </ul>
        </div>

        {mutateError && (
          <p className="mt-3 font-mono text-[11px] text-[var(--sig-fault)]">{mutateError}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={mutating}
            onClick={onScan}
            className="border border-[var(--ink)] bg-[var(--ink)] px-3 py-2.5 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--plate)] disabled:opacity-50"
          >
            {mutating ? 'Working' : 'Scan'}
          </button>
          <button
            type="button"
            disabled={mutating}
            onClick={onReset}
            className="border border-[var(--rule)] bg-transparent px-3 py-2.5 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          disabled={mutating}
          onClick={onBreak}
          className="mt-2 w-full border border-transparent py-1.5 text-left font-mono text-[10px] text-[var(--ink-3)] underline-offset-2 hover:text-[var(--ink-2)] hover:underline disabled:opacity-50"
        >
          Simulate vendor rename
        </button>
        <button
          type="button"
          disabled={mutating}
          onClick={onBreakAuth}
          className="w-full border border-transparent py-1.5 text-left font-mono text-[10px] text-[var(--ink-3)] underline-offset-2 hover:text-[var(--ink-2)] hover:underline disabled:opacity-50"
        >
          Simulate auth expiry
        </button>
      </div>
    </aside>
  )
}
