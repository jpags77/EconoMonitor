import { renderToStaticMarkup } from 'react-dom/server'
import DriversHeadlines from '@/components/DriversHeadlines'
import { MacroEntry } from '@/lib/types'

const entry = {
  id: 'entry-1',
  created_at: '2026-10-08T12:37:00Z',
  date: '2026-10-08',
  drivers: [{ text: 'Rates hold', url: 'https://example.com/rates', date: '2026-10-07', source: 'Example' }],
  headlines: [{ text: 'Inflation cools', url: 'https://example.com/inflation', date: '2026-10-06', source: 'Example' }],
} as unknown as MacroEntry

describe('DriversHeadlines', () => {
  it('shows publication dates for both drivers and headlines with a neutral signal date label', () => {
    const markup = renderToStaticMarkup(<DriversHeadlines entry={entry} />)

    expect(markup).toContain('2026-10-07')
    expect(markup).toContain('2026-10-06')
    expect(markup).toContain('Signal date')
    expect(markup).not.toContain('Generated today')
  })
})
