import type { AutomedicState } from '../types/automedic'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const BASE_URL = (import.meta.env.VITE_AUTOMEDIC_BASE_URL as string | undefined)?.replace(/\/$/, '')
const SECRET = import.meta.env.VITE_AUTOMEDIC_SECRET as string | undefined

export async function fetchAutomedicState(): Promise<AutomedicState> {
  const url = USE_MOCK || !BASE_URL ? '/mock/state.json' : `${BASE_URL}/automedic/state`
  const headers: HeadersInit = { Accept: 'application/json' }
  if (!USE_MOCK && SECRET) headers['X-AutoMedic-Secret'] = SECRET

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`state fetch failed: ${res.status}`)
  return (await res.json()) as AutomedicState
}
