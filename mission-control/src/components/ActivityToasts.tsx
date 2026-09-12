import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Incident, TimelineEvent } from '../types/automedic'

type Toast = {
  id: string
  title: string
  detail: string | null
}

type Props = {
  incident: Incident | null | undefined
}

function fingerprint(events: TimelineEvent[]): string {
  return events
    .filter((e) => e.status === 'done' || e.status === 'active' || e.status === 'failed')
    .map((e) => `${e.step}:${e.status}:${e.at ?? ''}`)
    .join('|')
}

export function ActivityToasts({ incident }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevKey = useRef<string>('')
  const incidentId = incident?.id ?? ''
  const timeline = incident?.timeline
  const timelineKey = timeline ? fingerprint(timeline) : ''

  useEffect(() => {
    if (!incidentId || !timelineKey || !timeline?.length) return

    const key = `${incidentId}::${timelineKey}`
    if (prevKey.current === key) return

    const prev = prevKey.current
    prevKey.current = key

    // Skip initial mount so we don't spam toasts for already-loaded mock state
    if (!prev) return

    const latest = [...timeline]
      .reverse()
      .find((e) => e.status === 'done' || e.status === 'active' || e.status === 'failed')
    if (!latest) return

    const id = `${incidentId}-${latest.step}-${latest.at ?? Date.now()}`
    setToasts((t) => [
      ...t.slice(-3),
      {
        id,
        title: latest.step.replaceAll('_', ' '),
        detail: latest.message,
      },
    ])

    // No effect cleanup — poll identity churn must not cancel dismiss timers
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4200)
  }, [incidentId, timelineKey, timeline])

  return (
    <div
      className="pointer-events-none fixed bottom-16 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, x: 8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 shadow-lg shadow-black/40"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              {toast.title}
            </div>
            {toast.detail && (
              <p className="mt-1 text-xs leading-snug text-[var(--text)]/85">{toast.detail}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
