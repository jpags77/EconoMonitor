# Flip Cards for MacroStatusCard and ActionPanel — Design Spec

**Date:** 2026-04-13
**Goal:** Add flip card interaction to the Macro Environment and Action Bias blocks, revealing a plain-English explanation on the back face when clicked.

---

## Context

The asset grid cards already flip to show `asset_notes`. This spec extends the same pattern to the two top-row cards. Both cards currently show labels/scores; the back faces will explain *why* those labels were assigned.

---

## Data Layer

### New columns on `macro_entries`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `macro_summary` | `text not null default ''` | `''` | 2-3 sentences explaining why the macro environment was labeled favorable/mixed/unfavorable |
| `action_notes` | `text not null default ''` | `''` | 2-3 sentences explaining why that action bias was chosen and what an investor should do |

Both are distinct from `justification`, which explains the numeric macro score.

### Migration

```sql
alter table macro_entries add column if not exists macro_summary text not null default '';
alter table macro_entries add column if not exists action_notes text not null default '';
```

Run manually in Supabase SQL Editor. Update `supabase/schema.sql` to match.

### TypeScript types (`lib/types.ts`)

Add both fields to `MacroEntry` and `MacroEntryInput`:

```typescript
macro_summary: string
action_notes: string
```

---

## Claude Prompt (`lib/claude.ts`)

Add to the JSON schema in `USER_PROMPT`:

```json
"macro_summary": "<2-3 sentences explaining why the macro environment is labeled what it is>",
"action_notes": "<2-3 sentences explaining why this action bias was chosen and what an investor should do>"
```

Add to the `generateMacroEntry` return value:

```typescript
macro_summary: parsed.macro_summary ?? '',
action_notes: parsed.action_notes ?? '',
```

---

## Component Changes

### `MacroStatusCard.tsx`

- Add `'use client'` directive
- Add `useState<boolean>(false)` for flip state
- Wrap existing content in CSS grid flip structure (same pattern as `AssetGrid`)
- Front face: unchanged current content
- Back face: `macro_summary` text + "tap to flip back" hint
- Prop signature unchanged — already receives full `MacroEntry`
- Null-safe: render "No summary available." if `macro_summary` is empty

### `ActionPanel.tsx`

- Add `'use client'` directive
- Add `useState<boolean>(false)` for flip state
- Widen prop from `{ actionBias: ActionBias }` to `{ entry: MacroEntry }`
- Update internal references: `actionBias` → `entry.action_bias`
- Wrap in CSS grid flip structure
- Front face: unchanged current content
- Back face: `action_notes` text + "tap to flip back" hint
- Null-safe: render "No notes available." if `action_notes` is empty

### `app/page.tsx`

Update `ActionPanel` call site:

```tsx
// Before
<ActionPanel actionBias={latest.action_bias} />

// After
<ActionPanel entry={latest} />
```

---

## Flip Card Structure

Both components use the same CSS grid pattern established in `AssetGrid`:

```tsx
// Outer: perspective wrapper
<div style={{ perspective: '600px', cursor: 'pointer' }} onClick={() => setFlipped(f => !f)}>
  // Inner: grid container, both faces in gridArea 1/1
  <div style={{ display: 'grid', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.4s ease', transformStyle: 'preserve-3d' }}>
    // Front face
    <div style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}>...</div>
    // Back face
    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}>...</div>
  </div>
</div>
```

This prevents text overflow by letting the container size to the taller face.

---

## Old-Row Handling

`macro_summary` and `action_notes` default to `''` in the DB. Both components render a fallback string when the field is empty, so old entries display gracefully without errors.
