# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension (built with [WXT](https://wxt.dev)) that adds productivity shortcuts to the Google Play Console review section: a configurable quick-reply key combo (optionally auto-translating the reply to match the review's language before publishing), a configurable modifier+click "parse review" action that copies structured review JSON to the clipboard, a configurable shortcut that opens a floating picker of canned reply templates (with `{author}`/`{date}`/`{app}` placeholders filled in from the review), configurable shortcuts to jump to the next/previous review in the list, an options page for configuring all of the above plus per-app slug mappings, a background script that keeps the toolbar icon in sync with whether the active tab is a Play Console page, and a popup with quick links.

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
```

First-time setup on a fresh checkout may need `pnpm approve-builds` if pnpm blocks the `esbuild`/`spawn-sync` postinstall scripts — required for `esbuild`'s platform binary to be wired up.

## Architecture

### Manifest is generated, never hand-edited

There is no `manifest.json` in the repo. WXT generates it at build time from `wxt.config.ts` (top-level fields: name, description, permissions, icons, action) plus whatever each entrypoint declares (`content_scripts.matches` comes from `defineContentScript({ matches })`; `options_ui` is auto-detected from `entrypoints/options/`). `manifest.version` is deliberately _not_ set in `wxt.config.ts` — WXT falls back to `package.json`'s `version` field, which is the single source of truth (bumped directly, or via the release workflow from a pushed tag; see README's Releasing section). Don't add a manifest field in `wxt.config.ts` that an entrypoint already declares, or re-add an explicit `version`, — that causes duplication/drift.

### One content-script entrypoint, four feature modules

`entrypoints/reviews.content/index.ts` is the only registered content script (directory-entrypoint form, matches `https://play.google.com/console/*`). Its `main(ctx)` wires up four independent feature modules that live alongside it:

- `quick-reply.ts` — listens for a configurable key combo while a reply textarea/contenteditable is focused; if auto-translate is enabled, translates the reply to match the review's language first (see below), then finds and clicks the publish button (English/Spanish label variants), flashes it green.
- `parse-review.ts` — listens for a configurable modifier+click on review text, scrapes author/date/avatar/content from the closest `.review-container`, resolves the app slug, copies JSON to the clipboard, shows a toast, and briefly highlights the review container (`.quote-ext-highlight` animation in `toast.css`).
- `canned-reply-picker.ts` — listens for a configurable key combo while a reply field is focused, opens a floating picker of saved templates, fills placeholders, and inserts the result (see "Canned reply templates" below).
- `review-navigation.ts` — listens for configurable next/previous-review and next/previous-review-_page_ key combos, scrolls to and focuses the corresponding `.review-container`'s reply field (item navigation) or clicks the paginator's prev/next button (page navigation), and discards any unpublished draft left behind on the review you're leaving either way (see "Review navigation" below).

Three small shared modules exist purely to avoid duplicating logic that's now used by more than one of the four: `reply-field.ts` (`isReplyField()`, `getFocusedReplyField()`, `findReplyFieldIn(container)`, `getReplyText()`/`setReplyText()` — used by `quick-reply.ts`, `canned-reply-picker.ts`, and `review-navigation.ts`), `highlight.ts` (`flashHighlight()`, used by both `parse-review.ts` and `review-navigation.ts`), and `button-finder.ts` (`findButtonByText(scope, matches)`/`isButtonDisabled(el)`, used by `quick-reply.ts`'s publish-button lookup and `review-navigation.ts`'s discard-button and paginator-button lookups).

**Gotcha:** not every clickable control in Play Console is a native `<button>` — the review-list paginator's prev/next controls are a `material-button` custom element (confirmed: an earlier version of `findButtonByText` that only queried `button` silently never found them, so page navigation did nothing). `findButtonByText`'s selector is `'button, material-button'`, and `isButtonDisabled()` checks the native `.disabled` property _and_ the `disabled`/`aria-disabled` attribute forms, since a custom element doesn't necessarily expose the IDL property the way `HTMLButtonElement` does. If another Play Console control turns out to use a different custom tag name, extend that selector rather than assuming `button` is enough.

`toast.ts` wraps the [toastify-js](https://github.com/apvarun/toastify-js) dependency (zero runtime deps of its own) behind a small `showToast(message, { sticky? })` helper shared across modules — `{ sticky: true }` returns a handle whose `.hide()` dismisses it manually (used by quick-reply's translation-in-progress toast), otherwise it auto-dismisses after 2.5s. Its CSS (`toastify-js/src/toastify.css`) is imported once in `index.ts` alongside `toast.css`. Don't hand-roll a new `document.createElement('div')` toast in any feature module — route through this helper instead.

All four register listeners through `ctx.addEventListener(...)` / `ctx.onInvalidated(...)` (from the `ContentScriptContext` WXT passes into `main`), not raw `window`/`document` listeners — this auto-cleans-up if the extension reloads while the tab stays open, instead of the old manual `window.__xLoaded` guard pattern.

**Gotcha:** `ContentScriptContext` must be imported as a type from `'wxt/utils/content-script-context'`. The auto-imported global of the same name is value-only (`declare const ContentScriptContext: typeof ...`) and will fail type-checking (`TS2749`) if used directly as a parameter type annotation.

### Quick-reply auto-translation

When `local:autoTranslateReply` is on (default), `quick-reply.ts` reads Play Console's own "Translated from X -" banner (`[debug-id="original-language-area-header"]`, inside the same `.review-container` as the reply box) to find the review's original language — `utils/review-language.ts`'s `extractTargetLanguageCode()` parses that banner text and maps the language name to a BCP-47 code via `utils/language-names.ts`. **The banner only renders when the review's language differs from the console's display language**, so its absence is treated as "already matches, skip translation," not a detection failure.

`utils/translation.ts` wraps Chrome's on-device `Translator`/`LanguageDetector` globals (stable since Chrome 138 for many language pairs, not yet in TS's `lib.dom.d.ts` — hence the local ambient `declare global` there). It detects the reply's own language first (to skip a no-op translation when the reply is already in the target language) and no-ops safely — falling back to publishing the reply as typed — when the APIs are unsupported or a language pair is unavailable. No network requests are involved; translation runs entirely on-device.

**Gotcha:** after programmatically overwriting the reply box's content, the publish button's `disabled` state does _not_ flip synchronously — Play Console's Angular change detection needs a tick to react to the dispatched `input`/`change` events. Checking `publishBtn.disabled` immediately after the mutation reads the stale (disabled) value and silently no-ops (no thrown error, so nothing shows up in the console). `quick-reply.ts`'s `waitForEnabledPublishButton()` polls (50ms interval, 1s timeout) instead of checking once, and only after a translation actually happened — the untranslated path still checks the button immediately, unchanged from before. If the poll still times out, a toast + `console.warn` tell the user to click Publish manually rather than failing silently again.

**Unverified in a real browser:** the assumption that the reply textarea/contenteditable lives inside the same `.review-container` as the language banner. Confirm against a live foreign-language review. `canned-reply-picker.ts` now leans on this same assumption to reach `.author-display-name`/`.last-update-time` for placeholder text — it's a reused risk, not a new one.

### Canned reply templates

`utils/canned-replies.ts` defines `sync:cannedReplies` (array of `{id, label, content}`, `id` minted via `crypto.randomUUID()` like `page-bookmarks.ts`) and `fillCannedReplyPlaceholders(template, data)`, which does a simple `{word}`-token replace. Unknown/mistyped placeholders (e.g. `{Author}`, `{foo}`) are left **literal**, not blanked — a visibly wrong token is a better failure mode than silently vanishing text.

`canned-reply-picker.ts` opens on a configurable shortcut (`sync:cannedReplyShortcut`, default Ctrl/⌘+K) while a reply field is focused. It builds placeholder data from the focused field's `.review-container` ancestor via `utils/review-fields.ts` (`extractAuthorFromContainer`/`extractDateFromContainer` — the same selectors and fallback strings `parse-review.ts` uses, factored out so both share one implementation) plus `getActiveAppLabel()` (the raw `.active-app-button` display name — **not** `resolveAppSlug()`'s slug, which is a different, URL-safe concept meant for JSON export, not reply text). The picker itself is a hand-rolled `position: fixed` panel (no Vue in the content-script bundle), anchored to the focused field's `getBoundingClientRect()` and flipped above it if there isn't room below. While open, a capture-phase `window` keydown listener intercepts only `Escape` (close) and digits `1`-`9` (select the matching row, first 9 templates only — templates beyond 9 are still listed and clickable, just unnumbered); every other key passes through untouched so normal typing and Play Console's own bindings are unaffected. Selecting a template **fully replaces** the reply field's current content (via `setReplyText`) — it doesn't insert at cursor or auto-publish.

### Review navigation

`review-navigation.ts` covers two distinct axes, each with its own pair of configurable shortcuts:

**Item navigation** (`sync:nextReviewShortcut`/`sync:prevReviewShortcut`, default Alt+ArrowDown/Alt+ArrowUp) moves between reviews on the current page. On each keypress it freshly re-queries `document.querySelectorAll('.review-container')` (never cached — Angular may re-render the list between presses) and determines the "current" review two ways, preferring the more precise one: if a reply field is currently focused, its `.closest('.review-container')` is current; otherwise it falls back to the last container whose top is at or above a small threshold (`CURRENT_THRESHOLD_PX`, so a review scrolled slightly past the viewport top still counts as current). It then discards any unpublished draft on the review being left (see below), scrolls to and highlights the target review (`scrollIntoView({behavior:'smooth'})` + `flashHighlight()`), and focuses the target's reply field (`findReplyFieldIn(target)?.focus({ preventScroll: true })`, so quick-reply/canned-reply-picker/typing can act immediately without an extra click — `preventScroll: true` avoids the browser's default focus-scroll fighting with the smooth `scrollIntoView` call). At either end of the list it shows a toast instead of navigating further, and skips all of the above.

**Page navigation** (`sync:nextReviewPageShortcut`/`sync:prevReviewPageShortcut`, default Alt+ArrowRight/Alt+ArrowLeft) clicks Play Console's own paginator prev/next button instead — found via `findButtonByText(document, [...])` matching `"next page"`/`"previous page"`/the Spanish equivalents against text-or-aria-label. The paginator's prev/next controls are a `material-button` custom element, not a native `<button>` (confirmed against real Play Console — see the `button-finder.ts` gotcha above), so `isButtonDisabled()` is used instead of a raw `.disabled` read for the boundary check (no more pages) before deciding whether to click or show a toast. It does **not** attempt to scroll to or focus anything on the new page — the page swap is Angular-driven and async, so there's no reliable moment to act once the new reviews have rendered (unlike the synchronous DOM read/scroll used for item navigation).

Both axes share `discardUnpublishedDraft()`: it only acts if the review being left has its reply field currently focused _and_ that field has non-empty text (an unfocused or already-empty reply field is left alone), clicking a `findButtonByText`-matched Discard/Cancel button (English/Spanish). This exists so navigating through the list — or across pages — doesn't leave a trail of abandoned half-typed replies behind.

**Gotcha:** page navigation's default (Alt+ArrowLeft/Right) collides with Chrome's own browser-back/browser-forward accelerator on Windows/Linux (not on Mac, where that's Cmd+Left/Right instead) — pressing it while nothing intercepts first could navigate the whole tab away from Play Console instead of paginating. `e.preventDefault()` is called before this is knowable, so it should suppress the browser's handling in most cases, but this is unconfirmed against a real Chrome build on Windows. If it doesn't, the shortcut is reconfigurable from the options page.

**Unverified in a real browser:** whether Play Console's review list virtualizes/recycles DOM nodes for offscreen rows (which could interact oddly with an in-progress unpublished draft if you navigate far away and back); whether `.review-container` document order always matches visual top-to-bottom order; whether Play Console's actual Discard/Cancel button text matches the English/Spanish substrings `findDiscardButton` looks for; and the Alt+Left/Right collision noted above. (The paginator's aria-labels and `material-button` tag name _are_ confirmed against real Play Console.)

### Config is `chrome.storage`-backed, shared between content scripts and the options page

Two modules under `utils/` define storage schemas via `@wxt-dev/storage`'s `storage.defineItem` (imported explicitly, not via WXT's `#imports` auto-import, so they stay usable from plain unit tests):

- `utils/app-mapping.ts` — `sync:appMappings`: array of `{label, slug}`. `resolveAppSlug()` tries exact label match, then substring match (preserving the original `.includes()`-style fuzzy behavior), then falls back to auto-slugifying the raw label. No mapping is pre-seeded on install.
- `utils/shortcuts.ts` — `sync:quickReplyShortcut`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, and `sync:prevReviewShortcut` (each modifiers + a trigger key, sharing the `KeyShortcut` type — renamed from `QuickReplyShortcut` once it started backing four unrelated shortcuts, not just quick-reply's), `sync:parseReviewModifier` (modifiers only, default Alt), and `sync:autoTranslateReply` (boolean, default `true`). Modifier matching is **exact** on every flag — a deliberate tightening vs. the original hardcoded checks, necessary so distinct configured combos don't collide. The matcher itself is `matchesKeyShortcut()` (renamed from `matchesQuickReplyShortcut()` for the same reason as the type) — its logic was already generic, so all four key-combo shortcuts reuse the one function.
- `utils/canned-replies.ts` — `sync:cannedReplies`: array of `{id, label, content}` (see "Canned reply templates" above).

All items live in `chrome.storage.sync` (not `.local`) so settings roam with the user's Chrome profile across devices. `utils/app-mapping.ts`'s app mapping list and `utils/canned-replies.ts`'s template list are the items with meaningful size — `chrome.storage.sync` caps each item at 8KB, so `AppMappingsSection.vue`'s and `CannedRepliesSection.vue`'s `persist()` both catch a quota-exceeded write and surface it in the status line instead of silently failing.

Content scripts load the current value on init _and_ call `.watch(...)` on the storage item so options-page edits apply live without a page reload — don't reintroduce a load-once pattern here.

### One-time local→sync storage migration

These settings originally lived in `chrome.storage.local` (per-device); `utils/storage-migration.ts`'s `migrateLocalSettingsToSync()` copies any pre-existing `local:*` value over to its `sync:*` counterpart, run once from `entrypoints/background.ts`'s top-level `defineBackground(() => ...)` body (not gated behind an `onInstalled` listener) so it fires whenever the service worker wakes — cheap and idempotent, since it only writes when the `sync:` key is still unset. It deliberately never overwrites a `sync:` value once _any_ device has migrated it in, and never deletes the old `local:` value (harmless leftover, cheap insurance against a migration bug losing data). This code — and the legacy `local:*` key literals in it — can be deleted once enough time has passed that no user is expected to still be upgrading from a pre-sync version.

The 4 storage items added for canned replies and review navigation (`sync:cannedReplies`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`) are deliberately **not** in this migration — they never existed under `local:*`, so there's nothing to copy.

### Shared Play Console URL matcher

`utils/console-url.ts` exports `CONSOLE_URL_MATCH_PATTERN` (`https://play.google.com/console/*`) and `isConsoleUrl()`. It's the single source of truth for "is this a Play Console page" — used by the content script's `matches`, the background script's icon logic, and the popup's guidance-vs-bookmark-control check. Don't hardcode the pattern or a second URL check elsewhere.

### Background script keeps the toolbar icon in sync

`entrypoints/background.ts` sets the per-tab toolbar icon via `browser.action.setIcon({tabId, path})`: colored (`/icons/*.png`) when `isConsoleUrl(tab.url)`, grayscale (`/icons/gray/*.png`, generated from the colored set) otherwise — grayscale is also `action.default_icon` in `wxt.config.ts`, so new tabs start gray before any listener fires. It listens on `tabs.onUpdated` and `tabs.onActivated`, plus a one-time `tabs.query({})` sweep on startup for tabs already open.

**Gotcha:** `tab.url` is only populated when the extension has host permission for that tab's _current_ URL. Declaring `https://play.google.com/console/*` only via `content_scripts.matches` was _not_ enough to reveal it to `tabs.onUpdated`/`tabs.query` in testing — `tab.url` came back `undefined` for every tab, console pages included, so the icon logic silently never fired. Fixed by also adding `host_permissions: [CONSOLE_URL_MATCH_PATTERN]` in `wxt.config.ts`. If you add other tab/URL-reading logic, don't assume `content_scripts.matches` alone grants it.

### Popup

`entrypoints/popup/` (Vue, same `@wxt-dev/module-vue` setup as options). On mount it queries the active tab (`browser.tabs.query({active: true, currentWindow: true})`) and sets `isConsoleUrl(tab.url)`. The header row (title + icon-only Options/Documentation buttons — `browser.runtime.openOptionsPage()` and a link to `pcu.visnalize.com`) is always visible, regardless of context, since the extension's utilities span Google Play Console as a whole and not just the review section. Below the header, it branches on `isConsoleUrl`: off Play Console it shows a short generic guidance message (mentioning saved shortcuts if any exist); on Play Console it shows the bookmark-this-page control described below. A "By Visnalize" credit footer is always shown.

### Saved page shortcuts (popup bookmarks)

`utils/page-bookmarks.ts` defines `sync:pageBookmarks` (array of `{id, label, url}`, via `@wxt-dev/storage`) — deliberately named "page bookmarks" in code to avoid colliding with `utils/shortcuts.ts`'s unrelated keyboard-shortcut config, even though the popup UI labels this feature "Shortcuts". `createPageBookmark()` mints an id with `crypto.randomUUID()`.

The popup (`entrypoints/popup/App.vue`) is the only surface for this feature — there's no options-page equivalent. While on a Play Console page, it shows a "Bookmark this page" control (pre-filled with the tab's title) that appends a `{id, label, url}` entry; if the current tab's URL is already saved, it shows a "saved as a shortcut" hint instead of the button. The saved list itself renders regardless of `isConsoleUrl`, so it's the same "quick access from anywhere" list whether the popup was opened on a Play Console page or not — entries are plain `<a target="_blank">` links (no `tabs` API call needed to navigate) plus a remove button. No separate host permission is needed since bookmarking is only offered on pages the extension already has `host_permissions` for. A "Clear all" control next to the "Shortcuts" heading wipes the whole list at once — gated behind a plain `window.confirm()` (the popup has no modal component of its own, and this is the only destructive bulk action in the UI, so a browser-native confirm is enough).

### Icons

UI icons (popup buttons/links, options-page remove/add/reset buttons) come from `@lucide/vue` (the non-deprecated successor to `lucide-vue-next` — don't reinstall the old package), imported as individual named components (e.g. `import { Trash2 } from '@lucide/vue'`) rather than any global icon registration.

### Options page (Vue)

`entrypoints/options/` uses `@wxt-dev/module-vue` (declared in `wxt.config.ts`'s `modules`). `App.vue` composes three independent sections:

- `AppMappingsSection.vue` — editable table of app label→slug rows, debounced autosave.
- `CannedRepliesSection.vue` — editable table of canned-reply label/content rows (structurally the same list-with-debounced-autosave-and-quota-handling pattern as `AppMappingsSection.vue`, but each row's content is a `<textarea>` since templates are multi-line), plus a hint listing the supported placeholders.
- `ShortcutsSection.vue` — four key-combo shortcut rows (quick-reply, insert-canned-reply, next-review, previous-review) via the reusable `ShortcutRecorder.vue` (click to record real keydown, Esc cancels), plus checkboxes for the parse-review modifier(s) (blocked from saving an all-unchecked state, since that would silently disable the feature). The four key-combo rows share a local `makeShortcutRow()` factory (returns a `reactive({ current, onChange })` per shortcut) instead of repeating the same load/save boilerplate four times.

### Testing

`vitest.config.ts` uses the `WxtVitest` plugin (`wxt/testing/vitest-plugin`), which polyfills `browser`/`chrome` with an in-memory `@webext-core/fake-browser` implementation — this is what makes `storage.defineItem()` work in tests with no manual mocking. Reset state between tests with `fakeBrowser.reset()` (from `wxt/testing/fake-browser`), not by manually clearing storage values.

`fake-browser` doesn't model per-tab icon state or real popup/tab-focus semantics, so the background script's icon logic and the popup's active-tab branching aren't covered by vitest — they need a real Chromium loading `.output/chrome-mv3` to verify (see the `run` skill).

**No `jsdom`/`happy-dom` dependency exists in this project** — vitest runs in the plain `node` environment, so `document`/`Element` aren't available in tests. `utils/review-fields.test.ts` (and `utils/shortcuts.test.ts`'s `KeyboardEvent`/`MouseEvent` fakes before it) work around this with small duck-typed fake objects (e.g. `{ querySelector: (sel) => ... }` cast `as Element`) rather than real DOM nodes, and `getActiveAppLabel()`'s read of the global `document` is tested via `vi.stubGlobal('document', ...)`. Don't add a real DOM dependency for a test — follow this fake-object pattern instead. `canned-reply-picker.ts` and `review-navigation.ts` have no tests at all for the same reason `quick-reply.ts`/`parse-review.ts` don't: they depend on `getBoundingClientRect`/`scrollIntoView`/real focus-and-keydown-through-Angular, none of which a fake object can meaningfully stand in for — verify those in a real loaded Chromium instead.
