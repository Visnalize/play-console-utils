# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension (built with [WXT](https://wxt.dev)) that adds productivity shortcuts to the Google Play Console: a configurable quick-reply key combo (optionally auto-translating the reply to match the review's language before publishing), a configurable modifier+click "parse review" action that copies structured review JSON to the clipboard, a configurable shortcut that opens a floating picker of canned reply templates (with `{author}`/`{date}`/`{app}` placeholders filled in from the review), configurable shortcuts to jump to the next/previous review in the list, a configurable shortcut that opens a purchasing-power-parity pricing panel and bulk-fills Play Console's price fields from one base price, an options page for configuring all of the above plus per-app slug mappings, a background script that keeps the toolbar icon in sync with whether the active tab is a Play Console page, and a popup with quick links.

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

There is no `manifest.json` in the repo. WXT generates it at build time from `wxt.config.ts` (top-level fields: name, description, permissions, icons, action) plus whatever each entrypoint declares (`content_scripts.matches` comes from `defineContentScript({ matches })`; `options_ui` is auto-detected from `entrypoints/options/`). `manifest.version` is deliberately _not_ set in `wxt.config.ts` — WXT falls back to `package.json`'s `version` field, which is the single source of truth (bumped directly, or via the release workflow from a pushed tag; see README's Releasing section). Don't add a manifest field in `wxt.config.ts` that an entrypoint already declares, or re-add an explicit `version`, — that causes duplication/drift.

### File naming

Module filenames are **one word where possible, two at most** (`dom.ts`, `selectors.ts`, `navigation.ts`, `picker.ts`, `quick-reply.ts`). Vue components keep `PascalCase.vue`. When a name wants a third word, that's the signal the module is doing too much or sits in the wrong directory — split it or move it rather than growing the filename.

### Two content-script entrypoints

`entrypoints/reviews.content/` (four review feature modules) and `entrypoints/pricing.content/` (the PPP fill engine) are both directory-entrypoints matching `https://play.google.com/console/*`. They're split because they touch unrelated parts of the console and share no state — and because a fifth module named `pricing.ts` inside a directory called `reviews.content` would be a lie.

**They cost nothing extra in the manifest:** WXT merges content scripts with identical `matches`/`run_at` into a single `content_scripts` entry (verify with `cat .output/chrome-mv3/manifest.json` after a build).

**`pricing.content` injects nothing** — no DOM, no stylesheet, no toast. It's a message handler over `utils/dom.ts`; all of its UI is the side panel. Only `reviews.content` contributes to `content_scripts.css`. Keep it that way: anything visual belongs in the side panel, which gets Tailwind/daisyUI for free.

`utils/toast.ts` is used by `reviews.content` only; it used to live in that directory and was moved when the second entrypoint arrived. Don't move it back, and don't hand-roll a second toast.

#### `reviews.content` — four feature modules

Its `main(ctx)` wires up four independent feature modules that live alongside it, then logs once that the shortcuts are active (the per-module logs it used to print were pure noise):

- `quick-reply.ts` — listens for a configurable key combo while a reply textarea/contenteditable is focused; if auto-translate is enabled, translates the reply to match the review's language first (see below), then finds and clicks the publish button (`PUBLISH_LABELS`), flashing it green via `flashPublished()`.
- `parse-review.ts` — listens for a configurable modifier+click on review text, scrapes author/date/avatar/content from the enclosing review container, resolves the app slug, copies JSON to the clipboard, shows a toast, and briefly highlights the review container (`flashHighlight()`).
- `picker.ts` — listens for a configurable key combo while a reply field is focused, opens a floating picker of saved templates, fills placeholders, and inserts the result (see "Canned reply templates" below).
- `navigation.ts` — listens for configurable next/previous-review and next/previous-review-_page_ key combos, scrolls to and focuses the corresponding review container's reply field (item navigation) or clicks the paginator's prev/next button (page navigation), and discards any unpublished draft left behind on the review you're leaving either way (see "Review navigation" below).

Feature modules contain no selectors and no raw DOM traversal — both live in `utils/selectors.ts` and `utils/dom.ts` (see the next section).

`utils/toast.ts` wraps the [toastify-js](https://github.com/apvarun/toastify-js) dependency (zero runtime deps of its own) behind a small `showToast(message, { sticky? })` helper shared across modules — `{ sticky: true }` returns a handle whose `.hide()` dismisses it manually (used by quick-reply's translation-in-progress toast), otherwise it auto-dismisses after 2.5s. Don't hand-roll a new `document.createElement('div')` toast in any feature module — route through this helper instead.

`reviews.content/style.css` is the only stylesheet a content script injects (highlight flash, publish flash, picker panel — all `pcu-`-prefixed), imported alongside `toastify-js/src/toastify.css`.

All four register listeners through `ctx.addEventListener(...)` / `ctx.onInvalidated(...)` (from the `ContentScriptContext` WXT passes into `main`), not raw `window`/`document` listeners — this auto-cleans-up if the extension reloads while the tab stays open, instead of the old manual `window.__xLoaded` guard pattern.

**Gotcha:** `ContentScriptContext` must be imported as a type from `'wxt/utils/content-script-context'`. The auto-imported global of the same name is value-only (`declare const ContentScriptContext: typeof ...`) and will fail type-checking (`TS2749`) if used directly as a parameter type annotation.

### Selectors in one file, DOM access in one file

Play Console's DOM is a third-party contract that can change without notice, so it's reachable from exactly two modules:

- `utils/selectors.ts` — **every** selector string and button-label matcher: `REVIEW_CONTAINER`, `REVIEW_AUTHOR`, `REVIEW_DATE`, `REVIEW_TEXT`, `REVIEW_AVATAR`, `ACTIVE_APP_BUTTON`, `ORIGINAL_LANGUAGE_HEADER`, `REPLY_FIELD`, `BUTTON`, `PRICE_ROW`, `PRICE_REGION_CELL`, `PRICE_VALUE_CELL`, `PRICE_INPUT`, `NON_PRICE_INPUT_TYPES`, plus the localized (English/Spanish) label lists `PUBLISH_LABELS`, `DISCARD_LABELS`, `NEXT_PAGE_LABELS`, `PREV_PAGE_LABELS`. No behavior — constants only. When Play Console re-skins the reviews page, this is the file to fix.
- `utils/dom.ts` — the only module that queries, mutates, or animates page elements: review lookups (`getReviewContainers()`, `getReviewContainerOf(el)`, `getReviewAuthor()`, `getReviewDate()`, `getReviewAvatarUrl()`, `getReviewText()`, `getActiveAppLabel()`, plus the `UNKNOWN_AUTHOR`/`UNKNOWN_DATE` fallbacks), reply-field access (`isReplyField()`, `getFocusedReplyField()`, `findReplyFieldIn()`, `getReplyText()`/`setReplyText()`), button lookups (`findButtonByText(scope, labels)`, `isButtonDisabled(el)`), pricing-table access (`getPriceRows()`, `toPriceRow()`, `isPriceInput()`, `getPriceInputValue()`, `setPriceInputValue()`, `findPriceRowByText()`, `findOpenPriceEditor()`), and the flash animations (`flashHighlight()`, `flashPublished()`, which add the `pcu-highlight`/`pcu-publish-flash` classes styled in `entrypoints/reviews.content/style.css`).

Don't add a `querySelector` call, a selector literal, or an inline style mutation to a feature module — extend these two instead. It lives in `utils/` rather than the content-script directory so it stays unit-testable (`utils/dom.test.ts`) and importable from anywhere.

**Gotcha:** the element that receives a click on the review body is usually _not_ the paragraph you clicked — Play Console nests the body in wrappers that also carry the device line, the "Translated from …" banner and the reply box's helper text, so `(e.target as HTMLElement).innerText` (what `parse-review.ts` used to copy) yields all of that concatenated. The review body is read from the container through the `REVIEW_TEXT` (`.review-text`) selector instead, same as author/date; the click only identifies which review container to read.

**Gotcha:** not every clickable control in Play Console is a native `<button>` — the review-list paginator's prev/next controls are a `material-button` custom element (confirmed: an earlier version of `findButtonByText` that only queried `button` silently never found them, so page navigation did nothing). Hence `BUTTON` is `'button, material-button'`, and `isButtonDisabled()` checks the native `.disabled` property _and_ the `disabled`/`aria-disabled` attribute forms, since a custom element doesn't necessarily expose the IDL property the way `HTMLButtonElement` does. If another Play Console control turns out to use a different custom tag name, extend that selector rather than assuming `button` is enough.

**Gotcha:** `flashPublished()` animates the publish button via a CSS class instead of assigning `element.style.*` directly (which is what the code did originally, and which left the button permanently green until Angular re-rendered it). Keep page-owned elements free of inline styles — the class is removed on `animationend`, so Play Console gets its button back exactly as it was.

### Quick-reply auto-translation

When `sync:autoTranslateReply` is on (default), `quick-reply.ts` reads Play Console's own "Translated from X -" banner (`ORIGINAL_LANGUAGE_HEADER`, inside the same review container as the reply box) to find the review's original language — `utils/language.ts`'s `extractTargetLanguageCode()` parses that banner text and maps the language name to a BCP-47 code via the `LANGUAGE_NAME_TO_CODE` table in the same file (the table and its one consumer used to be split across two modules for no reason). **The banner only renders when the review's language differs from the console's display language**, so its absence is treated as "already matches, skip translation," not a detection failure.

`utils/translation.ts` wraps Chrome's on-device `Translator`/`LanguageDetector` globals (stable since Chrome 138 for many language pairs, not yet in TS's `lib.dom.d.ts` — hence the local ambient `declare global` there). It detects the reply's own language first (to skip a no-op translation when the reply is already in the target language) and no-ops safely — falling back to publishing the reply as typed — when the APIs are unsupported or a language pair is unavailable. No network requests are involved; translation runs entirely on-device.

**Gotcha:** after programmatically overwriting the reply box's content, the publish button's `disabled` state does _not_ flip synchronously — Play Console's Angular change detection needs a tick to react. Checking `publishBtn.disabled` immediately after the mutation reads the stale (disabled) value and silently no-ops (no thrown error, so nothing shows up in the console). `quick-reply.ts`'s `waitForEnabledPublishButton()` polls (50ms interval, 3s timeout) instead of checking once, and only after a translation actually happened — the untranslated path still checks the button immediately. If the poll still times out, a toast + `console.warn` tell the user to click Publish manually rather than failing silently again.

**Gotcha:** how the reply text gets written matters more than the events dispatched afterwards. `setReplyText()` selects the field's contents and types over them with `document.execCommand('insertText', …)` — deprecated, but the only API that runs the browser's real editing pipeline, so the `beforeinput`/`input` events are trusted _and_ the caret stays in the field. Assigning `.innerText` on a contenteditable (what it did before) replaces the node the caret lives in, which drops focus out of the reply box and collapses Play Console's reply toolbar — publish button included — so the post-translation publish click had nothing to click. The direct write + synthetic `input`/`change` events remain as a fallback, guarded by a read-back check, followed by a re-`focus()`.

`findPublishButton()` is scoped to the focused field's review container where possible: `PUBLISH_LABELS` is substring-matched against text _or_ aria-label, so a document-wide search can hit a different review's (disabled) publish button first. And the whole translation step is wrapped in a `try`/`catch` in the keydown listener — a throw from the on-device APIs would otherwise reject the async listener and skip publishing entirely, leaving nothing but an unhandled rejection.

**Unverified in a real browser:** the assumption that the reply textarea/contenteditable lives inside the same review container as the language banner. Confirm against a live foreign-language review. `picker.ts` leans on this same assumption to reach the author/date elements for placeholder text — it's a reused risk, not a new one.

### Canned reply templates

`utils/canned-replies.ts` defines `sync:cannedReplies` (array of `{id, label, content}`, `id` minted via `crypto.randomUUID()` like `utils/bookmarks.ts`) and `fillCannedReplyPlaceholders(template, data)`, which does a simple `{word}`-token replace. Unknown/mistyped placeholders (e.g. `{Author}`, `{foo}`) are left **literal**, not blanked — a visibly wrong token is a better failure mode than silently vanishing text.

`picker.ts` opens on a configurable shortcut (`sync:cannedReplyShortcut`, default Ctrl/⌘+K) while a reply field is focused. It builds placeholder data from the focused field's review-container ancestor via `utils/dom.ts`'s `getReviewAuthor()`/`getReviewDate()` (shared with `parse-review.ts`, so both use one implementation and one set of fallback strings) plus `getActiveAppLabel()` (the raw app-selector display name — **not** `resolveAppSlug()`'s slug, which is a different, URL-safe concept meant for JSON export, not reply text). The picker itself is a hand-rolled `position: fixed` panel (no Vue in the content-script bundle), anchored to the focused field's `getBoundingClientRect()` and flipped above it if there isn't room below. While open, a capture-phase `window` keydown listener intercepts only `Escape` (close) and digits `1`-`9` (select the matching row, first `NUMBERED_ROWS` templates only — templates beyond that are still listed and clickable, just unnumbered); every other key passes through untouched so normal typing and Play Console's own bindings are unaffected. Each row renders its digit as a key-cap `<span>` (`.pcu-picker__key`, plus `aria-keyshortcuts` on the row) rather than a `"1. "` text prefix, so the number reads as a shortcut and not as list numbering; unnumbered rows past `NUMBERED_ROWS` get an invisible cap of the same footprint (`--empty`) purely to keep every label on one left edge. A sticky header above the rows names the feature and carries the "press a number key" hint. Selecting a template **fully replaces** the reply field's current content (via `setReplyText`) — it doesn't insert at cursor or auto-publish.

### Review navigation

`navigation.ts` covers two distinct axes, each with its own pair of configurable shortcuts:

**Item navigation** (`sync:nextReviewShortcut`/`sync:prevReviewShortcut`, default Alt+ArrowDown/Alt+ArrowUp) moves between reviews on the current page. On each keypress it freshly re-queries the review containers via `getReviewContainers()` (never cached — Angular may re-render the list between presses) and determines the "current" review three ways, in order of precision: if a reply field is currently focused, its enclosing review container is current; else the container it last navigated to (`lastNavigatedContainer`), if that node is still in the freshly-queried list; else the last container whose top is at or above a small threshold (`CURRENT_THRESHOLD_PX`, so a review scrolled slightly past the viewport top still counts as current). It then discards any unpublished draft on the review being left (see below), scrolls to and highlights the target review (`scrollIntoView({behavior:'smooth'})` + `flashHighlight()`), and focuses the target's reply field (`findReplyFieldIn(target)?.focus({ preventScroll: true })`, so quick-reply/picker/typing can act immediately without an extra click — `preventScroll: true` avoids the browser's default focus-scroll fighting with the smooth `scrollIntoView` call). At either end of the list it shows a toast instead of navigating further, and skips all of the above.

**Gotcha:** an already-replied review has no reply field to focus, and the focus-first rule above then reads the review you just _left_ as the current one — so forward navigation kept re-targeting the same replied review while backward navigation still worked. Two things fix it together: `lastNavigatedContainer` (the middle tier above, also covering the window where the smooth scroll hasn't moved the viewport yet), and blurring the stale field whenever `document.activeElement` isn't the target's reply field after the focus attempt. Page navigation clears `lastNavigatedContainer` before clicking, since Angular may recycle container nodes for the next page's reviews.

**Page navigation** (`sync:nextReviewPageShortcut`/`sync:prevReviewPageShortcut`, default Alt+ArrowRight/Alt+ArrowLeft) clicks Play Console's own paginator prev/next button instead — found via `findButtonByText(document, NEXT_PAGE_LABELS | PREV_PAGE_LABELS)`, matching `"next page"`/`"previous page"`/the Spanish equivalents against text-or-aria-label. The paginator's prev/next controls are a `material-button` custom element, not a native `<button>` (confirmed against real Play Console — see the `utils/dom.ts` gotcha above), so `isButtonDisabled()` is used instead of a raw `.disabled` read for the boundary check (no more pages) before deciding whether to click or show a toast. It does **not** attempt to scroll to or focus anything on the new page — the page swap is Angular-driven and async, so there's no reliable moment to act once the new reviews have rendered (unlike the synchronous DOM read/scroll used for item navigation).

Both axes share `discardUnpublishedDraft()`: it only acts if the review being left has its reply field currently focused _and_ that field has non-empty text (an unfocused or already-empty reply field is left alone), clicking a `findButtonByText(container, DISCARD_LABELS)`-matched Discard/Cancel button (English/Spanish). This exists so navigating through the list — or across pages — doesn't leave a trail of abandoned half-typed replies behind.

All four shortcuts are dispatched from one `keydown` listener over a `bindings` table (`{shortcut, run}` pairs) rather than an if/else-if chain, so adding a fifth navigation shortcut is a table entry.

**Gotcha:** page navigation's default (Alt+ArrowLeft/Right) collides with Chrome's own browser-back/browser-forward accelerator on Windows/Linux (not on Mac, where that's Cmd+Left/Right instead) — pressing it while nothing intercepts first could navigate the whole tab away from Play Console instead of paginating. `e.preventDefault()` is called before this is knowable, so it should suppress the browser's handling in most cases, but this is unconfirmed against a real Chrome build on Windows. If it doesn't, the shortcut is reconfigurable from the options page.

**Unverified in a real browser:** whether Play Console's review list virtualizes/recycles DOM nodes for offscreen rows (which could interact oddly with an in-progress unpublished draft if you navigate far away and back); whether review-container document order always matches visual top-to-bottom order; whether Play Console's actual Discard/Cancel button text matches the English/Spanish substrings in `DISCARD_LABELS`; and the Alt+Left/Right collision noted above. (The paginator's aria-labels and `material-button` tag name _are_ confirmed against real Play Console.)

### PPP pricing

The UI is a **side panel** (`entrypoints/sidepanel/`, Vue + the shared `assets/ui.css`), opened from the popup's button — deliberately no keyboard shortcut, since repricing a catalogue is a rare, one-off action. It owns **everything**: base price, base country, rounding, custom factor, the overwrite toggle, the preview and the fill. There is no PPP section on the options page; it had one with a synthetic preview table, and both were redundant once the panel previewed the real page.

**The side panel is an extension page, so it cannot touch the Play Console DOM at all.** Everything goes through `utils/messages.ts`: `PPP_SCAN` (returns counts plus an already-converted preview), `PPP_FILL` (runs the walk, resolves with the result), `PPP_ABORT` (the Stop button), and a fire-and-forget `PPP_PROGRESS` broadcast during the walk. **Prices are computed content-script side and sent over as plain data** — the panel never re-derives them, so the two can't disagree about what a row should say.

**Every figure in a preview row is pre-computed content-script side, in both currencies.** `PppPreviewRow` carries `price`/`priceBase`, `current`/`currentBase` and `change`, so the panel's "show in base currency" toggle (`showBase`) is a pure view switch — no re-scan, no re-derivation, and the two sides can't disagree. `toBaseCurrency()` is `convertPrice()`'s PPP step run backwards; it exists so twenty currencies become comparable at a glance ("≈ USD 4.98" next to "≈ USD 5.62" says something "INR 99.99" next to "BRL 12.99" cannot), and it's deliberately not charm-rounded since it's never written anywhere.

`current` comes from `parsePriceValue(priceRow.valueText)`, which infers the decimal separator rather than assuming one — Play Console renders prices in the console's display language, so `.` and `,` swap roles. A lone separator with a three-digit tail is grouping ("VND 35,000", "IDR 15.000"); a currency with decimals always renders them, so there's no ambiguity left to resolve. **It returns `null`, not `0`, for a cell with no digits** — an unpriced row must not read as a 100% drop from a price that never existed, and `percentChange()` refuses a zero baseline for the same reason.

**Gotcha:** the "was … / ±N%" line is hidden when the change rounds to zero, not just when there's no baseline. Without that, the instant a fill finishes _every_ row grows a redundant "was &lt;the same number&gt; · no change" line.

**Gotcha:** settings ride along on every `PPP_SCAN`/`PPP_FILL` rather than being `watchValue`d in the content script. The panel writes a setting and re-scans immediately; a storage watch on the other side hasn't necessarily fired by then, so the scan would silently price with the _previous_ value. Passing them explicitly removes the race and removed the watch. `PPP_SCAN`'s `settings` is **optional** — the popup only wants the row count to decide whether to enable its button, and counting needs no pricing config.

**Gotcha — a throw inside `onMessage` is indistinguishable from "no content script on this tab".** The reply channel just dies, `tabs.sendMessage` rejects, and the caller's `catch` reports the wrong thing. That's how making `settings` required for a moment showed up as a permanently disabled popup button with a "Reload this Play Console page" tooltip, instead of an error. The scan handler catches and answers; keep it that way.

**Gotcha — `tabs.sendMessage` takes `any`, so the compiler does not check message payloads.** `pnpm compile` was clean while the popup sent a message missing a required field. Annotate outgoing messages as `PricingMessage` at the call site (the popup and side panel both do) so the contract is actually enforced.

**Rescan is a button, not a `MutationObserver`.** Expanding Play Console's "Other countries / regions (USD / EUR)" sections adds rows the panel can't know about. A button is a handful of lines against an observer's subtree wiring, debouncing and extra broadcast, and the fill walk re-scans on every pass anyway — so the button only affects what the _preview_ shows.

This replaced an injected floating panel built with `document.createElement`, and deleted a lot with it: the panel DOM builder, `pricing.content/style.css`, the outside-click and Escape handlers, the toast plumbing, and `PANEL_MARKER_ATTR` (which existed only so a page scan wouldn't find the injected panel's own price input). If you're tempted to inject UI into the page again, that's the history.

**Per-tab visibility lives in `entrypoints/background.ts`.** Chrome's side panel is global by default — once opened it stays available in _every_ tab, because availability comes from the manifest's `side_panel.default_path`. `syncTab()` therefore calls `sidePanel.setOptions({tabId, enabled: isConsoleUrl(url)})` alongside the existing toolbar-icon logic, so switching to a non-Play-Console tab hides it. This scopes it to Play Console tabs, not strictly the one tab it was opened from: doing that would mean calling `setOptions` before `open()` inside the same click, which races against the gesture requirement below. The panel re-resolves the active tab on `tabs.onActivated`, so it's always talking to the tab in front of it.

**Gotcha:** `sidePanel.open()` needs an active user gesture, so the popup must call it _before_ any `await` — an await first and Chrome no longer counts the click. **Gotcha:** `sidePanel` is Chrome-only. `wxt.config.ts`'s `manifest` is a **function** of `{ browser }` purely so the permission is omitted on Firefox, where WXT maps the same entrypoint to `sidebar_action`; the popup feature-detects `sidePanel` vs `sidebarAction`. Verify both with `pnpm build && pnpm build:firefox` and diff the two manifests.

**The model is PPP first, with exchange rates used for one specific thing only.** The conversion is `targetPrice = (basePrice / basePpp) × targetPpp` — a World Bank PPP factor is already "local currency units per international $", so pricing a market in its own currency needs no rate at all. Rounding is the only post-processing.

**But Play Console does not bill every market in its own currency**, and that is where a rate becomes unavoidable. Cambodia, Angola and Argentina are billed in USD; much of non-euro Europe (Poland, Czechia, Sweden, Hungary, Romania, Denmark) in EUR. PPP alone cannot cross that gap: it says a basket costs 6,700 riel and says nothing about what a riel is worth in dollars. Writing the riel figure into a USD field overcharges by the exchange rate — roughly four thousand times. So `quotePrice()` adds one step, and only when the row's currency differs from the market's:

```text
local = intlDollars × ppp(market)      same real purchasing power
usd   = local / fx(market)             what that is actually worth
quote = usd × fx(quote currency)
```

Where the row already bills in the market's own currency the rates cancel and this reduces exactly to the old pure-PPP line — so nothing about India or Japan changed.

**Read the billing currency off the row; never assume it.** `planPrices()` takes it from the price cell's own text. `PppPreviewRow.currency` is that currency, not `PriceTarget.currency`, and `converted` flags the rows that needed a rate so the panel can say so once in its footer.

**`quotePrice()` returns null rather than guessing.** With no rate for either side there is no honest answer, and the caller drops the row: a skipped market is recoverable, a mispriced one is written into the console. Two countries (Turkmenistan, West Bank and Gaza) have no published rate and are therefore only priceable in their own currency.

**The caveat this buys, state it plainly:** a converted price rides on an annual exchange rate and drifts as currencies move; a same-currency price does not. That is also why the old "never discount below X% of base" knob is still absent — that bound would need FX on _every_ market, not just the cross-currency ones, and would put the drift everywhere.

`utils/ppp-data.ts` is **generated — never hand-edit it**. `scripts/fetch-ppp.mjs` (`pnpm ppp:refresh`) pulls two World Bank indicators — `PA.NUS.PPP` (PPP conversion factor) and `PA.NUS.FCRF` (official exchange rate, LCU per US$) — and rewrites it; it is in `.prettierignore` so `pnpm format` cannot churn it. The script's one hand-maintained input is `CURRENCY_BY_COUNTRY` (the World Bank publishes PPP per country but says nothing about which currency that country prices in); decimal places come from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` rather than a second table.

**Generator gotcha — the two indicators must come from the same year per country.** `ppp / fx` is a price level, and it is only meaningful if both halves are from one year; pairing a 2023 PPP with a 2024 rate is wildly wrong for a fast-inflating currency, which is precisely Argentina — one of the markets that needs this. So the rates are fetched as a _history_ and matched to each country's own PPP year, falling back to the nearest year and reporting every fallback (23 countries at the last refresh).

**Generator gotcha — `mrnev=1` is not reliable.** The API spends long stretches answering 400 or 502 to it while plain `date=` range queries keep working, which silently breaks `pnpm ppp:refresh`. Both indicators are now fetched as ranges and reduced to each country's latest year in `latestByCountry()`. Don't reintroduce `mrnev`.

**Generator gotcha — two filters that both exist because of real data:**

- Rounding is by **significant digits** (`toPrecision(8)`), not decimal places. Venezuela's factor is `2.68e-11`; the original `Math.round(v * 1e6) / 1e6` flattened it to `0`, which then divided into every conversion. Caught by a test asserting every country's `ppp > 0`.
- Observations older than `MAX_AGE_YEARS` (10) are **dropped and reported**. A PPP factor is quoted in its year's currency, and Venezuela dropped fourteen zeros across three redenominations since its 2011 figure. Currently drops CU/VE/YE — none are Play markets.

**Gotcha:** `NAME_ALIASES` in `utils/ppp.ts` is checked against `PPP_COUNTRIES` before being indexed. An alias pointing at a country the generator dropped (`venezuela: 'VE'`) would otherwise resolve a code with no dataset entry and throw when the row was read. A refresh that drops a _new_ country is enough to reintroduce this — that's what the "does not resolve an alias for a country the generator dropped" test is guarding.

**The price table is a grid of cells, not a form — there is no `<input>` in a row.** This is the single most important thing to know here, and the first implementation got it wrong (it required an input per row, so it matched nothing at all on the real page). The real markup:

```html
<div class="particle-table-row" role="row">
  <ess-cell essfield="region-column">
    … <span class="main-text">India</span>
    <ess-cell essfield="price-column">
      … <span class="main-text">INR 100.00</span>
      <div class="ess-edit-icon" role="button" aria-haspopup="true">
        <ess-cell essfield="tax-column"> … 18%</ess-cell>
      </div></ess-cell
    ></ess-cell
  >
</div>
```

So `toPriceRow()` reads the market from `PRICE_REGION_CELL` and the current price from `PRICE_VALUE_CELL`, each through the nested `.main-text` span. **Read the market from its own cell, never from `row.innerText`** — the row's full text is `"India INR 100.00 18%"`, and matching against that lets the price cell's currency code and the tax percentage steer the result. Two kinds of row are skipped because they wear the same markup as a market:

- `[role="columnheader"]` — the table header, which would otherwise inflate the "Matched N of M" count.
- `PRICE_GROUP_TOGGLE` (`[debug-id="zippy-button"]`) — the collapsible **"Other countries / regions (USD)"** and **"(EUR)"** groups. Identical `particle-table-row`, identical region/price/tax cells, empty price cell, no edit affordance — but their _label contains a currency code_, so the currency fallback matched them and the panel listed a bogus averaged price for a row that can't be filled at all. Matching Play Console's own `debug-id` beats matching the label, which is localised. A plain-input fallback path is kept for any price surface that really is a form.

`matchPriceTarget()` is tried on the region text first, then on `"<region> <price>"` — that second pass is what lets a currency-only row still resolve.

**Gotcha — label rows by what the console calls them, not by `target.name`.** Markets with no World Bank observation (Vatican City, and anything else outside the 202 countries) resolve only by currency, and `PriceTarget.name` is then the bare currency code — the panel showed **"EUR"** where Play Console says "Vatican City". `scanPrices()` therefore emits `priceRow.text || target.name`. It also keeps the panel's list keys unique when several unmatched rows share a currency. The `≈` badge is what communicates that the price is a currency-wide average. Unrecognized rows are ignored and counted, so a re-skin degrades to matching fewer rows rather than filling the wrong ones.

**Filling is therefore sequential and click-driven, not a batch write.** Clicking a row's `PRICE_VALUE_CELL` opens an editor popup — portalled to the end of `<body>`, not nested in the row:

```html
<div class="pane edit-popup console-popup visible">
  <div class="popup-wrapper" role="dialog" aria-label="Price cell edit popup">
    <input class="mdc-text-field__input" type="money64" aria-label="INR" />
    <console-button debug-id="save-button">
      <button aria-label="Save">
        <console-button debug-id="cancel-button">
          <button aria-label="Cancel"></button
        ></console-button></button
    ></console-button>
  </div>
</div>
```

`findOpenPriceEditor()` scopes to `PRICE_EDIT_POPUP` (`.edit-popup`) and returns the input plus the Save button. **Never search the document for "the one input"** — an earlier version did exactly that (taking the only input on the page, or the focused one) and it cannot work: a real console page has a search box, filters, and more. Commit goes through `PRICE_EDIT_SAVE` (`[debug-id="save-button"]`), Play Console's own stable hook, which beats matching button text that changes with the display language; `PRICE_CONFIRM_LABELS` and then Enter are fallbacks.

Three waits make the walk survive Angular:

- **for the popup to appear** after the click (`EDITOR_OPEN_TIMEOUT_MS`);
- **for Save to become enabled** (`EDITOR_COMMIT_TIMEOUT_MS`) — Angular re-validates on input, so Save can still be disabled for a tick after the write, and clicking too early is a silent no-op that leaves the popup open and desynchronises every row after it;
- **for the popup to close** (`EDITOR_CLOSE_TIMEOUT_MS`) before the next row, or that row's click lands on the overlay instead. If it doesn't close, the row is Escaped out of and counted a failure rather than left stranded mid-edit.

**A row counts as filled when its editor popup closes, and there is deliberately no read-back check.** One was tried — re-read the row's cell and confirm it shows the value just written, so a cancelled edit couldn't inflate the count — and it **broke filling on the real console**, which is the only place it was ever exercised end to end. It needs to know exactly how Play Console re-renders a committed cell, and any systematic mismatch (its own reformatting, tax-inclusive display, a slow re-render) reads as failure and trips `CONSECUTIVE_FAILURE_LIMIT` three rows in. A "self-calibrating" variant that only armed itself after one row read back didn't save it either: a row already sitting at the target price reads back instantly and proves nothing, so the flag armed on a row that had never tested anything. If you revisit this, the missing ingredient is a way to tell "the cell disagrees" from "the cell can't be read", and neither the harness nor the live page has offered one.

**The price table does NOT virtualise — every row is in the DOM from the start, and a row does not need to be scrolled into view for its edit control to work.** This is confirmed against the real console, and it is worth stating loudly, because a long and costly detour was built on the opposite assumption. The walk is therefore the simple thing: plan once, click each row in order, done. No scrolling, no repeated sweeps, no scroll-container discovery.

What the walk does still have to respect:

- **The click target is the price cell, not the edit icon.** `PRICE_VALUE_CELL` doubles as `PriceRow.edit`. The `.ess-edit-icon` inside the cell is only the visible affordance: it carries a `transparent` class and its cell carries `trigger-hover`, so aiming at _it_ meant synthesising a hover first. Clicking the cell needs none of that, which is why `hoverAndClick()` became `clickLikeMouse()` — down/up plus the click, since Material often binds `mousedown`, but no hover preamble. `PRICE_EDIT_BUTTON` is gone; nothing needs a selector for the icon.
- **`PlannedRow` holds no element reference.** It carries the market name, and the row is re-found with `findPriceRowByText()` at the moment it is filled. Play Console re-renders a row after its price changes, so a reference captured at plan time can go stale — keying on the name makes that class of bug unrepresentable rather than merely handled.
- **One retry pass.** `runFill()` calls `fillEach()`, which returns whatever did not take, then runs those once more. That covers a row Angular happened to be re-rendering, or an editor slow to close, and costs nothing when everything works first time. `'missing'` (row not found) is retried but does not spend the `CONSECUTIVE_FAILURE_LIMIT` budget; `'failed'` (the editor misbehaved) does.
- **`closeStrayEditor()` before each click.** Play Console reuses one editor pane. A popup that is still closing when the next row is clicked is the popup `findOpenPriceEditor()` hands back, so that row's price gets typed into the previous row's editor. The currency check below catches the consequence — but only by skipping the market, which surfaces as yet another "random country stayed unmodified". Clearing it up front is what stops it happening.

**Gotcha — the editor popup is portalled to `<body>`, so nothing structural ties it to the row that opened it.** After the popup opens, `fillRow()` compares the currency code in the row's own price cell against the one in the editor input's `aria-label`, and bails (`'missing'`, Escape) on a mismatch. It is the only cheap check that catches a click landing on the wrong row before a market gets mispriced.

**Gotcha — do not reintroduce scrolling, sweeps or a scroll lock here.** The history, so it isn't repeated: an early report that filling "only worked when the row was in view" was read as virtualisation. (The real cause was almost certainly that the click was aimed at the hover-gated `.ess-edit-icon`; clicking the price cell instead makes both the hover and the visibility irrelevant.) That produced `scrollPriceRowIntoView()` per row, then multi-pass sweeps, then explicit scroll-container stepping (`findPriceScroller()`, `scrollPriceTableStep()`), then two attempts at locking the page's scroll so the user could not disturb the walk — each one added to fix a symptom of the one before. All of it is deleted. Since the table is static, the walk simply does not care where the viewport is, and the page never moves during a fill (verified: `scrollTop` 0 → 0 across runs).

The preview lists **every** matched row, and the summary says "Matched N of M price rows" — both are complete, since the whole table is in the DOM. (It used to say "loaded rows" and list only the ~14 the panel could see, which was the virtualisation assumption leaking into the copy.) The button stays "Fill prices" with no count: the live count on it was wrong however it was computed, and the final `PppFillResult.filled` is the number worth reporting.

**`PPP_PROGRESS` carries `{done, total}` and drives a progress bar.** While a fill runs, the summary line is replaced by a `<progress>` plus a `12/39` count, and the two icon buttons (disabled anyway) are hidden so the bar gets the whole row.

Both numbers are trustworthy only because of things established elsewhere in this section, so don't move them:

- `total` is `plan.length`, which is **exact** — every price row is in the DOM before the walk starts, so there is nothing left to discover mid-fill. Back when the table was assumed to virtualise, no honest denominator existed, and that is why this label went through "Stop — N filled" (wrong) and then "Filling &lt;market&gt;…" (no count at all) before landing here.
- `done` is broadcast **after** a write commits, never before. Reporting it up front is what made the old count lag by one and read as stalled.

The panel seeds `{done: 0, total: fillable}` from its own scan in `startFill()` so the bar has a denominator on the first frame, then the walk's own `onProgress(0, total)` confirms it before any row is touched.

**Gotcha — the `unreachable` branch replaces the whole panel, so it is gated on `!result`.** A single failed `tabs.sendMessage` used to blank a finished fill's summary and show "reload this page" instead — the rescan that runs right after a fill is exactly such a message, and it only has to fail once.

**Gotcha — `[debug-id="save-button"]` is the `<console-button>` wrapper, not the button.** The interactive element, and the one carrying `disabled`, is the `<button>` nested inside it. Targeting the wrapper fails _silently and completely_: `isButtonDisabled()` reads no `disabled` so the enabled-wait passes instantly, and the click lands on a non-interactive element, so every row times out waiting for a popup that never closes. `findOpenPriceEditor()` therefore drills to `saveHost.querySelector(BUTTON)` before falling back to the host. The same shape applies to Cancel and Close.

Openness is `isPriceEditorOpen()` — `isConnected` **and** the `visible` class, because Angular leaves the pane element in the DOM between opens, so `isConnected` alone is always true after the first edit.

The walk bails after `CONSECUTIVE_FAILURE_LIMIT` (3) consecutive failures rather than grinding through 150 rows that aren't working, and reports how far it got. The input takes a bare number — the currency is a suffix span and the input's `aria-label`, not part of the value.

`matchPriceTarget()` tries the **longest** matching country name first (so "Dominican Republic" doesn't lose to "Dominica", and "Papua New Guinea" doesn't lose to "Guinea"), then falls back to a currency code. A currency used by exactly one country resolves that country exactly; a shared one (EUR, XOF, XCD) returns the **mean** PPP across its members with `approximate: true`, which the panel renders as a `≈` badge. Don't silently drop that flag — pricing twenty economies off one average is a real caveat.

**Gotcha:** `setPriceInputValue()` uses the same `execCommand('insertText')` route as `setReplyText()`, for the same reason — Angular ignores a plain property assignment. It additionally falls back to `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` rather than `input.value = …`: Angular overrides `value` on the element _instance_, so the prototype setter is the one that writes through. It deliberately does _not_ blur — the editor popup would close before the value is committed.

**The side panel's rendered visibility can't be verified in this sandbox.** Playwright does not expose it as a page target — `ctx.pages()` never lists `sidepanel.html`, even though `sidePanel.open()` resolves. What _is_ checkable is the API state (`getOptions({})` and `getOptions({tabId})`), so verify that and confirm the actual show/hide by hand in a real profile.

**Verified in a real Chromium**, against replicas of the real row _and_ popup markup above (both captured from a logged-in console) injected into `https://play.google.com/console/about/`, which matches the content-script pattern with no session needed: row detection and match counts with a header row and an unknown market present, market names read from the region cell, conversion output, the `overwriteFilled: false` skip path, the full fill walk committing through the Save button, a deliberately slow-to-enable Save button, decoy inputs elsewhere on the page, close-on-outside-click (and staying open on an inside click), live storage watch from the options page, and the popup button's enabled/disabled states.

**Gotcha — the replica must match the real table, and getting that wrong cost several rounds of wrong fixes.** Earlier harnesses modelled a virtualised grid (first recreating row nodes each render, then recycling a fixed pool) and gated the edit control on hover. All of that was fiction, and each version certified a different wrong walk as correct. `verify20.mjs` is the honest one: all 39 rows in the DOM permanently, 26 of them off screen at rest, the editor opening from a plain click anywhere in the price cell, and one editor pane that takes a beat to close. It asserts per-market that each row got its own price exactly once, that `scrollTop` never moved, and that no click ever landed on an edit icon.

The same harness covers the preview columns: rows seeded with existing prices in several number formats (`INR 650.00`, `IDR 75.000`, `VND 129,000`) render the right "was …" and percentage, and the base-currency toggle re-expresses the list in USD.

**Still unverified:** the timing constants against a real Angular build. If filling stops early with "Play Console’s price editor didn’t respond as expected", the three editor timeouts are the first things to raise.

### Config is `chrome.storage`-backed, shared between content scripts and the options page

Modules under `utils/` define storage schemas via `@wxt-dev/storage`'s `storage.defineItem` (imported explicitly, not via WXT's `#imports` auto-import, so they stay usable from plain unit tests):

- `utils/apps.ts` — `sync:appMappings`: array of `{label, slug}`. `resolveAppSlug()` tries exact label match, then substring match (preserving the original `.includes()`-style fuzzy behavior), then falls back to auto-slugifying the raw label. No mapping is pre-seeded on install.
- `utils/shortcuts.ts` — the six key-combo items (`sync:quickReplyShortcut`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`, `sync:nextReviewPageShortcut`, `sync:prevReviewPageShortcut`) all share the `KeyShortcut` type and are declared through a local `defineShortcut(key, fallback)` helper, plus `sync:parseReviewModifier` (modifiers only, default Alt) and `sync:autoTranslateReply` (boolean, default `true`). Modifier matching is **exact** on every flag — a deliberate tightening vs. the original hardcoded checks, necessary so distinct configured combos don't collide; `matchesKeyShortcut()` and `matchesParseReviewModifier()` both delegate to one private `matchesModifiers()` so the key and mouse paths can't drift apart.
- `utils/canned-replies.ts` — `sync:cannedReplies`: array of `{id, label, content}` (see "Canned reply templates" above).
- `utils/ppp.ts` — `sync:pppSettings`: `{baseCountry, rounding, overwriteFilled}` (see "PPP pricing" above).
- `utils/bookmarks.ts` — `sync:pageBookmarks` (see "Saved page shortcuts" below).

**Gotcha — never match a letter shortcut on `e.key` alone.** On macOS, Option is a compose key: Option+P reports `e.key === 'π'`, not `'p'`. Shift+K reports `'K'`, not `'k'`. A shipped Alt+P default was completely dead on macOS for exactly this reason (that shortcut has since been removed, but the hazard applies to every letter combo a user can record). `matchesKey()` therefore matches the **physical** key via `e.code` (`KeyP` → `p`, `Digit1` → `1`) as well as a case-insensitive `e.key`, and `shortcutKeyOf()` — which `ShortcutRecorder.vue` uses instead of `e.key` — persists that physical key so a recorded shortcut is portable rather than layout-specific. The `e.key` arm is kept so shortcuts recorded before this normalisation (storing a literal `'π'`) keep working. Known gap: `e.code` is US-layout-relative, so a Cyrillic layout matches the key where `p` sits on a US board — the same tradeoff Chrome's own `commands` API makes. The shipped defaults dodge this by accident — arrow keys don't compose, and Cmd/Ctrl aren't compose modifiers — but any Alt+letter combo a user records would hit it.

**Gotcha — Playwright cannot reproduce this, and will happily false-pass.** `page.keyboard.press('Alt+p')` synthesises `key: 'p'` regardless of host OS, so a browser check of a letter shortcut passes on a Mac where the real thing is broken. This is how the dead Alt+P shipped past a green end-to-end run. To exercise the real values, dispatch the event yourself with the composed character: `new KeyboardEvent('keydown', { key: 'π', code: 'KeyP', altKey: true })`. The unit tests in `utils/shortcuts.test.ts` cover all four variants (composed, plain, uppercase, wrong physical key) and are the cheaper guard.

All items live in `chrome.storage.sync` (not `.local`) so settings roam with the user's Chrome profile across devices. `utils/apps.ts`'s app mapping list and `utils/canned-replies.ts`'s template list are the items with meaningful size — `chrome.storage.sync` caps each item at 8KB, so the editable-list sections' shared `persist()` catches a quota-exceeded write and surfaces it in the status line instead of silently failing.

Content scripts load the current value on init _and_ call `.watch(...)` on the storage item so options-page edits apply live without a page reload — don't reintroduce a load-once pattern here. All four feature modules do this through `utils/watch.ts`'s `watchValue(ctx, item)`, which loads, watches, registers the `ctx.onInvalidated` unwatch, and returns a **getter** — callers write `shortcut()` at use time so they can't accidentally close over a stale value.

### One-time local→sync storage migration

These settings originally lived in `chrome.storage.local` (per-device); `utils/migration.ts`'s `migrateLocalSettingsToSync()` copies any pre-existing `local:*` value over to its `sync:*` counterpart, run once from `entrypoints/background.ts`'s top-level `defineBackground(() => ...)` body (not gated behind an `onInstalled` listener) so it fires whenever the service worker wakes — cheap and idempotent, since it only writes when the `sync:` key is still unset. It deliberately never overwrites a `sync:` value once _any_ device has migrated it in, and never deletes the old `local:` value (harmless leftover, cheap insurance against a migration bug losing data). This code — and the legacy `local:*` key literals in it — can be deleted once enough time has passed that no user is expected to still be upgrading from a pre-sync version.

The storage items added since (`sync:cannedReplies`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`, `sync:pppSettings`) are deliberately **not** in this migration — they never existed under `local:*`, so there's nothing to copy.

### Shared Play Console URL matcher

`utils/console-url.ts` exports `CONSOLE_URL_MATCH_PATTERN` (`https://play.google.com/console/*`) and `isConsoleUrl()`. It's the single source of truth for "is this a Play Console page" — used by the content script's `matches`, the background script's icon logic, and the popup's guidance-vs-bookmark-control check. Don't hardcode the pattern or a second URL check elsewhere.

### Background script keeps the toolbar icon in sync

`entrypoints/background.ts` sets the per-tab toolbar icon via `browser.action.setIcon({tabId, path})`: colored (`/icons/*.png`) when `isConsoleUrl(tab.url)`, grayscale (`/icons/gray/*.png`, generated from the colored set) otherwise — grayscale is also `action.default_icon` in `wxt.config.ts`, so new tabs start gray before any listener fires. It listens on `tabs.onUpdated` and `tabs.onActivated`, plus a one-time `tabs.query({})` sweep on startup for tabs already open.

**Gotcha:** `tab.url` is only populated when the extension has host permission for that tab's _current_ URL. Declaring `https://play.google.com/console/*` only via `content_scripts.matches` was _not_ enough to reveal it to `tabs.onUpdated`/`tabs.query` in testing — `tab.url` came back `undefined` for every tab, console pages included, so the icon logic silently never fired. Fixed by also adding `host_permissions: [CONSOLE_URL_MATCH_PATTERN]` in `wxt.config.ts`. If you add other tab/URL-reading logic, don't assume `content_scripts.matches` alone grants it.

### Popup

`entrypoints/popup/` (Vue, same `@wxt-dev/module-vue` setup as options). On mount it queries the active tab (`browser.tabs.query({active: true, currentWindow: true})`) and sets `isConsoleUrl(tab.url)`. The header row (title + icon-only Options/Documentation buttons — `browser.runtime.openOptionsPage()` and a link to `pcu.visnalize.com`) is always visible, regardless of context, since the extension's utilities span Google Play Console as a whole and not just the review section. Below the header, it branches on `isConsoleUrl`: off Play Console it shows a short generic guidance message (mentioning saved shortcuts if any exist); on Play Console it shows the PPP pricing control described below, then the bookmark-this-page control. A "By Visnalize" credit footer is always shown.

### Popup ↔ pricing content script messaging

`utils/messages.ts` is the shared contract (`PPP_STATUS`, `PPP_OPEN`, the `PppStatus` shape). It exists because a keyboard shortcut is invisible — nothing told the user the PPP panel existed, or that it only does anything on a price editor. So the popup asks the page.

On mount, if the tab is a Play Console page, the popup `tabs.sendMessage`s `PPP_STATUS`; `pricing.content` replies with the scanned/matched row counts (via `panel.ts`'s `scanPrices()`, which is `planPrices()` without needing a base price), the formatted shortcut, and whether the panel is already open. The popup then renders one of three states: a **button** when `matched > 0`, a **hint naming where to find a price editor** when it's 0, and — if `sendMessage` rejects — "reload this page", which is the honest answer for a tab that was already open when the extension was installed or reloaded.

**Gotcha:** the content script's `onMessage` listener returns `true` only for messages it actually handles. Returning `true` unconditionally holds the reply channel open for every unrelated message on the page and hangs the sender's promise.

No new permission is needed — `tabs.sendMessage` to a tab already covered by `host_permissions` is enough, and the popup never calls `scripting`.

### Saved page shortcuts (popup bookmarks)

`utils/bookmarks.ts` defines `sync:pageBookmarks` (array of `{id, label, url}`, via `@wxt-dev/storage`) — deliberately named "bookmarks" in code to avoid colliding with `utils/shortcuts.ts`'s unrelated keyboard-shortcut config, even though the popup UI labels this feature "Shortcuts". `createPageBookmark()` mints an id with `crypto.randomUUID()`.

The popup (`entrypoints/popup/App.vue`) is the only surface for this feature — there's no options-page equivalent. While on a Play Console page, it shows a "Bookmark this page" control (pre-filled with the tab's title) that appends a `{id, label, url}` entry; if the current tab's URL is already saved, it shows a "saved as a shortcut" hint instead of the button. The saved list itself renders regardless of `isConsoleUrl`, so it's the same "quick access from anywhere" list whether the popup was opened on a Play Console page or not — entries are plain `<a target="_blank">` links (no `tabs` API call needed to navigate) plus a remove button. No separate host permission is needed since bookmarking is only offered on pages the extension already has `host_permissions` for. A "Clear all" control next to the "Shortcuts" heading wipes the whole list at once — gated behind a plain `window.confirm()` (the popup has no modal component of its own, and this is the only destructive bulk action in the UI, so a browser-native confirm is enough).

### Icons

UI icons (popup buttons/links, options-page remove/add/reset buttons) come from `@lucide/vue` (the non-deprecated successor to `lucide-vue-next` — don't reinstall the old package), imported as individual named components (e.g. `import { Trash2 } from '@lucide/vue'`) rather than any global icon registration.

### Extension-page styling: Tailwind + daisyUI, shared via `assets/ui.css`

The popup and options pages share one stylesheet, `assets/ui.css`: Tailwind v4 supplies the utilities, [daisyUI](https://daisyui.com) 5 the component classes (`btn`, `input`, `textarea`, `table`, `checkbox`, `label`, `alert`, `kbd`, `link`) and the token palette. It's wired up by `@tailwindcss/vite`, added to `wxt.config.ts`'s `vite.plugins` — there is no `tailwind.config.js`, since v4 is configured from CSS. Both pages' hand-written CSS (~370 lines of duplicated icon buttons, inputs, and a retyped `#a33`/`#2e7d32`/`#ccc` palette) was replaced by this.

Each page's `style.css` stays the entry that `index.html` links and `main.ts` imports; it now just `@import`s the shared sheet and adds whatever is genuinely page-specific (only the popup has anything: Chrome sizes a popup from its content, so `body { width }` can't live on an element inside the Vue tree).

- **The content script deliberately does not use any of this.** `entrypoints/reviews.content/style.css` stays plain hand-written CSS, because Tailwind's preflight would leak resets into Play Console's own page. Don't `@import` `assets/ui.css` from a content script.
- **Source scanning is opt-in.** `ui.css` uses `@import 'tailwindcss' source(none)` and each importing entrypoint declares `@source './'` for its own directory. Automatic detection would scan the whole repo and emit _both_ pages' CSS into each bundle (measured: 43.8 KB per page, vs 31 KB popup / 41 KB options scoped). A new entrypoint that imports `ui.css` needs its own `@source` line or none of its classes will be emitted — the failure mode is an unstyled page, not a build error.
- **Theme overrides go in the plain `:root` block in `ui.css`.** daisyUI emits its default theme under `:where(:root)`, which has zero specificity, so a normal `:root` block retints it without redefining the whole theme (no `@plugin "daisyui/theme"` block needed). Only four colors are overridden, and three of them are an accessibility fix rather than taste: daisyUI's light-theme `success`/`error` sit at oklch 76%/70% lightness, so 14px "Saved" or 12px "Clear all" on white lands near 2:1–3:1 contrast, below WCAG AA. The values used are the ones the old hand-written CSS had (`#2e7d32`, plus a darkened `#b3261e`), which clear 4.5:1. If you add a semantic color used as small text, check its contrast before trusting the default.
- **The shared `@layer components` block is for what's used in three or more places** — currently `.page-section`, `.section-title`, `.save-status`, `.remove-btn`. One-off arrangements stay as inline utilities in the component. `.remove-btn` replaced an older `td button[aria-label^='Remove']` attribute-prefix selector in the options CSS; a new editable-list section applies the class explicitly rather than relying on its `aria-label` wording.

**Gotcha:** class order in a `:class` binding does _not_ decide which daisyUI modifier wins — stylesheet order does. `btn-outline btn-success` rendered as a _solid_ green button because daisyUI emits the color modifier after the style modifier. If a variant doesn't look like the class list implies, check the generated CSS rather than reordering the attribute.

**Gotcha:** VS Code's built-in CSS language service flags `@plugin`, `@source`, and `@apply` as unknown at-rules. `.vscode/settings.json` sets `css.lint.unknownAtRules: "ignore"` — the warnings are cosmetic, not a real error.

### Options page (Vue)

`entrypoints/options/` uses `@wxt-dev/module-vue` (declared in `wxt.config.ts`'s `modules`). `App.vue` composes three independent sections:

- `AppMappingsSection.vue` — editable table of app label→slug rows.
- `CannedRepliesSection.vue` — editable table of canned-reply label/content rows (each row's content is a `<textarea>` since templates are multi-line), plus a hint listing the supported placeholders.
- `ShortcutsSection.vue` — the seven key-combo shortcut rows, rendered with `v-for` over a `keyShortcutRows` table built by a local `makeShortcutRow(label, item, fallback)` factory, each row using the reusable `ShortcutRecorder.vue` (click to record real keydown, Esc cancels). Plus checkboxes for the parse-review modifier(s) (blocked from saving an all-unchecked state, since that would silently disable the feature) and the auto-translate toggle.

`autosave.ts` holds the two composables the sections share:

- `useSaveStatus()` — the `status` ref plus `flashSaved()`/`showError()`; used by all three sections.
- `useEditableList({item, sanitize, quotaMessage})` — the whole editable-table behavior the two list sections had duplicated line-for-line: load rows on mount (`load()`), debounced autosave on edit, immediate save on row removal, focus the new row's first input via `setFirstInputRef`, and the storage-quota error path. A section supplies only its row shape, its `sanitize` (trim + drop incomplete rows) and its quota message. A third list section should reuse this rather than re-deriving the pattern.

### Testing

`vitest.config.ts` uses the `WxtVitest` plugin (`wxt/testing/vitest-plugin`), which polyfills `browser`/`chrome` with an in-memory `@webext-core/fake-browser` implementation — this is what makes `storage.defineItem()` work in tests with no manual mocking. Reset state between tests with `fakeBrowser.reset()` (from `wxt/testing/fake-browser`), not by manually clearing storage values.

`fake-browser` doesn't model per-tab icon state or real popup/tab-focus semantics, so the background script's icon logic and the popup's active-tab branching aren't covered by vitest — they need a real Chromium loading `.output/chrome-mv3` to verify (see the `run` skill).

**No `jsdom`/`happy-dom` dependency exists in this project** — vitest runs in the plain `node` environment, so `document`/`Element` aren't available in tests. `utils/dom.test.ts` (and `utils/shortcuts.test.ts`'s `KeyboardEvent`/`MouseEvent` fakes before it) work around this with small duck-typed fake objects (`fakeContainer`/`fakeButton`/`fakeScope`, cast `as Element`/`as HTMLElement`) rather than real DOM nodes, and `getActiveAppLabel()`'s read of the global `document` is tested via `vi.stubGlobal('document', ...)`. Don't add a real DOM dependency for a test — follow this fake-object pattern instead. Note the tests import the selectors from `utils/selectors.ts` rather than re-typing the literals, so a selector change can't leave a test asserting against a stale one.

`utils/ppp.test.ts` additionally asserts things about the **generated** dataset, not just the code reading it — that US is exactly `1` (every conversion divides by the base factor), that every country has a positive factor and a 3-letter currency, and that every name round-trips through `matchPriceTarget()` to a real entry. Those are the tests that catch a bad `pnpm ppp:refresh`, so keep them when touching that file.

The parts of `utils/dom.ts` that need layout or live focus (`getReviewContainers`, `flashHighlight`/`flashPublished`, `findReplyFieldIn`, `setReplyText`, `getPriceRows`, `setPriceInputValue`) and the feature modules themselves have no unit tests: they depend on `getBoundingClientRect`/`scrollIntoView`/real focus-and-keydown-through-Angular, none of which a fake object can meaningfully stand in for — verify those in a real loaded Chromium instead.
