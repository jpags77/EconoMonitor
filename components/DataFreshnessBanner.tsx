import { MacroEntry } from '@/lib/types'

interface Props {
  entry: MacroEntry
  todayUtc: string  // "YYYY-MM-DD"
}

export default function DataFreshnessBanner({ entry, todayUtc }: Props) {
  const isToday = entry.date === todayUtc
  const updatedAt = new Date(entry.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  if (isToday) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-950 border border-green-800 px-4 py-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="text-green-300">Data current — updated today at {updatedAt}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-950 border border-amber-800 px-4 py-2 text-sm">
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
      <span className="text-amber-300">
        Showing data from {entry.date} — today&apos;s update has not run yet
      </span>
    </div>
  )
}
