import { TavilyArticle } from './types'

function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function filterRecentArticles(
  articles: TavilyArticle[],
  referenceDate: string = new Date().toISOString().slice(0, 10),
  freshnessDays = 14,
): TavilyArticle[] {
  const reference = dayNumber(referenceDate)
  if (reference === null) return articles

  const sorted = [...articles].sort((a, b) => b.published_date.localeCompare(a.published_date))
  const fresh = sorted.filter((article) => {
    const published = dayNumber(article.published_date)
    if (published === null) return false
    const age = (reference - published) / 86_400_000
    return age >= 0 && age <= freshnessDays
  })

  return fresh.length > 0 ? fresh : sorted
}
