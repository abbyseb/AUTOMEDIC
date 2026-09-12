import type { Incident, TimelineStep } from '../types/automedic'

export const HEAL_STEPS: TimelineStep[] = [
  'DETECTED',
  'DIAGNOSING',
  'DIAGNOSED',
  'GATE',
  'PATCHING',
  'PATCHED',
  'RE_RUNNING',
  'VERIFIED',
]

export const ESCALATE_STEPS: TimelineStep[] = [
  'DETECTED',
  'DIAGNOSING',
  'DIAGNOSED',
  'GATE',
  'ESCALATED',
]

export function isEscalatedIncident(incident?: Incident | null): boolean {
  if (!incident) return false
  return (
    incident.status === 'escalated' ||
    incident.status === 'gate_refused' ||
    incident.gate?.passed === false ||
    incident.timeline.some((e) => e.step === 'ESCALATED' && e.status === 'done')
  )
}

export function stepOrderFor(incident?: Incident | null): TimelineStep[] {
  return isEscalatedIncident(incident) ? ESCALATE_STEPS : HEAL_STEPS
}

export function timelineFingerprint(
  incidentId: string,
  events: { step: string; status: string; at: string | null }[],
): string {
  return `${incidentId}::${events
    .filter((e) => e.status === 'done' || e.status === 'active' || e.status === 'failed')
    .map((e) => `${e.step}:${e.status}:${e.at ?? ''}`)
    .join('|')}`
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function glossFailure(ft?: string | null): string | null {
  if (!ft) return null
  if (ft === 'FIELD_MAPPING') return 'Broken field mapping'
  if (ft === 'AUTH_EXPIRED') return 'Expired credentials'
  if (ft === 'SILENT_DRIFT') return 'Silent dangling reference'
  if (ft === 'SEMANTIC_MISMATCH') return 'Semantic / shape mismatch'
  return ft.split('_').join(' ').toLowerCase()
}
