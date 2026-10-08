import { filterRecentArticles } from '@/lib/newsFreshness'
import { TavilyArticle } from '@/lib/types'

const article = (published_date: string, title = published_date): TavilyArticle => ({
  title,
  url: `https://example.com/${title}`,
  published_date,
  source: 'example.com',
})

describe('filterRecentArticles', () => {
  it('keeps articles published within the freshness window and orders newest first', () => {
    const result = filterRecentArticles(
      [article('2026-10-01'), article('2026-09-01'), article('2026-10-07')],
      '2026-10-08',
      14,
    )

    expect(result.map((item) => item.published_date)).toEqual(['2026-10-07', '2026-10-01'])
  })

  it('uses the newest available articles when none are within the freshness window', () => {
    const result = filterRecentArticles(
      [article('2026-08-28'), article('2026-09-15')],
      '2026-10-08',
      14,
    )

    expect(result.map((item) => item.published_date)).toEqual(['2026-09-15', '2026-08-28'])
  })
})
