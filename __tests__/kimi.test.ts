import { parseSSELine } from '@/lib/kimi'

describe('parseSSELine', () => {
  it('extracts content from a valid SSE chunk', () => {
    const line = 'data: {"id":"x","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}'
    expect(parseSSELine(line)).toBe('Hello')
  })

  it('returns null for [DONE] sentinel', () => {
    expect(parseSSELine('data: [DONE]')).toBeNull()
  })

  it('returns null for lines without data: prefix', () => {
    expect(parseSSELine('event: message')).toBeNull()
    expect(parseSSELine('')).toBeNull()
  })

  it('returns null for chunks with no content (role announcement)', () => {
    const line = 'data: {"id":"x","choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}'
    expect(parseSSELine(line)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseSSELine('data: {invalid json}')).toBeNull()
  })
})
