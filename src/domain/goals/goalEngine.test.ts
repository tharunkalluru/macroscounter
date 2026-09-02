import { describe, expect, it } from 'vitest'
import { computeGoalTargets, computeKcalFloor } from './goalEngine'
import type { GoalEngineInput } from './types'

describe('computeKcalFloor', () => {
  it('matches the floor computeGoalTargets applies internally for a cut', () => {
    // male, 28, 170cm, 70kg -> BMR 1627.5, absolute floor 1500 -> floor is BMR.
    expect(computeKcalFloor('male', 70, 170, 28)).toBeCloseTo(1627.5, 5)
    // female, very low bodyweight -> absolute 1200 floor binds over BMR.
    expect(computeKcalFloor('female', 38, 150, 22)).toBe(1200)
  })
})

/**
 * Fixtures are hand-computed with Mifflin-St Jeor + the spec's activity
 * multipliers (sedentary 1.2, light 1.375, moderate 1.55, active 1.725,
 * very_active 1.9), rounding only the final kcal/gram outputs (Math.round,
 * half-up for the .5 cases below — matches JS `Math.round`).
 */
describe('computeGoalTargets — hand-computed fixtures', () => {
  it('male, sedentary, cut: BMR floor binds (BMR > TDEE-500)', () => {
    const input: GoalEngineInput = {
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
    }
    // BMR = 700 + 1062.5 - 140 + 5 = 1627.5; TDEE = 1953; raw cut = 1453 < BMR floor 1627.5
    const result = computeGoalTargets(input)
    expect(result.bmr).toBeCloseTo(1627.5, 5)
    expect(result.tdee).toBeCloseTo(1953, 5)
    expect(result.kcal).toBe(1628)
    expect(result.proteinG).toBe(126)
    expect(result.fatG).toBe(49)
    expect(result.carbsG).toBe(171)
  })

  it('female, very_active, cut: no floor binds', () => {
    const input: GoalEngineInput = {
      sex: 'female',
      age: 26,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'very_active',
      goal: 'cut',
    }
    // BMR = 600 + 1031.25 - 130 - 161 = 1340.25; TDEE = 2546.475; raw cut = 2046.475 > floor
    const result = computeGoalTargets(input)
    expect(result.bmr).toBeCloseTo(1340.25, 5)
    expect(result.kcal).toBe(2046)
    expect(result.proteinG).toBe(108)
    expect(result.fatG).toBe(42)
    expect(result.carbsG).toBe(309)
  })

  it('female, very low bodyweight: absolute 1200 kcal floor binds', () => {
    const input: GoalEngineInput = {
      sex: 'female',
      age: 22,
      heightCm: 150,
      weightKg: 38,
      activityLevel: 'sedentary',
      goal: 'cut',
    }
    // BMR = 380 + 937.5 - 110 - 161 = 1046.5 (< 1200 absolute floor)
    const result = computeGoalTargets(input)
    expect(result.bmr).toBeCloseTo(1046.5, 5)
    expect(result.kcal).toBe(1200)
    expect(result.proteinG).toBe(68)
    expect(result.fatG).toBe(27)
    expect(result.carbsG).toBe(171)
  })

  it('male, very low bodyweight: absolute 1500 kcal floor binds', () => {
    const input: GoalEngineInput = {
      sex: 'male',
      age: 20,
      heightCm: 160,
      weightKg: 45,
      activityLevel: 'sedentary',
      goal: 'cut',
    }
    // BMR = 450 + 1000 - 100 + 5 = 1355 (< 1500 absolute floor)
    const result = computeGoalTargets(input)
    expect(result.bmr).toBeCloseTo(1355, 5)
    expect(result.kcal).toBe(1500)
    expect(result.proteinG).toBe(81)
    expect(result.fatG).toBe(32) // 0.7 * 45 = 31.5 exactly (mathematically) -> rounds up
    expect(result.carbsG).toBe(222)
  })

  it('sedentary vs very_active with identical stats: activity multiplier changes target', () => {
    const base: GoalEngineInput = {
      sex: 'male',
      age: 35,
      heightCm: 178,
      weightKg: 85,
      activityLevel: 'sedentary',
      goal: 'maintain',
    }
    // BMR = 850 + 1112.5 - 175 + 5 = 1792.5
    const sedentary = computeGoalTargets(base)
    const veryActive = computeGoalTargets({ ...base, activityLevel: 'very_active' })

    expect(sedentary.kcal).toBe(2151)
    expect(sedentary.carbsG).toBe(250)
    expect(veryActive.kcal).toBe(3406)
    expect(veryActive.carbsG).toBe(564)
    expect(veryActive.kcal).toBeGreaterThan(sedentary.kcal)
  })

  it('male, moderate, gain: TDEE + 300 surplus', () => {
    const input: GoalEngineInput = {
      sex: 'male',
      age: 24,
      heightCm: 180,
      weightKg: 70,
      activityLevel: 'moderate',
      goal: 'gain',
    }
    // BMR = 700 + 1125 - 120 + 5 = 1710; TDEE = 2650.5; gain = 2950.5
    const result = computeGoalTargets(input)
    expect(result.kcal).toBe(2951)
    expect(result.proteinG).toBe(126)
    expect(result.fatG).toBe(49)
    expect(result.carbsG).toBe(502)
  })

  it('female, moderate, maintain', () => {
    const input: GoalEngineInput = {
      sex: 'female',
      age: 29,
      heightCm: 162,
      weightKg: 58,
      activityLevel: 'moderate',
      goal: 'maintain',
    }
    // BMR = 580 + 1012.5 - 145 - 161 = 1286.5; TDEE = 1994.075
    const result = computeGoalTargets(input)
    expect(result.kcal).toBe(1994)
    expect(result.proteinG).toBe(104)
    expect(result.fatG).toBe(41)
    expect(result.carbsG).toBe(302)
  })
})

describe('computeGoalTargets — editable protein/fat with re-validation', () => {
  const base: GoalEngineInput = {
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 80,
    activityLevel: 'moderate',
    goal: 'cut',
  }

  it('clamps protein g/kg above the 2.2 ceiling', () => {
    const result = computeGoalTargets({ ...base, proteinGPerKg: 3.5 })
    expect(result.proteinG).toBe(Math.round(2.2 * 80))
  })

  it('clamps protein g/kg below the 1.6 floor', () => {
    const result = computeGoalTargets({ ...base, proteinGPerKg: 1.0 })
    expect(result.proteinG).toBe(Math.round(1.6 * 80))
  })

  it('never allows fat g/kg below the 0.7 floor', () => {
    const result = computeGoalTargets({ ...base, fatGPerKg: 0.3 })
    expect(result.fatG).toBe(Math.round(0.7 * 80))
  })

  it('allows fat g/kg above the floor when explicitly set', () => {
    const result = computeGoalTargets({ ...base, fatGPerKg: 1.0 })
    expect(result.fatG).toBe(Math.round(1.0 * 80))
  })
})

describe('computeGoalTargets — property: macro sum vs kcal target, floors respected', () => {
  // Deterministic seeded PRNG (mulberry32) so this is reproducible in CI.
  function mulberry32(seed: number) {
    return function () {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const rand = mulberry32(42)
  const sexes: GoalEngineInput['sex'][] = ['male', 'female']
  const activityLevels: GoalEngineInput['activityLevel'][] = [
    'sedentary',
    'light',
    'moderate',
    'active',
    'very_active',
  ]
  const goals: GoalEngineInput['goal'][] = ['cut', 'maintain', 'gain']

  it('holds across 500 randomized realistic profiles', () => {
    for (let i = 0; i < 500; i++) {
      const input: GoalEngineInput = {
        sex: sexes[Math.floor(rand() * sexes.length)],
        age: Math.round(18 + rand() * 52),
        heightCm: Math.round(140 + rand() * 70),
        weightKg: Math.round(40 + rand() * 110),
        activityLevel: activityLevels[Math.floor(rand() * activityLevels.length)],
        goal: goals[Math.floor(rand() * goals.length)],
      }

      const result = computeGoalTargets(input)
      const macroKcal = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
      const diff = Math.abs(macroKcal - result.kcal)
      const tolerance = Math.max(result.kcal * 0.02, 4) // >=4 kcal absolute slack for integer rounding

      expect(diff, JSON.stringify(input)).toBeLessThanOrEqual(tolerance)
      expect(result.proteinG / input.weightKg, JSON.stringify(input)).toBeGreaterThanOrEqual(
        1.6 - 0.02
      )
      expect(result.fatG / input.weightKg, JSON.stringify(input)).toBeGreaterThanOrEqual(0.7 - 0.02)
    }
  })
})

describe('computeGoalTargets — goalRateLbPerWeek (Phase R.2 goal-rate slider)', () => {
  const base: GoalEngineInput = {
    sex: 'female',
    age: 29,
    heightCm: 162,
    weightKg: 58,
    activityLevel: 'very_active',
    goal: 'cut',
  }

  it('a 1 lb/week rate reproduces the legacy fixed 500 kcal/day deficit exactly', () => {
    const legacy = computeGoalTargets(base)
    const viaRate = computeGoalTargets({ ...base, goalRateLbPerWeek: 1 })
    expect(viaRate.kcal).toBe(legacy.kcal)
  })

  it('a 0.6 lb/week gain rate reproduces the legacy fixed 300 kcal/day surplus exactly', () => {
    const legacy = computeGoalTargets({ ...base, goal: 'gain' })
    const viaRate = computeGoalTargets({ ...base, goal: 'gain', goalRateLbPerWeek: 0.6 })
    expect(viaRate.kcal).toBe(legacy.kcal)
  })

  it('a faster cut rate produces a bigger deficit, still never below the safety floor', () => {
    const slow = computeGoalTargets({ ...base, goalRateLbPerWeek: 0.5 })
    const fast = computeGoalTargets({ ...base, goalRateLbPerWeek: 2 })
    expect(fast.kcal).toBeLessThan(slow.kcal)
    expect(fast.kcal).toBeGreaterThanOrEqual(Math.max(fast.bmr, FEMALE_FLOOR))
  })

  it('is ignored for maintain', () => {
    const withoutRate = computeGoalTargets({ ...base, goal: 'maintain' })
    const withRate = computeGoalTargets({ ...base, goal: 'maintain', goalRateLbPerWeek: 2 })
    expect(withRate.kcal).toBe(withoutRate.kcal)
  })
})

describe('computeGoalTargets — floorBufferKcal (Phase R.2 gentler-cut preference)', () => {
  it('raises the effective cut floor by the buffer amount when the floor binds', () => {
    const input: GoalEngineInput = {
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
    }
    const standard = computeGoalTargets(input)
    const gentler = computeGoalTargets({ ...input, floorBufferKcal: 150 })
    expect(gentler.kcal).toBe(standard.kcal + 150)
  })

  it('never lowers kcal when a negative buffer is passed', () => {
    const input: GoalEngineInput = {
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
      floorBufferKcal: -200,
    }
    const standard = computeGoalTargets({ ...input, floorBufferKcal: undefined })
    const result = computeGoalTargets(input)
    expect(result.kcal).toBe(standard.kcal)
  })
})

describe('computeGoalTargets — floorKcalOverride ("Low" medical-supervision floor)', () => {
  it('allows the cut target below the usual sex-based safety minimum', () => {
    const input: GoalEngineInput = {
      sex: 'female',
      age: 30,
      heightCm: 155,
      weightKg: 50, // BMR (~1158) sits below the 1200 sex-based floor
      activityLevel: 'sedentary',
      goal: 'cut',
      goalRateLbPerWeek: 2,
    }
    const standard = computeGoalTargets(input)
    expect(standard.kcal).toBe(1200) // sex-based absolute floor binds, not BMR

    const low = computeGoalTargets({ ...input, floorKcalOverride: 800 })
    expect(low.kcal).toBeLessThan(standard.kcal)
    expect(low.kcal).toBeGreaterThanOrEqual(800)
    expect(low.kcal).toBeGreaterThanOrEqual(Math.round(low.bmr)) // still never below BMR
  })

  it('never allows the target below the person\'s own BMR, no matter how low the override', () => {
    const input: GoalEngineInput = {
      sex: 'female',
      age: 60,
      heightCm: 150,
      weightKg: 45, // low BMR
      activityLevel: 'sedentary',
      goal: 'cut',
      goalRateLbPerWeek: 2,
      floorKcalOverride: 200, // absurdly low -- BMR still wins
    }
    const result = computeGoalTargets(input)
    expect(result.kcal).toBeGreaterThanOrEqual(Math.round(result.bmr))
  })

  it('is ignored (existing sex-based minimum applies) unless explicitly set', () => {
    // Same fixture as the "male, sedentary, cut: BMR floor binds" case above.
    const result = computeGoalTargets({
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
    })
    expect(result.kcal).toBe(1628)
  })
})

const FEMALE_FLOOR = 1200
