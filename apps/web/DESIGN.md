# DESIGN.md — SanGit visual spec (Linear-derived dark system)

## Overview

Linear's marketing canvas is the deepest dark surface in this collection — `{colors.canvas}` is #010102, essentially pure black with a faint blue tint. On top sits a four-step surface ladder (`{colors.surface-1}` through `{colors.surface-4}`) for cards, panels, and lifted tiles, with hairline borders running from `{colors.hairline}` (#23252a) up through `{colors.hairline-strong}` and `{colors.hairline-tertiary}`. Light gray text (`{colors.ink}` #f7f8f8) carries the body and headlines.

The single chromatic accent is **Linear lavender-blue** `{colors.primary}` (#5e6ad2) — used on the brand mark, focus rings, and the primary CTA button. A lighter hover state (`{colors.primary-hover}` #828fff) and a focus-tinted variant (`{colors.primary-focus}` #5e69d1) extend the same hue. Linear avoids saturated greens, oranges, reds, etc. on the marketing canvas — the only semantic color is `{colors.semantic-success}` (#27a644) for status pills and the rare success indicator.

Display type runs Linear's custom sans (with `SF Pro Display` fallback) at weight 500–700 with negative letter-spacing scaling from -3.0px at 80px down to 0 at body. The body family is Linear's text cut, and a Linear Mono is reserved for code snippets in product screenshots.

The page rhythm is **dense product screenshots** — Linear's marketing leads with high-fidelity captures of the product UI (issue list, project view, dashboard) framed in `{colors.surface-1}` panels with `{rounded.xl}` 16px corners. The chrome is intentionally minimal so the app screenshots can do the heavy lifting.

**Key Characteristics:**
- **Dark-canvas marketing system** — `{colors.canvas}` (#010102) is the deepest dark in this collection.
- **Lavender-blue brand accent** (`{colors.primary}` #5e6ad2) — used scarcely on brand mark, focus, and the primary CTA.
- Four-step surface ladder (canvas → surface-1 → surface-2 → surface-3 → surface-4) carries hierarchy without shadow.
- Display tracking pulls aggressively negative (-3.0px at 80px); body holds at -0.05px.
- Cards use `{rounded.lg}` 12px corners with 1px hairline borders — never pill, rarely 16px.
- **Product UI screenshots** dominate the page. The marketing chrome is a dark frame for the app.
- No second chromatic color. No atmospheric gradients. No spotlight cards.

## SanGit component mapping

How the spec applies to this app:

- Lavender additionally marks the **Main version node ring/badge and the player playhead** (the app's "brand mark" equivalents). Success green is used for `render_status: ready` pills. Render-failed states use ink hierarchy + iconography, not red.
- Project cards → `feature-card`; timeline tree panel and player panel → `product-screenshot-card` (16px radius — they are this app's protagonist panels); version detail panel → surface-2 lift; status badges (`processing`, `ready`, `failed`, `Main`) → `status-badge` pill; comments → `testimonial-card` structure.
- Fonts: **Inter** (display + body substitute) and **JetBrains Mono** (version hashes/IDs, timestamps).

## Colors

### Brand & Accent
- **Lavender-Blue** ({colors.primary}): #5e6ad2 — The signature accent — primary CTA, brand mark, link emphasis.
- **Lavender Hover** ({colors.primary-hover}): #828fff — hovered state of the primary CTA.
- **Lavender Focus** ({colors.primary-focus}): #5e69d1 — focus-ring tint — focused inputs, focused buttons.
- **Brand Secure** ({colors.brand-secure}): #7a7fad — muted lavender-gray.

### Surface
- **Canvas** ({colors.canvas}): #010102 — default page background, near-pure black with a faint blue tint.
- **Surface 1** ({colors.surface-1}): #08090a — one step above canvas — cards, panels.
- **Surface 2** ({colors.surface-2}): #0f1011 — two steps above — featured cards, hovered cards.
- **Surface 3** ({colors.surface-3}): #141516 — three steps above — sub-nav, dropdowns.
- **Surface 4** ({colors.surface-4}): #191a1b — deepest lifted surface.
- **Hairline** ({colors.hairline}): #23252a — 1px borders on cards and dividers.
- **Hairline Strong** ({colors.hairline-strong}): #2e3035 — stronger 1px borders.
- **Hairline Tertiary** ({colors.hairline-tertiary}): #3a3d44 — tertiary borders for nested surfaces.
- **Inverse Canvas** ({colors.inverse-canvas}): #ffffff.

### Text
- **Ink** ({colors.ink}): #f7f8f8 — headlines and emphasized body.
- **Ink Muted** ({colors.ink-muted}): #d0d6e0 — secondary type.
- **Ink Subtle** ({colors.ink-subtle}): #8a8f98 — tertiary type.
- **Ink Tertiary** ({colors.ink-tertiary}): #62666d — disabled, footnotes.

### Semantic
- **Success Green** ({colors.semantic-success}): #27a644 — status pills, success indicators. The only semantic color.
- **Overlay** ({colors.semantic-overlay}): rgba(0,0,0,0.6) — modal scrim.

## Typography

- **Sans**: Inter (500/600/700 display, 400 body) — fallback `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto`.
- **Mono**: JetBrains Mono 400 — fallback `ui-monospace, SF Mono, Menlo`.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| display-xl | 80px | 600 | 1.05 | -3.0px | Largest hero headline |
| display-lg | 56px | 600 | 1.10 | -1.8px | Section opener headlines |
| display-md | 40px | 600 | 1.15 | -1.0px | Sub-section headlines |
| headline | 28px | 600 | 1.20 | -0.6px | Panel titles, CTA banner heading |
| card-title | 22px | 500 | 1.25 | -0.4px | Card title |
| subhead | 20px | 400 | 1.40 | -0.2px | Lead body |
| body-lg | 18px | 400 | 1.50 | -0.1px | Hero subhead |
| body | 16px | 400 | 1.50 | -0.05px | Default body |
| body-sm | 14px | 400 | 1.50 | 0 | Card body, footer |
| caption | 12px | 400 | 1.40 | 0 | Captions, meta, status |
| button | 14px | 500 | 1.20 | 0 | All button labels |
| eyebrow | 13px | 500 | 1.30 | 0.4px | Section eyebrow (positive tracking) |
| mono | 13px | 400 | 1.50 | 0 | IDs, hashes, timestamps |

Principles: aggressive negative tracking on display; single voice display→body (600→400, same family); eyebrow uses positive tracking; mono only for code/ID contexts.

## Layout

- Base unit 4px. Tokens: xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section 96.
- Card interior padding: 24px (feature/pricing), 32px (testimonial/comment), 48px (CTA banners).
- Button padding: 8px vertical · 14px horizontal. Input padding: 8px vertical · 12px horizontal.
- Max content width ~1280px. Grids 3-up desktop → 2-up tablet (1024px) → 1-up mobile (768px).
- Protagonist panels (timeline tree, player) span full content width.
- The dark canvas IS the whitespace. Sections separate by lift onto surface-1 panels, not gaps. 24px gaps within panels; 96px between sections.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Body type, hero text, footer |
| 1 (charcoal lift) | surface-1 bg, 1px hairline | Default cards, panels |
| 2 (surface-2 lift) | surface-2 bg, 1px hairline-strong | Featured/hovered cards, detail panel |
| 3 (surface-3 lift) | surface-3 bg | Sub-nav, dropdown menus |
| 4 (focus ring) | 2px primary-focus outline at 50% | Focused input/button |

Depth is carried by the surface ladder + hairline borders — no drop shadows. A subtle white top-edge highlight on lifted panels is allowed. No atmospheric gradients, no spotlight cards.

## Shapes

| Token | Value | Use |
|---|---|---|
| rounded-xs | 4px | Small chips, status badges |
| rounded-sm | 6px | Inline tags |
| rounded-md | 8px | All buttons, form inputs |
| rounded-lg | 12px | Cards |
| rounded-xl | 16px | Protagonist panels (tree, player) |
| rounded-xxl | 24px | Oversized CTA banners (rare) |
| rounded-pill | 9999px | Tab toggles, status pills only |
| rounded-full | 9999px | Avatar circles (32–40px) |

## Components

- **button-primary** — bg primary, white text, 14px/500, padding 8×14, rounded 8px. Hover → primary-hover; pressed → primary-focus.
- **button-secondary** — bg surface-1, ink text, 1px hairline border, padding 8×14, rounded 8px.
- **button-tertiary** — transparent/canvas bg, ink text, rounded 8px, padding 8×14.
- **tab pill** — default: canvas bg + ink-subtle; selected: surface-2 bg + ink; rounded pill, padding 6×14.
- **feature-card** (project card) — surface-1, 1px hairline, rounded 12px, padding 24px.
- **product-screenshot-card** (tree/player panel) — surface-1, rounded 16px, padding 24px.
- **testimonial-card** (comment) — surface-1, rounded 12px, padding 32px, avatar 32–40px rounded-full.
- **cta-banner** — surface-1, headline type, rounded 12px, padding 48px.
- **text-input** — surface-1 bg, ink text, rounded 8px, padding 8×12; focus = 2px primary-focus outline at 50% opacity (surface unchanged).
- **status-badge** — surface-2 bg, ink-muted text, caption type, rounded pill, padding 2×8.
- **top-nav** — sticky, canvas bg, 56px tall; wordmark left, links center, secondary+primary button pair right.
- **footer** — canvas bg, ink-subtle caption links, padding 64×32.

## Do's and Don'ts

Do: reserve canvas #010102 as the anchor; lavender ONLY for brand mark / primary CTA / focus / link emphasis / Main indicator / playhead; use the surface ladder without skipping levels; display 600 + body 400; negative tracking on display; 8px-corner CTAs.

Don't: light mode; lavender as section background or card fill; a second chromatic accent; gradients or spotlight cards; pill-round CTAs; `#000000` true black canvas.

## Responsive

| Breakpoint | Width | Changes |
|---|---|---|
| Desktop-XL | 1440px | Default |
| Desktop | 1280px | 3-up grids maintained |
| Tablet | 1024px | 3-up → 2-up |
| Mobile-Lg | 768px | Nav hamburger; 1-up grids |
| Mobile | 480px | Single column; display-xl scales 80→~36px |

Touch targets ≥44px on touch viewports; CTAs ≥40px tall everywhere. The timeline tree pans/scrolls horizontally on mobile rather than cropping.

## Iteration Guide

1. Focus on one component at a time; reference it by token name.
2. When introducing a section, decide first which surface lift it lives on.
3. Default body to 16px/400.
4. Treat lavender as scarce.
