import type { AutomedicState } from '../types/automedic'

export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const BASE_URL = (import.meta.env.VITE_AUTOMEDIC_BASE_URL as string | undefined)?.replace(/\/$/, '')
const SECRET = import.meta.env.VITE_AUTOMEDIC_SECRET as string | undefined

type MutationResult = { ok: true; mock?: boolean }

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' }
  if (!USE_MOCK && SECRET) headers['X-AutoMedic-Secret'] = SECRET
  return headers
}

export async function fetchAutomedicState(): Promise<AutomedicState> {
  const url = USE_MOCK || !BASE_URL ? '/mock/state.json' : `${BASE_URL}/automedic/state`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`state fetch failed: ${res.status}`)
  return (await res.json()) as AutomedicState
}

async function postAutomedic(path: 'break' | 'break-auth' | 'scan' | 'reset'): Promise<MutationResult> {
  if (USE_MOCK || !BASE_URL) {
    return { ok: true, mock: true }
  }

  const res = await fetch(`${BASE_URL}/automedic/${path}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return { ok: true }
}

export function postAutomedicBreak(): Promise<MutationResult> {
  return postAutomedic('break')
}

export function postAutomedicBreakAuth(): Promise<MutationResult> {
  return postAutomedic('break-auth')
}

export function postAutomedicScan(): Promise<MutationResult> {
  return postAutomedic('scan')
}

export function postAutomedicReset(): Promise<MutationResult> {
  return postAutomedic('reset')
}
