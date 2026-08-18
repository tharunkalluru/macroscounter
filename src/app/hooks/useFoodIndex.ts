import { useEffect, useMemo, useState } from 'react'
import type { FoodRecord } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { FoodSearchService } from '../../domain/search/searchService'

export function useFoodIndex() {
  const [foods, setFoods] = useState<FoodRecord[] | null>(null)

  useEffect(() => {
    let cancelled = false
    new FoodRepo().listAll().then((f) => {
      if (!cancelled) setFoods(f)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const service = useMemo(() => (foods ? new FoodSearchService(foods) : null), [foods])

  return { foods, service, loading: foods === null }
}
