import { useState, useMemo, useCallback } from 'react'

const ALL = '__all__'

export function useFilters(entries) {
  const [group, setGroup] = useState(ALL)
  const [turn, setTurn] = useState(ALL)
  const [metric, setMetric] = useState(ALL)
  const [result, setResult] = useState(ALL)
  const [timeWindow, setTimeWindow] = useState('all')

  const filtered = useMemo(() => {
    let cutoff = null
    if (timeWindow !== 'all') {
      const minutes = parseInt(timeWindow, 10)
      cutoff = new Date(Date.now() - minutes * 60000)
    }
    return entries.filter(e =>
      (group === ALL || e.conversationGroupId === group) &&
      (turn === ALL || e.turnId === turn) &&
      (metric === ALL || e.metric === metric) &&
      (result === ALL || e.result === result) &&
      (!cutoff || new Date(e.date) >= cutoff)
    )
  }, [entries, group, turn, metric, result, timeWindow])

  const reset = useCallback(() => {
    setGroup(ALL)
    setTurn(ALL)
    setMetric(ALL)
    setResult(ALL)
    setTimeWindow('all')
  }, [])

  return {
    filters: { group, turn, metric, result, timeWindow },
    setters: { setGroup, setTurn, setMetric, setResult, setTimeWindow },
    filtered,
    reset,
    ALL,
  }
}
