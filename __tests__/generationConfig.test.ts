import { getGenerationProvider } from '@/lib/claude'

describe('getGenerationProvider', () => {
  it('prefers DeepSeek when its API key is configured', () => {
    expect(getGenerationProvider({ DEEPSEEK_API_KEY: 'deepseek', MOONSHOT_API_KEY: 'moonshot' })).toEqual({
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-v4-flash',
    })
  })
})
