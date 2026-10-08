import { renderToStaticMarkup } from 'react-dom/server'
import InfoAffordance from '@/components/InfoAffordance'

describe('InfoAffordance', () => {
  it('renders a visible, accessible cue that a card has more information', () => {
    const markup = renderToStaticMarkup(<InfoAffordance label="Open macro notes" />)

    expect(markup).toContain('Open macro notes')
    expect(markup).toContain('MORE')
    expect(markup).toContain('aria-hidden="true"')
  })
})
