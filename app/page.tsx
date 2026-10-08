import MacroStatusCard from '@/components/MacroStatusCard'
import ActionPanel from '@/components/ActionPanel'
import AssetGrid from '@/components/AssetGrid'
import TrendChart from '@/components/TrendChart'
import DriversHeadlines from '@/components/DriversHeadlines'
import MacroExplainer from '@/components/MacroExplainer'
import MarketExplainer from '@/components/MarketExplainer'
import KeyMetrics from '@/components/KeyMetrics'
import ChatPanel from '@/components/ChatPanel'
import IndexTicker from '@/components/IndexTicker'
import { supabase } from '@/lib/db'
import { MacroEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

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
          GET /api/generate
        </code>
      </main>
    )
  }

  return (
    <main className="site-shell">
      <IndexTicker entry={latest} />
      <nav className="site-nav" aria-label="Primary">
        <span className="brand-mark">EM//</span>
        <span className="nav-meta"><span>DAILY MACRO INTELLIGENCE</span><span>{latest.date}</span></span>
      </nav>

      <section className="hero">
        <div className="eyebrow">Market conditions, decoded daily</div>
        <h1>Econo<span>Monitor</span></h1>
        <p className="hero-copy">
          Scores 6 macro signals daily — real yields, Fed expectations, inflation, oil, USD strength, and credit stress — synthesized from live market data and news into an environment label, action bias, and per-asset guidance. Not financial advice.
        </p>
      </section>

      <section>
        <div className="section-kicker"><div className="eyebrow">01 / Current read</div><h2>What the market is saying</h2></div>
        <div className="dashboard-grid two">
        <MacroStatusCard entry={latest} />
        <ActionPanel entry={latest} />
        </div>
      </section>

      <MacroExplainer entry={latest} />

      <KeyMetrics entry={latest} />

      <MarketExplainer entry={latest} />

      <AssetGrid entry={latest} />

      <ChatPanel entry={latest} />

      <div className="dashboard-grid two last-row mt-8">
        <TrendChart entries={entries} />
        <DriversHeadlines entry={latest} />
      </div>

      <div className="footer-line"><span>EconoMonitor // Built for context</span><span>Not financial advice</span></div>
    </main>
  )
}
