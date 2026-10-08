import { MacroEntry, Driver, Headline } from '@/lib/types'
import InfoAffordance from './InfoAffordance'

interface Props {
  entry: MacroEntry
}

function isDriverObject(d: Driver): d is { text: string; url: string; date: string; source: string } {
  return typeof d === 'object'
}

function isHeadlineObject(h: Headline): h is { text: string; url: string } {
  return typeof h === 'object' && 'url' in h
}

export default function DriversHeadlines({ entry }: Props) {
  const signalDate = new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="panel p-6 space-y-6">
      <div>
        <div className="panel-topline mb-3"><h2 className="panel-title">Key Drivers</h2><InfoAffordance label="Open key driver details" /></div>
        <ul className="space-y-3">
          {entry.drivers.map((driver, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-blue-400 mt-0.5 shrink-0">▸</span>
              {isDriverObject(driver) ? (
                <div>
                  <a
                    href={driver.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 border-b border-gray-600 hover:border-gray-400 hover:text-white transition-colors"
                  >
                    {driver.text}
                  </a>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {driver.date} · {driver.source}
                  </div>
                </div>
              ) : (
                <span className="text-gray-300">{driver}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="panel-title">Signal Headlines</h2>
          <span className="text-gray-600 text-xs">Signal date: {signalDate}</span>
        </div>
        <ul className="space-y-2">
          {entry.headlines.map((headline, i) => (
            <li key={i} className="text-sm border-l-2 border-gray-700 pl-3">
              {isHeadlineObject(headline) ? (
                <div>
                  <a
                    href={headline.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {headline.text}
                  </a>
                  {headline.date && (
                    <div className="text-gray-600 text-xs mt-0.5">
                      Published {headline.date}{headline.source ? ` · ${headline.source}` : ''}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">{headline}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
