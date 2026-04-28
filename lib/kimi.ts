// lib/kimi.ts — chat LLM calls via OpenAI API

const OPENAI_BASE = 'https://api.openai.com/v1'
const CHAT_MODEL = 'gpt-5-nano'

// Parses a single SSE line and returns the text delta, or null if there's nothing to emit.
// Exported for unit testing.
export function parseSSELine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  const data = trimmed.slice(6)
  if (data === '[DONE]') return null
  try {
    const parsed = JSON.parse(data)
    return (parsed.choices?.[0]?.delta?.content as string) ?? null
  } catch {
    return null
  }
}

// Transforms a raw NIM SSE stream (Uint8Array) into a plain-text stream of content tokens.
export function createSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const content = parseSSELine(line)
        if (content) controller.enqueue(encoder.encode(content))
      }
    },
    flush(controller) {
      if (buffer) {
        const content = parseSSELine(buffer)
        if (content) controller.enqueue(encoder.encode(content))
      }
    },
  })
}

// Streaming call — returns the raw Response for piping.
export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<Response> {
  return fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_completion_tokens: 4096,
    }),
  })
}
