---
name: scope-a-feature
description: Interview-first workflow for scoping new features before building them. Use whenever the user proposes new functionality — "I want to add a feature", "let's build X", "can we add Y", "it would be cool if..." — even if the idea sounds fully specified. Do not start implementing directly; this skill gates all new-feature work behind clarifying questions, idea expansion, and an approved one-paragraph plan.
---

# Scope a Feature

A feature described in one sentence hides a dozen decisions. Surfacing them before writing code is cheaper than reworking after. Follow the phases in order — write no code until Phase 4.

## Phase 1 — Interview

Skim the relevant code first so questions are grounded in this codebase, not generic. Then ask 5–8 sharp clarifying questions in one batch (use AskUserQuestion when the choices are enumerable; plain text otherwise). Cover:

- **Core**: who uses it, where it lives (UI/API/service), the exact behavior expected.
- **Edge cases**: empty/zero states, failure modes, auth/permissions, concurrent or partial updates, existing data and migrations, responsive/mobile if UI.
- **Boundaries**: what is explicitly out of scope for v1.

"Sharp" means answerable and consequential — each answer should change what gets built. Skip anything the codebase or conversation already answers.

## Phase 2 — Expand

In the same message, suggest 2–4 adjacent features the idea unlocks ("since you're adding X, Y becomes nearly free"), each with a one-line rationale and a tag: build-now, build-later, or probably-skip. These are offers, not scope creep — the user picks.

## Phase 3 — Restate and get approval

Wait for the user's answers. Follow up if they raise something new, but converge — don't interview forever. Then restate the agreed plan as **exactly one paragraph of prose** (no bullets): what will be built, key behaviors, the edge-case decisions, and what's deferred. Ask for approval and stop.

## Phase 4 — Build

Begin implementation only after explicit approval of that paragraph. If the user tweaks it, revise the paragraph and re-confirm. Build exactly the approved scope; if implementation surfaces a decision the plan didn't cover, ask instead of guessing.
