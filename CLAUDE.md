# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension (built with [WXT](https://wxt.dev)) that adds productivity shortcuts to the Google Play Console: quick-reply (optionally auto-translating the reply to the review's language first), modifier+click "parse review" to clipboard JSON, a canned-reply template picker, next/previous review and page navigation, a purchasing-power-parity pricing side panel that bulk-fills price fields, an options page, a popup with quick links and page bookmarks, and a background script that keeps the toolbar icon in sync with the active tab.

## Commands

Package manager is **pnpm** — do not use npm/yarn (no lockfiles for them are committed).

```sh
pnpm install          # first-time setup; also runs `wxt prepare` via postinstall
pnpm dev              # Chrome dev build w/ HMR -> .output/chrome-mv3-dev (load unpacked in chrome://extensions)
pnpm dev:firefox      # Firefox dev build
pnpm build            # production build -> .output/chrome-mv3
pnpm build:firefox
pnpm zip              # production build + zip -> .output/*.zip, for Chrome Web Store upload
pnpm zip:firefox
pnpm compile          # vue-tsc --noEmit (type-check; plain tsc won't check .vue files)
pnpm lint             # eslint .
pnpm format           # prettier --write .
pnpm test             # vitest run
pnpm vitest run utils/shortcuts.test.ts   # run a single test file
pnpm vitest run -t "matches a custom shortcut"  # run a single test by name
pnpm ppp:refresh      # regenerate utils/ppp-data.ts from the World Bank API (network)
```

First-time setup on a fresh checkout may need `pnpm approve-builds` if pnpm blocks the `esbuild`/`spawn-sync` postinstall scripts — required for `esbuild`'s platform binary to be wired up.

## Architecture

### Manifest is generated, never hand-edited

There is no `manifest.json` in the repo. WXT generates it at build time from `wxt.config.ts` (name, description, permissions, icons, action) plus whatever each entrypoint declares (`content_scripts.matches` from `defineContentScript({ matches })`; `options_ui` auto-detected from `entrypoints/options/`). `manifest.version` is deliberately _not_ set — WXT falls back to `package.json`'s `version`, the single source of truth. Don't declare a field in `wxt.config.ts` that an entrypoint already declares, and don't re-add an explicit `version`.

### File naming

Module filenames are **one word where possible, two at most** (`dom.ts`, `selectors.ts`, `navigation.ts`, `quick-reply.ts`). Vue components keep `PascalCase.vue`. A name that wants a third word is the signal that the module does too much or sits in the wrong directory — split or move it rather than growing the filename.

### Two content-script entrypoints

`entrypoints/reviews.content/` (four review feature modules) and `entrypoints/pricing.content/` (the PPP fill engine) both match `https://play.google.com/console/*`. They're split because they touch unrelated parts of the console and share no state. They cost nothing extra in the manifest — WXT merges content scripts with identical `matches`/`run_at` into one entry (verify with `cat .output/chrome-mv3/manifest.json` after a build).

**`pricing.content` injects nothing** — no DOM, no stylesheet, no toast. It's a message handler over `utils/dom.ts`; all of its UI is the side panel, which gets Tailwind/daisyUI for free. Only `reviews.content` contributes to `content_scripts.css`. Keep it that way.

#### `reviews.content` — four feature modules

`main(ctx)` wires up four independent modules that live alongside it:

- `quick-reply.ts` — key combo while a reply field is focused; optionally translates, then clicks the publish button (`PUBLISH_LABELS`) and flashes it green.
- `parse-review.ts` — modifier+click on review text; scrapes the enclosing container, resolves the app slug, copies JSON, toasts, highlights.
- `picker.ts` — key combo while a reply field is focused; floating template picker (see "Canned reply templates").
- `navigation.ts` — next/previous review and next/previous review _page_ (see "Review navigation").

Feature modules contain no selectors and no raw DOM traversal — both live in `utils/selectors.ts` and `utils/dom.ts`.

`utils/toast.ts` wraps [toastify-js](https://github.com/apvarun/toastify-js) behind `showToast(message, { sticky? })` — `{ sticky: true }` returns a handle whose `.hide()` dismisses it manually (quick-reply's translation-in-progress toast), otherwise it auto-dismisses after 2.5s. Don't hand-roll a second toast. It's used by `reviews.content` only but lives in `utils/`; don't move it back.

`reviews.content/style.css` is the only stylesheet a content script injects (highlight flash, publish flash, picker panel — all `pcu-`-prefixed), imported alongside `toastify-js/src/toastify.css`.

All four register listeners through `ctx.addEventListener(...)` / `ctx.onInvalidated(...)` (from the `ContentScriptContext` WXT passes into `main`), never raw `window`/`document` listeners — this auto-cleans-up if the extension reloads while the tab stays open.

**Gotcha:** `ContentScriptContext` must be imported as a type from `'wxt/utils/content-script-context'`. The auto-imported global of the same name is value-only and fails type-checking (`TS2749`) when used as a parameter type annotation.

### Selectors in one file, DOM access in one file

Play Console's DOM is a third-party contract that can change without notice, so it's reachable from exactly two modules:

- `utils/selectors.ts` — **every** selector string and button-label matcher, including the localized (English/Spanish) label lists `PUBLISH_LABELS`, `DISCARD_LABELS`, `NEXT_PAGE_LABELS`, `PREV_PAGE_LABELS`. Constants only, no behavior. When Play Console re-skins, this is the file to fix.
- `utils/dom.ts` — the only module that queries, mutates, or animates page elements: review lookups, reply-field access, button lookups, pricing-table access, and the flash animations. It lives in `utils/` rather than the content-script directory so it stays unit-testable and importable from anywhere.

Don't add a `querySelector` call, a selector literal, or an inline style mutation to a feature module — extend these two instead.

**Gotcha:** the element that receives a click on the review body is usually _not_ the paragraph you clicked — Play Console nests the body in wrappers that also carry the device line, the "Translated from …" banner and the reply box's helper text, so the clicked element's own `innerText` yields all of that concatenated. Read the body from the container through `REVIEW_TEXT`; the click only identifies which container to read.

**Gotcha:** not every clickable control is a native `<button>` — the review-list paginator's prev/next are a `material-button` custom element (confirmed against the real console). Hence `BUTTON` is `'button, material-button'`, and `isButtonDisabled()` checks the `.disabled` property _and_ the `disabled`/`aria-disabled` attributes, since a custom element needn't expose the IDL property. Extend that selector if another control turns out to use a different tag.

**Gotcha:** `flashPublished()` animates via a CSS class, not `element.style.*` — an inline style left the button permanently green until Angular re-rendered it. Keep page-owned elements free of inline styles; the class is removed on `animationend`.

### Quick-reply auto-translation

When `sync:autoTranslateReply` is on (default), `quick-reply.ts` reads Play Console's own "Translated from X -" banner (`ORIGINAL_LANGUAGE_HEADER`, inside the same review container as the reply box); `utils/language.ts` parses it and maps the language name to a BCP-47 code. **The banner only renders when the review's language differs from the console's display language**, so its absence means "already matches, skip translation" — not a detection failure.

`utils/translation.ts` wraps Chrome's on-device `Translator`/`LanguageDetector` globals (stable since Chrome 138 for many pairs, not yet in TS's `lib.dom.d.ts` — hence the local ambient `declare global`). It detects the reply's own language first to skip a no-op translation, and no-ops safely — publishing the reply as typed — when the APIs or a language pair are unavailable. Everything runs on-device; no network requests.

**Gotcha:** after programmatically overwriting the reply box, the publish button's `disabled` state does _not_ flip synchronously — Angular needs a tick. Checking it immediately reads the stale (disabled) value and silently no-ops. `waitForEnabledPublishButton()` polls (50ms, 3s timeout) instead, and only after a translation actually happened; the untranslated path still checks once. On timeout, a toast + `console.warn` tell the user to click Publish manually.

**Gotcha:** how the reply text gets written matters more than the events dispatched afterwards — see `setReplyText()` in `utils/dom.ts`. Assigning `.innerText` on a contenteditable tears out the node the caret lives in, dropping focus and collapsing Play Console's reply toolbar (publish button included), so the post-translation publish click has nothing to click.

`findPublishButton()` is scoped to the focused field's review container where possible: `PUBLISH_LABELS` is substring-matched against text _or_ aria-label, so a document-wide search can hit another review's (disabled) publish button first. The translation step is wrapped in `try`/`catch` in the keydown listener — a throw would otherwise reject the async listener and skip publishing entirely.

**Unverified in a real browser:** that the reply field always lives inside the same review container as the language banner. `picker.ts` reuses this assumption to reach author/date for placeholders — confirm both against a live foreign-language review.

### Canned reply templates

`utils/canned-replies.ts` defines `sync:cannedReplies` (`{id, label, content}`, `id` from `crypto.randomUUID()`) and `fillCannedReplyPlaceholders()`, a simple `{word}`-token replace. Unknown or mistyped placeholders (`{Author}`, `{foo}`) are left **literal**, not blanked — a visibly wrong token beats silently vanishing text.

`picker.ts` opens on `sync:cannedReplyShortcut` (default Ctrl/⌘+K) while a reply field is focused. Placeholder data comes from the focused field's review container via `getReviewAuthor()`/`getReviewDate()` plus `getActiveAppLabel()` — the raw app-selector display name, **not** `resolveAppSlug()`'s slug, which is a URL-safe concept meant for JSON export, not reply text.

The picker is a hand-rolled `position: fixed` panel (no Vue in the content-script bundle), anchored to the field's `getBoundingClientRect()` and flipped above it if there's no room below. While open, a capture-phase keydown listener intercepts **only** Escape and digits `1`-`9` (first `NUMBERED_ROWS` templates; later ones stay listed and clickable, just unnumbered) — every other key passes through so normal typing and Play Console's own bindings are unaffected. Selecting a template **fully replaces** the field's content via `setReplyText`; it doesn't insert at the cursor or publish.

### Review navigation

`navigation.ts` covers two axes, each with its own pair of configurable shortcuts. All four dispatch from one `keydown` listener over a `bindings` table (`{shortcut, run}`), so a fifth is a table entry.

**Item navigation** (`sync:nextReviewShortcut`/`sync:prevReviewShortcut`, default Alt+↓/↑) moves within the current page. Each keypress re-queries `getReviewContainers()` (never cached — Angular may re-render between presses) and resolves the "current" review in three tiers of precision: the focused reply field's container; else `lastNavigatedContainer` if that node is still in the fresh list; else the last container whose top is at or above `CURRENT_THRESHOLD_PX`. It then discards any unpublished draft on the review being left, scrolls to and flashes the target, and focuses its reply field with `preventScroll: true` (so the browser's focus-scroll doesn't fight the smooth `scrollIntoView`). At either end it toasts instead of navigating.

**Gotcha:** an already-replied review has no reply field to focus, and the focus-first tier then reads the review you just _left_ as current — forward navigation kept re-targeting the same replied review. Two things fix it together: the `lastNavigatedContainer` tier (which also covers the window before the smooth scroll lands), and blurring the stale field whenever `document.activeElement` isn't the target's reply field after the focus attempt. Page navigation clears `lastNavigatedContainer` before clicking, since Angular may recycle container nodes across pages.

**Page navigation** (`sync:nextReviewPageShortcut`/`sync:prevReviewPageShortcut`, default Alt+→/←) clicks Play Console's own paginator, found via `findButtonByText(document, NEXT_PAGE_LABELS | PREV_PAGE_LABELS)`. Boundary checks go through `isButtonDisabled()`, not a raw `.disabled` read, because these are `material-button` elements. It deliberately does **not** scroll to or focus anything afterwards — the page swap is Angular-driven and async, so there's no reliable moment to act.

Both axes share `discardUnpublishedDraft()`: it acts only when the review being left has its reply field focused _and_ non-empty, clicking a `DISCARD_LABELS`-matched button. This keeps navigation from leaving a trail of abandoned half-typed replies.

**Gotcha:** the page-navigation defaults (Alt+←/→) collide with Chrome's browser-back/forward accelerator on Windows/Linux (not Mac). `e.preventDefault()` is called before the handler runs, which should suppress it, but this is unconfirmed on a real Windows Chrome. The shortcut is reconfigurable if not.

**Unverified in a real browser:** whether the review list virtualizes/recycles offscreen nodes; whether container document order always matches visual order; whether the real Discard/Cancel text matches `DISCARD_LABELS`; and the Alt+←/→ collision above. (The paginator's aria-labels and `material-button` tag name _are_ confirmed.)

### PPP pricing

#### The panel and the message contract

The UI is a **side panel** (`entrypoints/sidepanel/`, Vue + the shared `assets/ui.css`), opened from the popup — deliberately no keyboard shortcut, since repricing a catalogue is a rare, one-off action. It owns everything: base price, base country, rounding, custom factor, overwrite toggle, preview and fill. There is no PPP section on the options page.

**The side panel is an extension page, so it cannot touch the Play Console DOM at all.** Everything goes through `utils/messages.ts`: `PPP_SCAN` (counts plus an already-converted preview), `PPP_FILL`, `PPP_ABORT` (the Stop button), and a fire-and-forget `PPP_PROGRESS` broadcast. **Every figure in a preview row is computed content-script side, in both currencies** — `PppPreviewRow` carries `price`/`priceBase`, `current`/`currentBase` and `change` — so the panel's "show in base currency" toggle is a pure view switch and the two sides can't disagree about what a row should say. `toBaseCurrency()` is `convertPrice()`'s PPP step run backwards, deliberately not charm-rounded since it's never written anywhere.

`current` comes from `parsePriceValue()`, which **infers** the decimal separator rather than assuming one (Play Console renders prices in the console's display language, so `.` and `,` swap roles). It returns `null`, not `0`, for a cell with no digits — an unpriced row must not read as a 100% drop from a price that never existed, and `percentChange()` refuses a zero baseline for the same reason.

**Gotcha:** the "was … / ±N%" line is hidden when the change rounds to zero, not just when there's no baseline — otherwise every row grows a redundant "no change" line the instant a fill finishes.

**Gotcha:** settings ride along on every `PPP_SCAN`/`PPP_FILL` rather than being `watchValue`d in the content script. The panel writes a setting and re-scans immediately; a storage watch on the other side hasn't necessarily fired by then, so the scan would silently price with the previous value. `PPP_SCAN`'s `settings` is **optional** — the popup only wants the row count, and counting needs no pricing config.

**Gotcha — a throw inside `onMessage` is indistinguishable from "no content script on this tab".** The reply channel dies, `tabs.sendMessage` rejects, and the caller reports the wrong thing (this is how a required-field mistake surfaced as a permanently disabled popup button with a "reload this page" tooltip). The scan handler catches and answers; keep it that way.

**Gotcha — `tabs.sendMessage` takes `any`, so the compiler does not check message payloads.** `pnpm compile` was clean while the popup sent a message missing a required field. Annotate outgoing messages as `PricingMessage` at the call site, as the popup and side panel both do.

**Rescan is a button, not a `MutationObserver`.** Expanding the "Other countries / regions" sections adds rows the panel can't know about, but the fill walk re-scans anyway — so the button only affects what the _preview_ shows, and isn't worth an observer's subtree wiring and debouncing.

The panel replaced an injected floating panel built with `document.createElement`, which took the panel DOM builder, `pricing.content/style.css`, outside-click/Escape handlers, toast plumbing and `PANEL_MARKER_ATTR` with it. If you're tempted to inject UI into the page again, that's the history.

**Per-tab visibility lives in `entrypoints/background.ts`.** Chrome's side panel is global by default (availability comes from the manifest's `side_panel.default_path`), so `syncTab()` calls `sidePanel.setOptions({tabId, enabled: isConsoleUrl(url)})` alongside the icon logic. This scopes it to Play Console tabs, not strictly the tab it was opened from — doing that would mean calling `setOptions` before `open()` in the same click, racing the gesture requirement. The panel re-resolves the active tab on `tabs.onActivated`.

**Gotcha:** `sidePanel.open()` needs an active user gesture, so the popup must call it _before_ any `await`.

**Gotcha:** `sidePanel` is Chrome-only. `wxt.config.ts`'s `manifest` is a **function** of `{ browser }` purely so the permission is omitted on Firefox, where WXT maps the entrypoint to `sidebar_action`. Verify with `pnpm build && pnpm build:firefox` and diff the manifests. **Known gap:** `entrypoints/popup/App.vue` and `background.ts` call `browser.sidePanel` unconditionally with no `sidebarAction` fallback, so the panel is Chrome-only in practice — the background calls are `.catch()`-guarded, but the popup's `open()` is not.

#### The pricing model: PPP first, FX for one thing only

The conversion is `targetPrice = (basePrice / basePpp) × targetPpp` — a World Bank PPP factor is already "local currency units per international $", so pricing a market in its own currency needs no exchange rate. Rounding is the only post-processing.

**But Play Console does not bill every market in its own currency.** Cambodia, Angola and Argentina are billed in USD; much of non-euro Europe (Poland, Czechia, Sweden, Hungary, Romania, Denmark) in EUR. PPP cannot cross that gap: it says a basket costs 6,700 riel and nothing about what a riel is worth in dollars. Writing the riel figure into a USD field overcharges roughly four thousand-fold. So `quotePrice()` adds one step, and only when the row's currency differs from the market's:

```text
local = intlDollars × ppp(market)      same real purchasing power
usd   = local / fx(market)             what that is actually worth
quote = usd × fx(quote currency)
```

Where the row already bills in the market's own currency the rates cancel and this reduces exactly to pure PPP.

**Read the billing currency off the row; never assume it.** `planPrices()` takes it from the price cell's own text, and `PppPreviewRow.currency` is that currency, not `PriceTarget.currency`. `converted` flags rows that needed a rate so the panel can caveat them once in its footer.

**`quotePrice()` returns null rather than guessing.** With no rate for either side there's no honest answer, and the caller drops the row — a skipped market is recoverable, a mispriced one is written into the console. Turkmenistan and West Bank and Gaza have no published rate and are only priceable in their own currency.

**State the caveat plainly:** a converted price rides on an annual exchange rate and drifts as currencies move; a same-currency price does not. That's also why there's no "never discount below X% of base" knob — that bound would need FX on _every_ market, spreading the drift everywhere.

#### The generated dataset

`utils/ppp-data.ts` is **generated — never hand-edit it.** `scripts/fetch-ppp.mjs` (`pnpm ppp:refresh`) pulls `PA.NUS.PPP` (conversion factor) and `PA.NUS.FCRF` (official exchange rate, LCU per US$) and rewrites it; it's in `.prettierignore` so `pnpm format` can't churn it. Its one hand-maintained input is `CURRENCY_BY_COUNTRY` — the World Bank publishes PPP per country but says nothing about which currency it prices in. Decimal places come from `Intl.NumberFormat`, not a second table.

- **The two indicators must come from the same year per country.** `ppp / fx` is a price level and is meaningless if the halves come from different years — wildly so for a fast-inflating currency like Argentina's, one of the markets that needs this. Rates are fetched as a history and matched to each country's PPP year, falling back to the nearest year and reporting every fallback.
- **`mrnev=1` is not reliable.** The API spends long stretches answering 400/502 to it while plain `date=` range queries keep working. Both indicators are fetched as ranges and reduced in `latestByCountry()`. Don't reintroduce `mrnev`.
- **Round by significant digits (`toPrecision(8)`), not decimal places.** Venezuela's factor is `2.68e-11`; fixed-point rounding flattened it to `0`, which then divided into every conversion. A test asserting every country's `ppp > 0` guards this.
- **Observations older than `MAX_AGE_YEARS` (10) are dropped and reported.** A PPP factor is quoted in its year's currency, and Venezuela dropped fourteen zeros across three redenominations since its 2011 figure. Currently drops CU/VE/YE — none are Play markets.

**Gotcha:** `NAME_ALIASES` in `utils/ppp.ts` is checked against `PPP_COUNTRIES` before being indexed. An alias pointing at a dropped country would resolve a code with no dataset entry and throw when the row was read. A refresh that drops a _new_ country reintroduces the hazard — that's what the "does not resolve an alias for a country the generator dropped" test guards.

#### Matching rows to markets

`matchPriceTarget()` tries the **longest** matching country name first (so "Dominican Republic" doesn't lose to "Dominica", "Papua New Guinea" doesn't lose to "Guinea"), then falls back to a currency code. It's tried on the region text first, then on `"<region> <price>"` — that second pass is what lets a currency-only row resolve. A currency used by exactly one country resolves it exactly; a shared one (EUR, XOF, XCD) returns the **mean** PPP across its members with `approximate: true`, which the panel renders as a `≈` badge. Don't silently drop that flag — pricing twenty economies off one average is a real caveat.

**Gotcha — label rows by what the console calls them, not by `target.name`.** A market with no World Bank observation (Vatican City) resolves only by currency, so `target.name` is the bare currency code and the panel showed "EUR" where the console says "Vatican City". `scanPrices()` emits `priceRow.text || target.name`, which also keeps list keys unique when several unmatched rows share a currency. Unrecognized rows are ignored and counted, so a re-skin degrades to matching fewer rows rather than filling the wrong ones.

#### The price table is a grid of cells, not a form

There is no `<input>` in a row. This is the single most important thing to know here — the first implementation required an input per row and so matched nothing at all on the real page.

```text
<div class="particle-table-row" role="row">
  <ess-cell essfield="region-column"> … <span class="main-text">India</span>
  <ess-cell essfield="price-column">  … <span class="main-text">INR 100.00</span>
    <div class="ess-edit-icon" role="button" aria-haspopup="true">
  <ess-cell essfield="tax-column">    … 18%
```

`toPriceRow()` reads the market from `PRICE_REGION_CELL` and the price from `PRICE_VALUE_CELL`, each through the nested `.main-text` span. **Read the market from its own cell, never from `row.innerText`** — the row's full text is `"India INR 100.00 18%"`, and matching against that lets the currency code and tax percentage steer the result. Two row kinds wear the same markup as a market and are skipped:

- `[role="columnheader"]` — the table header, which would inflate the "Matched N of M" count.
- `PRICE_GROUP_TOGGLE` (`[debug-id="zippy-button"]`) — the collapsible "Other countries / regions (USD)" and "(EUR)" groups. Same row markup, empty price cell, no edit affordance, but their _label contains a currency code_, so the currency fallback matched them and listed a bogus averaged price for a row that can't be filled. Matching Play Console's own `debug-id` beats matching the localised label.

A plain-input fallback path is kept for any price surface that really is a form.

#### The fill walk

Clicking a row's `PRICE_VALUE_CELL` opens an editor popup, portalled to the end of `<body>` rather than nested in the row:

```text
<div class="pane edit-popup console-popup visible">
  <div class="popup-wrapper" role="dialog" aria-label="Price cell edit popup">
    <input class="mdc-text-field__input" type="money64" aria-label="INR">
    <console-button debug-id="save-button">   <button aria-label="Save">
    <console-button debug-id="cancel-button"> <button aria-label="Cancel">
```

`findOpenPriceEditor()` scopes to `PRICE_EDIT_POPUP` (`.edit-popup`) and returns the input plus the Save button. **Never search the document for "the one input"** — an earlier version took the only (or the focused) input on the page, which cannot work: a real console page has a search box, filters and more. Commit goes through `PRICE_EDIT_SAVE` (`[debug-id="save-button"]`), Play Console's own stable hook, which beats matching button text that changes with the display language; `PRICE_CONFIRM_LABELS` then Enter are fallbacks.

**The price table does NOT virtualise — every row is in the DOM from the start, and a row need not be scrolled into view for its edit control to work.** Confirmed against the real console. So the walk is the simple thing: plan once, click each row in order, done. What it does have to respect:

- **The click target is the price cell, not the edit icon.** `PRICE_VALUE_CELL` doubles as `PriceRow.edit`. The `.ess-edit-icon` is only the visible affordance — it's `transparent` and its cell is `trigger-hover`, so aiming at it meant synthesising a hover first. `clickLikeMouse()` sends down/up plus the click (Material often binds `mousedown`) with no hover preamble.
- **`PlannedRow` holds no element reference.** It carries the market name and re-finds the row with `findPriceRowByText()` at fill time. Play Console re-renders a row after its price changes, so a plan-time reference can go stale.
- **One retry pass.** `runFill()` calls `fillEach()`, which returns whatever didn't take, then runs those once more. `'missing'` (row not found) is retried but doesn't spend the `CONSECUTIVE_FAILURE_LIMIT` budget; `'failed'` (the editor misbehaved) does. The walk bails after 3 consecutive failures rather than grinding through 150 rows, and reports how far it got.
- **`closeStrayEditor()` before each click.** Play Console reuses one editor pane, so a popup still closing when the next row is clicked is the popup `findOpenPriceEditor()` hands back — that row's price gets typed into the previous row's editor.

Three waits make the walk survive Angular: for the popup to **appear** (`EDITOR_OPEN_TIMEOUT_MS`); for Save to become **enabled** (`EDITOR_COMMIT_TIMEOUT_MS`, since Angular re-validates on input and clicking too early is a silent no-op that desynchronises every row after it); and for the popup to **close** (`EDITOR_CLOSE_TIMEOUT_MS`) before the next row, or that click lands on the overlay. A popup that won't close is Escaped out of and counted a failure rather than left stranded.

**Gotcha — the editor popup is portalled to `<body>`, so nothing structural ties it to the row that opened it.** `fillRow()` compares the currency code in the row's price cell against the editor input's `aria-label` and bails (`'missing'`, Escape) on a mismatch. It's the only cheap check that catches a click landing on the wrong row before a market gets mispriced.

**Gotcha — `[debug-id="save-button"]` is the `<console-button>` wrapper, not the button.** The interactive element carrying `disabled` is the nested `<button>`. Targeting the wrapper fails _silently and completely_: `isButtonDisabled()` reads no `disabled` so the enabled-wait passes instantly, and the click lands on a non-interactive element, so every row times out waiting for a popup that never closes. `findOpenPriceEditor()` drills to `saveHost.querySelector(BUTTON)` before falling back to the host; same shape for Cancel and Close.

Openness is `isPriceEditorOpen()` — `isConnected` **and** the `visible` class, because Angular leaves the pane in the DOM between opens.

The input takes a bare number; the currency is a suffix span and the input's `aria-label`, not part of the value. **Gotcha:** `setPriceInputValue()` uses the same `execCommand('insertText')` route as `setReplyText()`, and additionally falls back to the `HTMLInputElement.prototype` value setter rather than `input.value = …` — Angular overrides `value` on the element _instance_, so only the prototype setter writes through. It deliberately does _not_ blur, which would close the popup before the value commits.

**A row counts as filled when its editor popup closes, and there is deliberately no read-back check.** One was tried and **broke filling on the real console**: it needs to know exactly how Play Console re-renders a committed cell, and any systematic mismatch (its own reformatting, tax-inclusive display, a slow re-render) reads as failure and trips the failure limit three rows in. A self-calibrating variant didn't save it either — a row already at the target price reads back instantly and proves nothing. The missing ingredient is a way to tell "the cell disagrees" from "the cell can't be read".

**Gotcha — do not reintroduce scrolling, sweeps or a scroll lock.** An early report that filling "only worked when the row was in view" was read as virtualisation (the real cause was almost certainly the click being aimed at the hover-gated `.ess-edit-icon`). That produced per-row scrolling, then multi-pass sweeps, then explicit scroll-container stepping, then two attempts at locking page scroll — each fixing a symptom of the one before. All deleted. The table is static, so the walk doesn't care where the viewport is (verified: `scrollTop` 0 → 0 across runs).

#### Progress reporting

`PPP_PROGRESS` carries `{done, total}` and drives a `<progress>` plus a `12/39` count, which replaces the summary line during a fill (the two icon buttons, disabled anyway, hide so the bar gets the whole row). Both numbers are trustworthy only because of things established above, so don't move them:

- `total` is `plan.length`, **exact** because every price row is in the DOM before the walk starts — there's nothing to discover mid-fill.
- `done` is broadcast **after** a write commits, never before, so it can lag reality but never overstate it.

The panel seeds `{done: 0, total: fillable}` from its own scan in `startFill()` so the bar has a denominator on the first frame, then the walk's `onProgress(0, total)` confirms it. The preview lists **every** matched row and the summary says "Matched N of M price rows" — both complete, since the whole table is in the DOM. The fill button carries no count; `PppFillResult.filled` is the number worth reporting.

**Gotcha — the `unreachable` branch replaces the whole panel, so it is gated on `!result`.** A single failed `tabs.sendMessage` used to blank a finished fill's summary and show "reload this page" — and the rescan right after a fill is exactly such a message.

#### Verification status

**Verified in a real Chromium** against replicas of the real row and popup markup (captured from a logged-in console) injected into `https://play.google.com/console/about/`, which matches the content-script pattern with no session needed: row detection and match counts with a header row and unknown market present, market names from the region cell, conversion output, the `overwriteFilled: false` skip path, the full walk committing through Save, a slow-to-enable Save button, decoy inputs elsewhere on the page, live storage watch from the options page, the popup button's enabled/disabled states, and the preview columns (rows seeded with `INR 650.00`, `IDR 75.000`, `VND 129,000` render the right "was …" and percentage, and the base-currency toggle re-expresses the list in USD).

**Gotcha — the replica must match the real table.** Earlier harnesses modelled a virtualised grid and gated the edit control on hover; all of that was fiction, and each version certified a different wrong walk as correct. `verify20.mjs` is the honest one: all 39 rows permanently in the DOM, 26 off screen at rest, the editor opening from a plain click anywhere in the price cell, one editor pane that takes a beat to close. It asserts per-market that each row got its own price exactly once, that `scrollTop` never moved, and that no click landed on an edit icon.

**The side panel's rendered visibility can't be verified in this sandbox** — Playwright never lists `sidepanel.html` in `ctx.pages()`, even though `sidePanel.open()` resolves. Check the API state (`getOptions({})` and `getOptions({tabId})`) and confirm the show/hide by hand in a real profile.

**Still unverified:** the timing constants against a real Angular build. If filling stops early with "Play Console's price editor didn't respond as expected", the three editor timeouts are the first things to raise.

### Config is `chrome.storage`-backed, shared between content scripts and the options page

Modules under `utils/` define storage schemas via `@wxt-dev/storage`'s `storage.defineItem` (imported explicitly, not via WXT's `#imports` auto-import, so they stay usable from plain unit tests):

- `utils/apps.ts` — `sync:appMappings`: `{label, slug}[]`. `resolveAppSlug()` tries exact label match, then substring match, then auto-slugifies the raw label. Nothing is pre-seeded on install.
- `utils/shortcuts.ts` — six key-combo items sharing the `KeyShortcut` type, declared through a local `defineShortcut(key, fallback)` helper, plus `sync:parseReviewModifier` (modifiers only, default Alt) and `sync:autoTranslateReply` (default `true`). Modifier matching is **exact** on every flag so distinct configured combos can't collide; `matchesKeyShortcut()` and `matchesParseReviewModifier()` both delegate to one private `matchesModifiers()` so the key and mouse paths can't drift.
- `utils/canned-replies.ts` — `sync:cannedReplies`.
- `utils/ppp.ts` — `sync:pppSettings`.
- `utils/bookmarks.ts` — `sync:pageBookmarks`.

**Gotcha — never match a letter shortcut on `e.key` alone.** On macOS Option is a compose key: Option+P reports `e.key === 'π'`, and Shift+K reports `'K'`. A shipped Alt+P default was completely dead on macOS for exactly this reason. `matchesKey()` therefore matches the **physical** key via `e.code` (`KeyP` → `p`) as well as a case-insensitive `e.key`, and `shortcutKeyOf()` — which `ShortcutRecorder.vue` uses instead of `e.key` — persists that physical key. The `e.key` arm is kept so shortcuts recorded before this normalisation (a stored `'π'`) keep working. Known gap: `e.code` is US-layout-relative, the same tradeoff Chrome's own `commands` API makes.

**Gotcha — Playwright cannot reproduce this and will happily false-pass.** `page.keyboard.press('Alt+p')` synthesises `key: 'p'` regardless of host OS, which is how the dead Alt+P shipped past a green end-to-end run. Dispatch the event yourself with the composed character instead: `new KeyboardEvent('keydown', { key: 'π', code: 'KeyP', altKey: true })`. `utils/shortcuts.test.ts` covers all four variants and is the cheaper guard.

All items live in `chrome.storage.sync` (not `.local`) so settings roam with the user's Chrome profile. The app-mapping and template lists are the ones with meaningful size — `sync` caps each item at 8KB, so the editable-list sections' shared `persist()` catches a quota-exceeded write and surfaces it in the status line instead of failing silently.

Content scripts load the current value on init _and_ `.watch(...)` it so options-page edits apply live without a page reload — don't reintroduce a load-once pattern. All four feature modules do this through `utils/watch.ts`'s `watchValue(ctx, item)`, which loads, watches, registers the `ctx.onInvalidated` unwatch, and returns a **getter** — callers write `shortcut()` at use time so they can't close over a stale value.

### One-time local→sync storage migration

`utils/migration.ts`'s `migrateLocalSettingsToSync()` copies any pre-existing `local:*` value to its `sync:*` counterpart. It runs from `entrypoints/background.ts`'s top-level `defineBackground(() => ...)` body rather than behind `onInstalled`, so it fires whenever the service worker wakes — cheap and idempotent, since it only writes when the `sync:` key is still unset. It never overwrites a `sync:` value another device already migrated in, and never deletes the `local:` original (cheap insurance against a migration bug losing data). This code and its legacy key literals can be deleted once no user is expected to still be upgrading from a pre-sync version.

Storage items added since (`sync:cannedReplies`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`, `sync:pppSettings`) are deliberately **not** in this migration — they never existed under `local:*`.

### Shared Play Console URL matcher

`utils/console-url.ts` exports `CONSOLE_URL_MATCH_PATTERN` and `isConsoleUrl()` — the single source of truth for "is this a Play Console page", used by the content scripts' `matches`, the background script's icon logic, and the popup. Don't hardcode the pattern or a second URL check elsewhere.

### Background script keeps the toolbar icon in sync

`entrypoints/background.ts` sets the per-tab icon via `browser.action.setIcon({tabId, path})`: colored when `isConsoleUrl(tab.url)`, grayscale otherwise (grayscale is also `action.default_icon`, so new tabs start gray before any listener fires). It listens on `tabs.onUpdated` and `tabs.onActivated`, plus a one-time `tabs.query({})` sweep on startup.

**Gotcha:** `tab.url` is only populated when the extension has host permission for that tab's _current_ URL. Declaring the pattern only via `content_scripts.matches` was not enough — `tab.url` came back `undefined` for every tab, console pages included, so the icon logic silently never fired. Fixed by also adding `host_permissions` in `wxt.config.ts`. Don't assume `matches` alone grants URL access to other tab-reading logic.

### Popup

`entrypoints/popup/` (Vue). On mount it queries the active tab and sets `isConsoleUrl(tab.url)`. The header row (title + icon-only Options/Documentation buttons) and the "By Visnalize" footer are always visible. Between them it branches: off Play Console, a short guidance message; on Play Console, the PPP pricing control then the bookmark-this-page control.

#### Popup ↔ pricing content script messaging

`utils/messages.ts` also carries `PPP_STATUS`/`PPP_OPEN` and the `PppStatus` shape. It exists because nothing otherwise told the user the PPP panel existed, or that it only does anything on a price editor — so the popup asks the page. On mount it sends `PPP_STATUS`; `pricing.content` replies with scanned/matched row counts (via `scanPrices()`, which is `planPrices()` without a base price) and whether the panel is already open. The popup renders one of three states: a **button** when `matched > 0`, a **hint naming where to find a price editor** when it's 0, and — if `sendMessage` rejects — "reload this page", the honest answer for a tab that was already open when the extension was installed or reloaded.

**Gotcha:** the content script's `onMessage` listener returns `true` only for messages it actually handles. Returning `true` unconditionally holds the reply channel open for every unrelated message on the page and hangs the sender's promise.

No new permission is needed — `tabs.sendMessage` to a tab already covered by `host_permissions` is enough, and the popup never calls `scripting`.

### Saved page shortcuts (popup bookmarks)

`utils/bookmarks.ts` defines `sync:pageBookmarks` (`{id, label, url}[]`) — named "bookmarks" in code to avoid colliding with `utils/shortcuts.ts`'s unrelated keyboard config, even though the popup UI labels the feature "Shortcuts".

The popup is the only surface; there's no options-page equivalent. On a Play Console page it shows a "Bookmark this page" control pre-filled with the tab's title, or a "saved as a shortcut" hint if the URL is already saved. The saved list renders regardless of `isConsoleUrl` — same quick-access list from anywhere — as plain `<a target="_blank">` links plus a remove button, so no `tabs` API call is needed to navigate. "Clear all" is gated behind a plain `window.confirm()`; the popup has no modal of its own and this is the only destructive bulk action.

### Icons

UI icons come from `@lucide/vue` (the non-deprecated successor to `lucide-vue-next` — don't reinstall the old package), imported as individual named components (`import { Trash2 } from '@lucide/vue'`) rather than any global registration.

### Extension-page styling: Tailwind + daisyUI, shared via `assets/ui.css`

The popup, options and side panel share `assets/ui.css`: Tailwind v4 for utilities, [daisyUI](https://daisyui.com) 5 for component classes and the token palette. It's wired up by `@tailwindcss/vite` in `wxt.config.ts`'s `vite.plugins` — there is no `tailwind.config.js`, since v4 is configured from CSS. Each page's `style.css` stays the entry that `index.html` links and `main.ts` imports; it just `@import`s the shared sheet plus anything genuinely page-specific (only the popup has any: Chrome sizes a popup from its content, so `body { width }` can't live inside the Vue tree).

- **The content script deliberately does not use any of this.** `reviews.content/style.css` stays plain hand-written CSS, because Tailwind's preflight would leak resets into Play Console's own page. Don't `@import` `assets/ui.css` from a content script.
- **Source scanning is opt-in.** `ui.css` uses `@import 'tailwindcss' source(none)` and each importing entrypoint declares `@source './'` for its own directory. Automatic detection would scan the whole repo and emit _both_ pages' CSS into each bundle. A new entrypoint that imports `ui.css` needs its own `@source` line, or none of its classes are emitted — the failure mode is an unstyled page, not a build error.
- **Theme overrides go in the plain `:root` block in `ui.css`.** daisyUI emits its default theme under `:where(:root)` (zero specificity), so a normal `:root` block retints it without redefining the theme. Three of the four overrides are an accessibility fix: daisyUI's light-theme `success`/`error` land near 2:1–3:1 contrast at small sizes, below WCAG AA. Check contrast before trusting a default semantic color used as small text.
- **The shared `@layer components` block is for what's used in three or more places** — currently `.page-section`, `.section-title`, `.save-status`, `.remove-btn`. One-off arrangements stay as inline utilities. Apply `.remove-btn` explicitly rather than relying on an `aria-label` attribute-prefix selector, as the old options CSS did.

**Gotcha:** class order in a `:class` binding does _not_ decide which daisyUI modifier wins — stylesheet order does. `btn-outline btn-success` renders as a _solid_ green button because daisyUI emits the color modifier after the style modifier. Check the generated CSS rather than reordering the attribute.

**Gotcha:** VS Code's built-in CSS language service flags `@plugin`, `@source` and `@apply` as unknown at-rules. `.vscode/settings.json` sets `css.lint.unknownAtRules: "ignore"` — cosmetic, not a real error.

### Options page (Vue)

`entrypoints/options/` uses `@wxt-dev/module-vue`. `App.vue` composes three independent sections:

- `AppMappingsSection.vue` — editable table of app label→slug rows.
- `CannedRepliesSection.vue` — editable table of label/content rows (content is a `<textarea>`, since templates are multi-line), plus a hint listing the supported placeholders.
- `ShortcutsSection.vue` — the key-combo rows, rendered with `v-for` over a `keyShortcutRows` table built by a local `makeShortcutRow(label, item, fallback)` factory, each using the reusable `ShortcutRecorder.vue` (click to record a real keydown, Esc cancels). Plus the parse-review modifier checkboxes (blocked from saving an all-unchecked state, which would silently disable the feature) and the auto-translate toggle.

`autosave.ts` holds the two composables the sections share:

- `useSaveStatus()` — the `status` ref plus `flashSaved()`/`showError()`.
- `useEditableList({item, sanitize, quotaMessage})` — the editable-table behavior both list sections need: load on mount, debounced autosave on edit, immediate save on removal, focus the new row's first input, and the storage-quota error path. A section supplies only its row shape, `sanitize`, and quota message. A third list section should reuse this rather than re-deriving it.

### Testing

`vitest.config.ts` uses the `WxtVitest` plugin, which polyfills `browser`/`chrome` with an in-memory `@webext-core/fake-browser` — this is what makes `storage.defineItem()` work in tests with no manual mocking. Reset state between tests with `fakeBrowser.reset()`, not by clearing storage values by hand.

`fake-browser` doesn't model per-tab icon state or real popup/tab-focus semantics, so the background script's icon logic and the popup's active-tab branching need a real Chromium loading `.output/chrome-mv3` (see the `run` skill).

**No `jsdom`/`happy-dom` dependency exists here** — vitest runs in plain `node`, so `document`/`Element` aren't available. `utils/dom.test.ts` and `utils/shortcuts.test.ts` use small duck-typed fake objects cast `as Element`/`as HTMLElement` rather than real DOM nodes, and stub the global `document` via `vi.stubGlobal`. Don't add a real DOM dependency for a test — follow that pattern. The tests import selectors from `utils/selectors.ts` rather than re-typing the literals, so a selector change can't leave a test asserting a stale one.

`utils/ppp.test.ts` also asserts things about the **generated** dataset: that US is exactly `1` (every conversion divides by the base factor), that every country has a positive factor and a 3-letter currency, and that every name round-trips through `matchPriceTarget()`. Those are what catch a bad `pnpm ppp:refresh` — keep them when touching that file.

The parts of `utils/dom.ts` that need layout or live focus (`getReviewContainers`, the flash animations, `findReplyFieldIn`, `setReplyText`, `getPriceRows`, `setPriceInputValue`) and the feature modules themselves have no unit tests: they depend on `getBoundingClientRect`/`scrollIntoView`/real focus-and-keydown-through-Angular. Verify those in a real loaded Chromium.
