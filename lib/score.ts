// Each signal ranges ±2. With N signals, raw sum ranges ±(2N).
// Default N=5 preserves legacy 5-signal (±10) behavior.
export function normalizeScore(rawSum: number, signalCount = 5): number {
  const max = signalCount * 2
  const min = -max
  const clamped = Math.max(min, Math.min(max, rawSum))
  return Math.round(((clamped - min) / (max - min)) * 100)
}
