// 5 signals × max ±2 = range of -10 to +10
export function normalizeScore(rawSum: number): number {
  const min = -10
  const max = 10
  const clamped = Math.max(min, Math.min(max, rawSum))
  return Math.round(((clamped - min) / (max - min)) * 100)
}
