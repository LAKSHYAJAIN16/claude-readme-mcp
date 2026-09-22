---
target: config/builder web tool (mcp-server/src/configure.js)
total_score: 19
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 3
timestamp: 2026-09-22T17-05-00Z
slug: mcp-server-src-configure-js
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save/Apply confirm with path; no loading state before the initial `/api/state` fetch fills the form (blank flash). |
| 2 | Match Between System and Real World | 3 | Plain language throughout, but "Stop hook" is used with no inline definition. |
| 3 | User Control and Freedom | 2 | No undo on Save, template delete, or row removal. |
| 4 | Consistency and Standards | 3 | Icon language and button styling mostly consistent; delete affordance styled two different ways (Settings icon-btn vs. Builder's mixed usage). |
| 5 | Error Prevention | 2 | No confirmation before destructive actions; free-text fields (URL, etc.) accept anything silently. |
| 6 | Recognition Rather Than Recall | 2 | Builder's two independent-height grid columns desync after ~4 blocks — confirmed live via screenshot. |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, no drag-reorder, no bulk actions, no duplicate. |
| 8 | Aesthetic and Minimalist Design | 2 | Confirmed live: every structure block is an always-expanded card with a long placeholder-filled textarea, 4 blocks fill the viewport before Preview is visible. |
| 9 | Error Recovery | 1 | Generic "Error: {message}" with no guidance; no field-level validation. |
| 10 | Help and Documentation | n/a | Reasonable scope choice for a local single-developer admin tool. |
| **Total** | | **19/36** | **Poor-to-Acceptable (53%)** |

## Design Specificity Verdict

**LLM assessment:** Partially authored, mostly generic. The card-based fieldsets, icon set, and sticky Save bar are competent but interchangeable with any admin form. The Larp Scale slider is the one genuinely distinctive feature but is styled as a plain range input with no visual signal of what it does — it's the biggest missed opportunity for product character. The Builder's "library → assembled list" pattern is a completely generic list-builder pattern. What *is* specific is the copy voice ("nothing here is invented," "it doesn't write prose for you," "lint_readme flags drafts that read hypier than this") — that's doing more product-specific work than the visuals.

**Deterministic scan:** `detect.mjs --json` returned `[]` (exit 0), re-verified with `--no-config`, no suppression mechanisms found. This is a genuine clean scan, not a blind spot being hidden — but the detector runs in regex-pattern mode on `.js` files (not full DOM/CSS-cascade analysis), so a clean scan here means "no regex-detectable anti-pattern," not "no design issues." Read the heuristic/persona findings below as the real signal.

**Visual evidence:** Assessment A captured real viewport screenshots via the `/browse` skill (correctly avoiding raw `mcp__claude-in-chrome__*` calls per this project's CLAUDE.md) and visually confirmed the column-desync and card-bloat findings below. Assessment B's browser path used the Chrome extension directly, which wasn't connected in that environment, so it honestly reported the fallback (curl-only supplementary evidence) instead of faking an overlay — worth noting as a gap in how I briefed B, not a finding about the product.

## Overall Impression

Structurally sound and honestly labeled, but it reads as a generic settings-form skin wrapped around a genuinely characterful tool. The biggest problems are UX mechanics that would frustrate real use — a two-column layout that falls out of sync as soon as you build a real structure, zero undo anywhere, and visual weight that doesn't match information value (a slider that does something distinctive looks like it does nothing; a block you haven't touched looks as important as one you carefully wrote).

## What's Working

1. **The sticky bottom Save bar on Settings** — verified via live scroll test that it correctly docks to the viewport bottom and lets content scroll underneath, keeping the primary action reachable through a long form.
2. **The copy voice** — "nothing here is invented," "it doesn't write prose for you" reads like the tool's own personality, not boilerplate.
3. **The Detect-from-repo → inline confirmation flow** — a good low-friction default-then-override pattern.
4. **Disabled-while-saving on every async button** (Save, Apply, Save template, Delete) — consistent, correct, unglamorous engineering that neither assessment called out but is genuinely right.
5. **Full light+dark token coverage, consistently applied** — both pages share one CSS block, no drift, no hardcoded colors in the interactive chrome itself (the one exception is noted below).

## Priority Issues

**[P1] Builder's two-column layout desyncs as you add blocks**
- What: `.builder-grid { grid-template-columns: 1fr 1.4fr; align-items: start }` gives the Block Library and Structure/Preview/Template columns independent heights with no sync.
- Why it matters: Confirmed by screenshot — after 4 of 12 blocks, the library column ends in blank space while structure keeps growing. Assembling a realistic 6-10 block README means repeated scroll-up-scroll-down trips.
- Fix: Make the block library `position: sticky; top: <nav height>` so it stays reachable regardless of structure-list length.
- Suggested command: `/impeccable layout`

**[P1] No confirmation or undo on any destructive action**
- What: Delete template, remove a block, remove a button/badge row all execute immediately with only a 150ms fade, no confirm, no undo.
- Why it matters: A misclick permanently loses a saved template or a hand-written override with zero recovery path.
- Fix: Native `confirm()` on template delete at minimum; a brief "Removed — Undo" toast for row removal.
- Suggested command: `/impeccable harden`

**[P1] Dynamically-generated form fields have no programmatic label association**
- What: The button-row's URL/Label/Status text/Color inputs and the struct-row's override textarea are all built client-side with `<label>` as an unlinked sibling (no `for`/`id` pairing, no wrapping) — unlike every static field on the page, which is correctly `label[for]`-linked.
- Why it matters: WCAG 1.3.1/4.1.2. A screen reader user tabbing into any button or structure row hears "edit text" with no field name — for the fields most likely to be filled in by hand (a Buy Me a Coffee URL, a custom section's instructions). Neither sub-agent's static/live pass caught this because it only exists in dynamically-rendered rows.
- Fix: Give each dynamic input a unique `id` and pair its `<label for="...">`, or wrap input in label.
- Suggested command: `/impeccable harden`

**[P2] Structure-block cards give full-textarea weight to untouched defaults**
- What: Confirmed live — every added block is a ~100px card with a fully-expanded textarea showing the full default instruction as placeholder, even when untouched.
- Why it matters: Bloats the list 2-3x past its real information content and blurs "this is just the default" vs. "you should edit this."
- Fix: Collapse to a compact row by default (label + controls only) with an explicit "Customize" toggle.
- Suggested command: `/impeccable distill`

**[P2] No visual hierarchy among competing action buttons**
- What: Save, Save template, Delete selected, Apply all render with comparable weight.
- Why it matters: Nothing directs the eye to the action that actually commits work.
- Fix: Reserve solid `--accent` fill for exactly one primary action per screen; downgrade the rest to `.secondary`.
- Suggested command: `/impeccable clarify`

**[P2] `prefers-reduced-motion` is never checked**
- What: The row-enter/row-exit animations and all hover/focus transitions have no reduced-motion accommodation.
- Why it matters: A real, checkable accessibility gap the polish pass didn't cover.
- Fix: Wrap the `@keyframes rowEnter` animation and non-essential transitions in `@media (prefers-reduced-motion: no-preference)`.
- Suggested command: `/impeccable harden`

**[P3] Larp Scale's "off" state is easy to miss as interactive**
- What: At value 0 the label just reads "off" in small muted gray; nothing else signals the control is meaningful.
- Why it matters: The single most distinctive feature in the tool is under-signaled.
- Fix: Endpoint labels on the track ("deadpan" / "hackathon pitch").
- Suggested command: `/impeccable delight`

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts. Reordering requires N individual up/down clicks — no drag-and-drop, no "move to top." No bulk operations. The column-desync (P1 above) means even a confident user is forced into repeated scroll trips. Alex plausibly abandons the visual builder and hand-edits the JSON style file instead — which defeats the tool's purpose.

**Sam (Accessibility-Dependent User)**: Icon buttons carry `aria-label` (good) but no `title` tooltip for a low-vision mouse user. Contrast checks on the light-theme muted text pass AA (~4.97:1 on white, ~4.68:1 on card) — fine, not an issue. The bigger issues: no confirmation on destructive actions (P1) means a keyboard/switch user who overshoots a tab stop and hits Enter on "Delete selected" has no recovery; and there's no `aria-live` region on the async Save/Delete status text, so a screen reader user isn't told the outcome unless they manually re-focus it.

## Minor Observations

- Hover feedback on list rows (`.block-lib-item:hover`, `.button-row`) is a subtle border-color shift only — easy to miss on a dense list.
- Button preset `<select>` options show raw slugs ("buy-me-a-coffee") instead of humanized labels ("Buy Me a Coffee") — noted independently by both the design review and my own read of the source, so this one's solid.
- The sticky bottom-bar shadow (`box-shadow: 0 -12px 20px -12px rgba(0, 0, 0, 0.12)`) is a hardcoded, non-tokenized color with no dark-mode adjustment — it's nearly invisible against the dark `--bg`, so the intended elevation cue disappears in dark mode specifically.
- Buttons (~31px tall) and `.icon-btn` (30×30px) fall under the 44×44px touch-target guideline — likely fine for this tool's primary desktop/mouse use, but worth knowing if it's ever opened on a touch device.

## Provocative Questions

1. The Builder's core promise is "compose a structure with live preview" — so why is the preview the thing users scroll furthest to see? What would a real split-pane (preview always visible) look like instead?
2. If every destructive action here is genuinely low-stakes (it's local JSON, after all), does it need confirmation dialogs — or generous undo instead? Which fits a "zero-dependency, no framework" tool's ethos better?
3. The Larp Scale slider is the most distinctive idea in the whole tool. If it got the same design attention as everything else got generic-form treatment, what would it look like — and what does that gap say about where the prior polish pass actually spent its effort?
