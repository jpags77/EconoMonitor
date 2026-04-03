// lib/scoreColors.ts
export const scoreColor: Record<number, string> = {
  2: 'text-green-400',
  1: 'text-green-300',
  0: 'text-gray-400',
  [-1]: 'text-orange-400',
  [-2]: 'text-red-400',
}

// Explicit bg map — avoids dynamic class construction that Tailwind can't purge-scan
export const scoreBgColor: Record<number, string> = {
  2: 'bg-green-400',
  1: 'bg-green-300',
  0: 'bg-gray-400',
  [-1]: 'bg-orange-400',
  [-2]: 'bg-red-400',
}
