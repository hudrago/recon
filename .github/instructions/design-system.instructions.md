---
applyTo: "apps/web/**,packages/ui/**"
description: "Design language for Recon's UI: Revolut-inspired modern fintech style."
---

# Design System — Revolut-Inspired

All UI in `apps/web` and shared components in `packages/ui` follow a modern
fintech aesthetic, in the spirit of Revolut's web and mobile app design.

## Visual Language

- High-contrast neutral base: clean white or near-black surfaces, never busy
  backgrounds. One vivid accent color used sparingly for primary actions and
  key status, not decoration.
- Generous whitespace and clear visual hierarchy over dense, cluttered
  tables — this is an operations tool, not a spreadsheet.
- Large rounded corners on cards/panels (12-20px radius), soft elevation via
  subtle shadows — never skeuomorphic bevels or gradients-as-texture.
- Money amounts and counts are bold, tabular-numeral, and visually dominant —
  the number is the point, not decoration around it.
- Exception severity and action state shown via small rounded pills/badges
  with a consistent color code (e.g. red = HIGH, amber = MEDIUM, gray = LOW),
  never text alone.
- Minimal, flat iconography (single-weight stroke icons) — no multi-color or
  skeuomorphic icon sets.
- Smooth, subtle micro-interactions on state changes (hover, approve/dismiss,
  loading) — motion should feel responsive, never decorative or slow.
- Mobile-first responsive: every screen works as a narrow single-column
  layout before it becomes a desktop layout with side panels/tables.

## Implementation

- Tailwind CSS with a token-based theme (colors, radius, spacing, shadows
  defined once in config, never hardcoded per-component).
- Prefer headless primitives (Radix UI or similar) for interactive components
  (dialogs, dropdowns, toasts), styled to match the above — don't reach for a
  heavy pre-styled component kit that fights this aesthetic.
- Every new shared primitive goes in `packages/ui`, never duplicated inline
  in `apps/web` screens.
- Design tokens live in `packages/ui/src/tokens.ts` as the single source of
  truth; a Tailwind preset will re-export them once Tailwind is installed
  (Phase 2 of the product roadmap).
