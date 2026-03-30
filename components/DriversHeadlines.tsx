import { MacroEntry } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

export default function DriversHeadlines({ entry }: Props) {
  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-6">
      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
          Key Drivers
        </h2>
        <ul className="space-y-2">
          {entry.drivers.map((driver, i) => (
            <li key={i} className="flex gap-2 text-gray-300 text-sm">
              <span className="text-blue-400 mt-0.5">▸</span>
              {driver}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
          Signal Headlines
        </h2>
        <ul className="space-y-2">
          {entry.headlines.map((headline, i) => (
            <li key={i} className="text-gray-400 text-sm border-l-2 border-gray-700 pl-3">
              {headline}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
