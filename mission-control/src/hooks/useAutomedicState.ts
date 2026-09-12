import { useQuery } from '@tanstack/react-query'
import { fetchAutomedicState } from '../lib/api'

const POLL_MS = 1500

export function useAutomedicState() {
  return useQuery({
    queryKey: ['automedic-state'],
    queryFn: fetchAutomedicState,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  })
}
