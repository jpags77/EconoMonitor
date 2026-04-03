# Design Spec: Per-Asset Reasoning with Flip Cards

**Date:** 2026-04-03  
**Status:** Approved

---

## Overview

Add plain-English 2-3 sentence explanations to each asset score card (Equities, Bitcoin, Gold, Bonds). Tapping a card flips it 180° to reveal Claude's reasoning for why that asset received its score today. Tapping again flips back.

---

## Data Model

### New Supabase column

```sql
alter table macro_entries add column if not exists asset_notes jsonb not null default '{}';
```

Old rows retain `asset_notes = {}`. The UI handles this gracefully — the card back shows only the score label with no explanation text when notes are absent.

### TypeScript (`lib/types.ts`)

```typescript
export interface AssetNotes {
  equities: string
  bitcoin: string
  gold: string
  bonds: string
}

// Added to MacroEntry:
asset_notes: AssetNotes | Record<string, never>  // {} for old rows
```

`MacroEntryInput` inherits the new field automatically via `Omit<MacroEntry, 'id' | 'created_at'>`.

---

## Generation (`lib/claude.ts`)

No extra API call. The existing Claude prompt gains 4 new fields in the JSON schema:

```json
"asset_notes": {
  "equities": "<2-3 sentences explaining why equities scored X in today's specific macro context>",
  "bitcoin":  "<2-3 sentences explaining why bitcoin scored X today>",
  "gold":     "<2-3 sentences explaining why gold scored X today>",
  "bonds":    "<2-3 sentences explaining why bonds scored X today>"
}
```

Claude already has full context (raw signals, macro environment, key metrics, justification) — this instructs it to make the per-asset reasoning explicit. Adds ~150-200 tokens to the response. Returned with nullish default: `parsed.asset_notes ?? {}`.

---

## Component (`components/AssetGrid.tsx`)

### Flip interaction

Each `AssetCard` manages its own flip state with `useState<boolean>(false)`. Click anywhere on the card to toggle.

```tsx
const [flipped, setFlipped] = useState(false)

<div style={{ perspective: '600px' }} onClick={() => setFlipped(f => !f)}>
  <div style={{
    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
    transition: 'transform 0.4s ease',
    transformStyle: 'preserve-3d',
    position: 'relative',
    minHeight: '120px',
  }}>
    {/* Front face */}
    <div style={{ backfaceVisibility: 'hidden' }}>
      {/* existing: emoji, name, score label, bar */}
    </div>
    {/* Back face */}
    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                  position: 'absolute', inset: 0 }}>
      {/* asset name + note text, or score label only if note is empty */}
    </div>
  </div>
</div>
```

### Back face content

- Asset emoji + name (top)
- Score label in score colour (e.g. "Buy" in green)
- Note text in `text-gray-400 text-sm leading-relaxed` (hidden when empty)
- Subtle "tap to flip back" hint in `text-gray-600 text-xs` at the bottom

### `AssetCard` prop changes

```tsx
interface AssetCardProps {
  name: string
  score: SignalScore
  emoji: string
  note: string   // empty string for old rows
}
```

`AssetGrid` passes `note` by mapping each asset to its key in `AssetNotes`:

```tsx
<AssetCard name="Equities" score={entry.equities_score} emoji="📈"
  note={(entry.asset_notes as AssetNotes).equities ?? ''} />
<AssetCard name="Bitcoin"  score={entry.bitcoin_score}  emoji="₿"
  note={(entry.asset_notes as AssetNotes).bitcoin  ?? ''} />
<AssetCard name="Gold"     score={entry.gold_score}     emoji="🟡"
  note={(entry.asset_notes as AssetNotes).gold     ?? ''} />
<AssetCard name="Bonds"    score={entry.bonds_score}    emoji="📄"
  note={(entry.asset_notes as AssetNotes).bonds    ?? ''} />
```

The cast is safe: when `asset_notes` is `{}` (old rows), the `??` fallback produces an empty string.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `AssetNotes` interface; add `asset_notes` field to `MacroEntry` |
| `lib/claude.ts` | Add `asset_notes` to prompt JSON schema; return with `?? {}` default |
| `supabase/schema.sql` | Add `asset_notes jsonb not null default '{}'` |
| `components/AssetGrid.tsx` | Add flip state to `AssetCard`, front/back faces, pass `note` from entry |

---

## Out of Scope

- Signal-to-asset breakdown (e.g. "Driven by: Credit Stress ↑") — plain English only
- Per-asset historical reasoning
- Animations beyond the 0.4s CSS flip
