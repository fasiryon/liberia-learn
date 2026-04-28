"use client"
import { useCallback, useEffect, useRef } from "react"

type PollOptions = {
  intervalMs?: number
  onNewAssignment?: () => void
  enabled?: boolean
}

export function useAssignmentPolling(
  fetchAssignments: () => Promise<void>,
  options: PollOptions = {}
) {
  const { intervalMs = 30000, enabled = true } = options

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCountRef = useRef<number>(0)

  const poll = useCallback(async () => {
    try {
      await fetchAssignments()
    } catch {
      // Polling is intentionally non-blocking; the next interval/manual refresh retries.
    }
  }, [fetchAssignments])

  useEffect(() => {
    if (!enabled) return
    void poll()
    intervalRef.current = setInterval(poll, intervalMs)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [poll, intervalMs, enabled])

  const manualRefresh = useCallback(async () => {
    await poll()
  }, [poll])

  return { manualRefresh, lastCountRef }
}
