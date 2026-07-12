# DESIGN.md — SanGit visual spec (Ferrari-derived cinematic editorial system)

## Overview

The system reads as cinematic editorial — closer to a luxury-magazine spread than a typical app dashboard. The base canvas is near-black `{colors.canvas}` (#181818 — never pure black, slight warmth) holding pure white display type. The single brand voltage is **Rosso Corsa** `{colors.primary}` (#da291c), used scarcely: primary CTAs, the SanGit mark, and the Main-version highlight (this app's "race-position" equivalent).

Type runs a three-tier system: a display face for headlines, a body face for running text, and a mono face for technical labels — all at modest weights (display 400, body 400). **The brand never uses bold display copy.** Display sizes carry negative tracking (-0.48px to -1.92px); body stays at 0. CTA labels render in a compact 14px/500 without generous tracking. Nav items and section labels ("eyebrows") render in mono with 0.28px tracking.

Corners are **sharp 0px by default** — every CTA, card, and panel. Pill geometry is reserved for badge labels only. Depth comes from brightness-step elevation and 1px hairlines, not drop shadows.

**Key Characteristics:**
- Single accent: `{colors.primary}` (Rosso Corsa #da291c) for primary CTAs, the mark, and Main-version highlights. Used scarcely.
- Near-black canvas (#181818) — never pure black (`#000000` forbidden).
- Three-tier typography: display / body / mono. Display weight stays at 400 — never bold.
- Sharp `{rounded.none}` (0px) corners on every CTA, card, and panel.
- Hairlines + brightness-step elevation — no drop shadow tiers.
- Explicit spacing token ladder (base 4px): xxxs 4 / xxs 8 / xs 16 / sm 24 / md 32 / lg 48 / xl 64 / xxl 96 / super 128.
- Global focus ring is yellow (#f6e500) — the only sanctioned use of yellow.
- No second saturated color, no gradients except the two documented brand gradients.

## SanGit component mapping

How the spec applies to this app:

- **Rosso Corsa** marks the primary CTA, the wordmark glyph, the **Main version halo/label**, the **player play button and playhead**, and the selected timeline node fill. Nothing else.
- Success green `{colors.semantic-success}` (#03904a) is used for `render_status: ready` pills and the "public" badge. Render-failed states use ink hierarchy + dashed iconography, not warning red.
- Project cards, timeline/player panels, comment cards → surface-1 plates with 1px hairline and 0px corners. Version detail panel → surface-2 lift.
- Status badges (`processing`, `ready`, `failed`, `Main`) → `badge-pill`: the **only** pill in the system — mono uppercase caption on `{colors.surface-2}`.
- Fonts (open substitutes for the licensed originals): **Space Grotesk** (display, CohereText substitute), **Inter** (body, Unica77 substitute), **JetBrains Mono** (labels/hashes/timestamps, CohereMono substitute).
- Selected-node emphasis in the tree/graph is a white ink stroke (the old "lighter hover accent" role); the Main halo ring is Rosso Corsa.

## Colors

### Brand & Accent
- **Rosso Corsa** ({colors.primary}): #da291c — primary CTA fill, the mark, Main-version highlights. Used scarcely.
- **Rosso Corsa Hover** ({colors.primary-hover}): #9d2211 — documented darker hover.
- **Rosso Corsa Active** ({colors.primary-active}): #b01e0a — press state.
- **Focus Yellow** ({colors.focus-ring}): #f6e500 — global focus-ring color only. Never used decoratively.

### Surface (brightness-step ladder on the dark canvas)
- **Canvas** ({colors.canvas}): #181818 — page floor, never pure black.
- **Surface 1** ({colors.surface-1}): #202020 — cards, panels (one step up).
- **Surface 2** ({colors.surface-2}): #303030 — canvas-elevated: featured/hovered cards, badges, detail panel.
- **Surface 3** ({colors.surface-3}): #3c3c3c — dropdowns, popovers, sliders.
- **Surface 4** ({colors.surface-4}): #484848 — deepest lift (default node fill).
- **Hairline** ({colors.hairline}): #303030 — 1px dividers and card outlines.
- **Hairline Strong** ({colors.hairline-strong}): #3c3c3c.
- **Hairline Tertiary** ({colors.hairline-tertiary}): #4a4a4a.

### Text
- **Ink** ({colors.ink}): #ffffff — display, body emphasis.
- **Ink Muted** ({colors.ink-muted}): #969696 — default running text.
- **Ink Subtle** ({colors.ink-subtle}): #8f8f8f — secondary labels, eyebrows.
- **Ink Tertiary** ({colors.ink-tertiary}): #666666 — captions, disabled, footnotes.

### Semantic
- **Success** ({colors.semantic-success}): #03904a — ready pills, confirmation.
- **Info** ({colors.semantic-info}): #4c98b9 — info badges (rare).
- **Warning** ({colors.semantic-warning}): #f13a2c — validation warnings (rare).
- **Overlay**: rgba(0,0,0,0.6) — modal scrim.

### Decorative gradients (the only two allowed)
- **Brand red**: `linear-gradient(180deg, #a00c01, #da291c 64%)` — primary-CTA hover state (`.cta-hover-gradient`).
- **Dark grey**: `linear-gradient(180deg, #3c3c3c, #030303 64%)` — atmospheric section transitions (rare).

## Typography

- **Display**: Space Grotesk 400 — headlines only (`h1`–`h3` globally). Fallback `Inter, ui-sans-serif, system-ui`.
- **Body**: Inter 400 — fallback `ui-sans-serif, system-ui, Segoe UI, Roboto`.
- **Mono**: JetBrains Mono 400 — nav links, eyebrows, badges, hashes, timestamps. Fallback `ui-monospace, SF Mono, Menlo`.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| display-xl | 96px | 400 | 1.00 | -1.92px | Landing hero h1 (display face) |
| display-lg | 60px | 400 | 1.00 | -1.2px | Section heads |
| display-md | 48px | 400 | 1.20 | -0.48px | Sub-section heads, profile h1 |
| headline | 32px | 400 | 1.20 | -0.32px | Page/panel titles |
| card-title | 24px | 400 | 1.30 | 0 | Card titles, list labels |
| subhead | 20px | 400 | 1.40 | 0 | Lead body |
| body-lg | 18px | 400 | 1.50 | 0 | Hero subhead |
| body | 16px | 400 | 1.50 | 0 | Default body |
| body-sm | 14px | 400 | 1.40 | 0 | Card body, footer |
| caption | 12px | 400 | 1.40 | 0 | Photo captions, meta, badges |
| button | 14px | 500 | 1.20 | 0 | CTA labels — compact, sentence case |
| eyebrow | 14px | 400 | 1.40 | 0.28px | Section labels, badges (mono, uppercase) |
| mono | 13px | 400 | 1.50 | 0 | IDs, hashes, timestamps |

Principles: display weight stays at 400 — editorial confidence, not bombastic; negative tracking on display sizes only; CTA labels compact at 14/500 without uppercase tracking; nav labels and eyebrows in mono with 0.28px tracking.

## Layout

- Base unit 4px. Tokens: xxxs 4 · xxs 8 · xs 16 · sm 24 · md 32 · lg 48 · xl 64 · xxl 96 · super 128.
- Section padding: xxl (96px) for major bands; super (128px) reserved for hero depth.
- Max content width ~1280px. Grids 3-up desktop → 2-up tablet → 1-up mobile.
- Card interior padding: 24px (cards), 32px (comment cards), 48px (CTA bands).
- Protagonist panels (timeline tree, player) span full content width.
- Generous editorial pacing: the dark canvas is the whitespace; panels separate by brightness lift + hairlines, not gaps.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat (canvas) | #181818 | Body bands, footer |
| Card | surface-1 (#202020), 1px hairline | Default cards, panels |
| Elevated | surface-2 (#303030), 1px hairline-strong | Featured/hovered cards, detail panel, badges |
| Popover | surface-3 (#3c3c3c) | Dropdowns, tooltips, settings popover |
| Focus | 2px #f6e500 outline | Focused input/button |

No drop shadows. Depth is brightness steps + hairlines. (A single soft `0 4px 8px rgba(0,0,0,0.1)` is documented for hovered cards but is optional.) No top-edge glow highlights.

## Shapes

| Token | Value | Use |
|---|---|---|
| rounded-xs | 2px | Tight badges (rare) |
| rounded-sm | 4px | Form inputs — the only rounded control |
| rounded-md | 0px | Buttons — sharp is the brand shape |
| rounded-lg | 0px | Cards |
| rounded-xl | 0px | Protagonist panels |
| rounded-xxl | 0px | CTA bands |
| rounded-full | 9999px | badge-pill, avatars, circular play button only |

The radius vocabulary is sharp by default. **Never rounded or pill CTAs.** Pill geometry is reserved for badge labels; circles for avatars and the player's play control.

## Components

- **button-primary** — Rosso Corsa CTA: bg primary, white text, 14px/500 sentence case, padding 10×20 (app scale; marketing CTAs go 14×32/48px tall), rounded 0px. Hover → brand red gradient (`.cta-hover-gradient`); pressed → primary-active.
- **button-outline (secondary)** — transparent bg, 1px white (ink) border, ink text, rounded 0px. Hover → surface-1 fill.
- **button-tertiary** — transparent, ink text, rounded 0px, hover surface-1.
- **text-input** — canvas bg, ink text, 1px hairline border, rounded 4px, padding 10×16.
- **card** — surface-1, 1px hairline, rounded 0px, padding 24px.
- **panel** (tree/player protagonist) — surface-1, 1px hairline, rounded 0px, padding 24px. No edge glow.
- **badge-pill (status-badge)** — surface-2 bg, mono uppercase caption with 0.28px tracking, rounded full, padding 2×10. The only pill. Tones: neutral ink-muted, success green, accent Rosso Corsa (Main), processing pulse.
- **eyebrow** — mono 14px/400 uppercase, 0.28px tracking, ink-subtle.
- **segmented tab (Tree/Graph toggle)** — sharp 0px; selected: surface-2 bg + hairline-strong border + ink; unselected: transparent border, ink-subtle.
- **top-nav** — sticky, canvas bg, 64px tall, hairline bottom border; mark + wordmark left, mono nav links (0.28px tracking) center-left, buttons right.
- **footer** — canvas bg, ink-subtle links, body-sm.

## Do's and Don'ts

**Do**
- Reserve Rosso Corsa for primary CTAs, the mark, Main-version highlights, and the playhead.
- Set every CTA and card at 0px sharp corners.
- Render CTA labels in sentence case at 14/500 without added tracking.
- Keep display weight at 400 — never bold.
- Use the explicit 4px-base spacing ladder rather than ad-hoc values.
- Use mono + 0.28px tracking for nav links, eyebrows, and badges.

**Don't**
- Don't introduce a saturated color other than Rosso Corsa (success green is semantic only).
- Don't use rounded or pill CTAs — pills are for badges only.
- Don't bold display copy.
- Don't use pure black (#000000) — canvas is #181818.
- Don't add drop shadow tiers — brightness steps + hairlines carry depth.
- Don't use focus-yellow anywhere except the focus ring.

## Responsive

| Breakpoint | Width | Changes |
|---|---|---|
| Mobile | < 640px | Hero h1 96→~40px; 1-up grids; nav collapses |
| Tablet | 640–1024px | 2-up grids; hero h1 ~72px |
| Desktop | 1024–1280px | 3-up grids; full hero h1 |
| Wide | > 1280px | Content caps at 1280px |

Touch targets: primary CTA ≥44px; nav items padded to an effective 48px tap area. The timeline tree pans/scrolls horizontally on mobile rather than cropping.

## Iteration Guide

1. Focus on a single component at a time; reference it by token name.
2. CTAs and cards default to 0px sharp. Pill is reserved for badges.
3. Use token refs everywhere — never inline hex.
4. Display = Space Grotesk 400; body = Inter 400; labels = JetBrains Mono 400.
5. Rosso Corsa stays scarce — CTA, mark, Main highlight, playhead only.

## Known gaps

- CohereText / Unica77 / CohereMono are licensed; Space Grotesk / Inter / JetBrains Mono are the documented substitutes.
- The source spec's light editorial bands (`canvas-light` #ffffff surfaces) are not used in SanGit — the app is dark-only.
- Animation timings out of scope.
