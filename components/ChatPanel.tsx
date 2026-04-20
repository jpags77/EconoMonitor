'use client'

import { useState, useRef, useEffect } from 'react'
import { MacroEntry } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const DISCLAIMER: Message = {
  role: 'assistant',
  content:
    "I'm EconoMonitor's macro assistant. I can answer questions about today's macro conditions, asset signals, and current financial news. Not financial advice — always do your own research.",
}

export default function ChatPanel({ entry }: { entry: MacroEntry }) {
  const [messages, setMessages] = useState<Message[]>([DISCLAIMER])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || streaming) return

    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, entry }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong — please try again.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        EconoMonitor Chat
      </h2>

      <div className="overflow-y-auto max-h-96 flex flex-col gap-3 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.content || (streaming && i === messages.length - 1 ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </span>
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={streaming}
          placeholder="Ask about today's macro conditions..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-xl transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
