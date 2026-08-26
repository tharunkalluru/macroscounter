const KG_PER_LB = 0.45359237

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function kgToLb(kg: number): number {
  return round1(kg / KG_PER_LB)
}

export function lbToKg(lb: number): number {
  return round1(lb * KG_PER_LB)
}
