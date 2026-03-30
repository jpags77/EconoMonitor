import MacroStatusCard from '@/components/MacroStatusCard'
import ActionPanel from '@/components/ActionPanel'
import AssetGrid from '@/components/AssetGrid'
import TrendChart from '@/components/TrendChart'
import DriversHeadlines from '@/components/DriversHeadlines'
import { supabase } from '@/lib/db'
import { MacroEntry } from '@/lib/types'

// Query Supabase directly — no self-referential HTTP call needed in App Router
async function getEntries(): Promise<MacroEntry[]> {
  const { data, error } = await supabase
    .from('macro_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Failed to load entries:', error.message)
    return []
  }
  return data as MacroEntry[]
}

export default async function Dashboard() {
  const entries = await getEntries()
  const latest = entries[0]

  if (!latest) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">EconoMonitor</h1>
        <p className="text-gray-400 mb-6">No data yet. Trigger a generation to get started.</p>
        <code className="text-sm text-gray-500 bg-gray-900 px-4 py-2 rounded">
          POST /api/generate
        </code>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">EconoMonitor</h1>
        <p className="text-gray-500 text-sm">
          &ldquo;We are not predicting the future. We are detecting when the present is changing.&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MacroStatusCard entry={latest} />
        <ActionPanel actionBias={latest.action_bias} />
      </div>

      <AssetGrid entry={latest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart entries={entries} />
        <DriversHeadlines entry={latest} />
      </div>
    </main>
  )
}
