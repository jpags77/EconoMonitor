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
