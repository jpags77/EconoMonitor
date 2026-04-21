// lib/kimi.ts — all LLM calls route through NVIDIA NIM (OpenAI-compatible)

const NIM_BASE = 'https://integrate.api.nvidia.com/v1'
const KIMI_MODEL = 'moonshotai/kimi-k2.5'

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

// Non-streaming call — returns the full response text. Used for macro generation.
export async function callKimi(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      max_tokens: 2048,
    }),
  })
  if (!res.ok) throw new Error(`Kimi NIM error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content as string) ?? ''
}

// Streaming call — returns the raw Response for piping. Used for chat.
export async function streamKimiResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<Response> {
  return fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
    }),
  })
}
