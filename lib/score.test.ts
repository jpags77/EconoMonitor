import { normalizeScore } from './score'

test('max score (+10) normalizes to 100', () => {
  expect(normalizeScore(10)).toBe(100)
})

test('min score (-10) normalizes to 0', () => {
  expect(normalizeScore(-10)).toBe(0)
})

test('neutral score (0) normalizes to 50', () => {
  expect(normalizeScore(0)).toBe(50)
})

test('out-of-range high (15) clamps to 100', () => {
  expect(normalizeScore(15)).toBe(100)
})

test('out-of-range low (-15) clamps to 0', () => {
  expect(normalizeScore(-15)).toBe(0)
})

test('6-signal max (+12) normalizes to 100', () => {
  expect(normalizeScore(12, 6)).toBe(100)
})

test('6-signal min (-12) normalizes to 0', () => {
  expect(normalizeScore(-12, 6)).toBe(0)
})

test('6-signal neutral (0) normalizes to 50', () => {
  expect(normalizeScore(0, 6)).toBe(50)
})

test('6-signal out-of-range high (20) clamps to 100', () => {
  expect(normalizeScore(20, 6)).toBe(100)
})

test('6-signal mid-range (+6) normalizes over ±12, not ±10', () => {
  // (6 + 12) / 24 * 100 = 75  (old ±10 impl would give 80)
  expect(normalizeScore(6, 6)).toBe(75)
})

test('default signalCount stays 5 (legacy behavior)', () => {
  expect(normalizeScore(10)).toBe(100)
})
