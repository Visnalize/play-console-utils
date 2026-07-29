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

### File naming

Module filenames are **one word where possible, two at most** (`dom.ts`, `selectors.ts`, `navigation.ts`, `picker.ts`, `quick-reply.ts`). Vue components keep `PascalCase.vue`. When a name wants a third word, that's the signal the module is doing too much or sits in the wrong directory — split it or move it rather than growing the filename.

### One content-script entrypoint, four feature modules

`entrypoints/reviews.content/index.ts` is the only registered content script (directory-entrypoint form, matches `https://play.google.com/console/*`). Its `main(ctx)` wires up four independent feature modules that live alongside it, then logs once that the shortcuts are active (the per-module logs it used to print were pure noise):

- `quick-reply.ts` — listens for a configurable key combo while a reply textarea/contenteditable is focused; if auto-translate is enabled, translates the reply to match the review's language first (see below), then finds and clicks the publish button (`PUBLISH_LABELS`), flashing it green via `flashPublished()`.
- `parse-review.ts` — listens for a configurable modifier+click on review text, scrapes author/date/avatar/content from the enclosing review container, resolves the app slug, copies JSON to the clipboard, shows a toast, and briefly highlights the review container (`flashHighlight()`).
- `picker.ts` — listens for a configurable key combo while a reply field is focused, opens a floating picker of saved templates, fills placeholders, and inserts the result (see "Canned reply templates" below).
- `navigation.ts` — listens for configurable next/previous-review and next/previous-review-_page_ key combos, scrolls to and focuses the corresponding review container's reply field (item navigation) or clicks the paginator's prev/next button (page navigation), and discards any unpublished draft left behind on the review you're leaving either way (see "Review navigation" below).

Feature modules contain no selectors and no raw DOM traversal — both live in `utils/selectors.ts` and `utils/dom.ts` (see the next section).

`toast.ts` wraps the [toastify-js](https://github.com/apvarun/toastify-js) dependency (zero runtime deps of its own) behind a small `showToast(message, { sticky? })` helper shared across modules — `{ sticky: true }` returns a handle whose `.hide()` dismisses it manually (used by quick-reply's translation-in-progress toast), otherwise it auto-dismisses after 2.5s. Don't hand-roll a new `document.createElement('div')` toast in any feature module — route through this helper instead.

`style.css` is the one stylesheet the content script injects (highlight flash, publish flash, picker panel — all `pcu-`-prefixed). `index.ts` imports it alongside `toastify-js/src/toastify.css`; there's no second content-script stylesheet to add rules to.

All four register listeners through `ctx.addEventListener(...)` / `ctx.onInvalidated(...)` (from the `ContentScriptContext` WXT passes into `main`), not raw `window`/`document` listeners — this auto-cleans-up if the extension reloads while the tab stays open, instead of the old manual `window.__xLoaded` guard pattern.

**Gotcha:** `ContentScriptContext` must be imported as a type from `'wxt/utils/content-script-context'`. The auto-imported global of the same name is value-only (`declare const ContentScriptContext: typeof ...`) and will fail type-checking (`TS2749`) if used directly as a parameter type annotation.

### Selectors in one file, DOM access in one file

Play Console's DOM is a third-party contract that can change without notice, so it's reachable from exactly two modules:

- `utils/selectors.ts` — **every** selector string and button-label matcher: `REVIEW_CONTAINER`, `REVIEW_AUTHOR`, `REVIEW_DATE`, `REVIEW_TEXT`, `REVIEW_AVATAR`, `ACTIVE_APP_BUTTON`, `ORIGINAL_LANGUAGE_HEADER`, `REPLY_FIELD`, `BUTTON`, plus the localized (English/Spanish) label lists `PUBLISH_LABELS`, `DISCARD_LABELS`, `NEXT_PAGE_LABELS`, `PREV_PAGE_LABELS`. No behavior — constants only. When Play Console re-skins the reviews page, this is the file to fix.
- `utils/dom.ts` — the only module that queries, mutates, or animates page elements: review lookups (`getReviewContainers()`, `getReviewContainerOf(el)`, `getReviewAuthor()`, `getReviewDate()`, `getReviewAvatarUrl()`, `getReviewText()`, `getActiveAppLabel()`, plus the `UNKNOWN_AUTHOR`/`UNKNOWN_DATE` fallbacks), reply-field access (`isReplyField()`, `getFocusedReplyField()`, `findReplyFieldIn()`, `getReplyText()`/`setReplyText()`), button lookups (`findButtonByText(scope, labels)`, `isButtonDisabled(el)`), and the flash animations (`flashHighlight()`, `flashPublished()`, which add the `pcu-highlight`/`pcu-publish-flash` classes styled in `entrypoints/reviews.content/style.css`).

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

`picker.ts` opens on a configurable shortcut (`sync:cannedReplyShortcut`, default Ctrl/⌘+K) while a reply field is focused. It builds placeholder data from the focused field's review-container ancestor via `utils/dom.ts`'s `getReviewAuthor()`/`getReviewDate()` (shared with `parse-review.ts`, so both use one implementation and one set of fallback strings) plus `getActiveAppLabel()` (the raw app-selector display name — **not** `resolveAppSlug()`'s slug, which is a different, URL-safe concept meant for JSON export, not reply text). The picker itself is a hand-rolled `position: fixed` panel (no Vue in the content-script bundle), anchored to the focused field's `getBoundingClientRect()` and flipped above it if there isn't room below. While open, a capture-phase `window` keydown listener intercepts only `Escape` (close) and digits `1`-`9` (select the matching row, first `NUMBERED_ROWS` templates only — templates beyond that are still listed and clickable, just unnumbered); every other key passes through untouched so normal typing and Play Console's own bindings are unaffected. Selecting a template **fully replaces** the reply field's current content (via `setReplyText`) — it doesn't insert at cursor or auto-publish.

### Review navigation

`navigation.ts` covers two distinct axes, each with its own pair of configurable shortcuts:

**Item navigation** (`sync:nextReviewShortcut`/`sync:prevReviewShortcut`, default Alt+ArrowDown/Alt+ArrowUp) moves between reviews on the current page. On each keypress it freshly re-queries the review containers via `getReviewContainers()` (never cached — Angular may re-render the list between presses) and determines the "current" review three ways, in order of precision: if a reply field is currently focused, its enclosing review container is current; else the container it last navigated to (`lastNavigatedContainer`), if that node is still in the freshly-queried list; else the last container whose top is at or above a small threshold (`CURRENT_THRESHOLD_PX`, so a review scrolled slightly past the viewport top still counts as current). It then discards any unpublished draft on the review being left (see below), scrolls to and highlights the target review (`scrollIntoView({behavior:'smooth'})` + `flashHighlight()`), and focuses the target's reply field (`findReplyFieldIn(target)?.focus({ preventScroll: true })`, so quick-reply/picker/typing can act immediately without an extra click — `preventScroll: true` avoids the browser's default focus-scroll fighting with the smooth `scrollIntoView` call). At either end of the list it shows a toast instead of navigating further, and skips all of the above.

**Gotcha:** an already-replied review has no reply field to focus, and the focus-first rule above then reads the review you just _left_ as the current one — so forward navigation kept re-targeting the same replied review while backward navigation still worked. Two things fix it together: `lastNavigatedContainer` (the middle tier above, also covering the window where the smooth scroll hasn't moved the viewport yet), and blurring the stale field whenever `document.activeElement` isn't the target's reply field after the focus attempt. Page navigation clears `lastNavigatedContainer` before clicking, since Angular may recycle container nodes for the next page's reviews.

**Page navigation** (`sync:nextReviewPageShortcut`/`sync:prevReviewPageShortcut`, default Alt+ArrowRight/Alt+ArrowLeft) clicks Play Console's own paginator prev/next button instead — found via `findButtonByText(document, NEXT_PAGE_LABELS | PREV_PAGE_LABELS)`, matching `"next page"`/`"previous page"`/the Spanish equivalents against text-or-aria-label. The paginator's prev/next controls are a `material-button` custom element, not a native `<button>` (confirmed against real Play Console — see the `utils/dom.ts` gotcha above), so `isButtonDisabled()` is used instead of a raw `.disabled` read for the boundary check (no more pages) before deciding whether to click or show a toast. It does **not** attempt to scroll to or focus anything on the new page — the page swap is Angular-driven and async, so there's no reliable moment to act once the new reviews have rendered (unlike the synchronous DOM read/scroll used for item navigation).

Both axes share `discardUnpublishedDraft()`: it only acts if the review being left has its reply field currently focused _and_ that field has non-empty text (an unfocused or already-empty reply field is left alone), clicking a `findButtonByText(container, DISCARD_LABELS)`-matched Discard/Cancel button (English/Spanish). This exists so navigating through the list — or across pages — doesn't leave a trail of abandoned half-typed replies behind.

All four shortcuts are dispatched from one `keydown` listener over a `bindings` table (`{shortcut, run}` pairs) rather than an if/else-if chain, so adding a fifth navigation shortcut is a table entry.

**Gotcha:** page navigation's default (Alt+ArrowLeft/Right) collides with Chrome's own browser-back/browser-forward accelerator on Windows/Linux (not on Mac, where that's Cmd+Left/Right instead) — pressing it while nothing intercepts first could navigate the whole tab away from Play Console instead of paginating. `e.preventDefault()` is called before this is knowable, so it should suppress the browser's handling in most cases, but this is unconfirmed against a real Chrome build on Windows. If it doesn't, the shortcut is reconfigurable from the options page.

**Unverified in a real browser:** whether Play Console's review list virtualizes/recycles DOM nodes for offscreen rows (which could interact oddly with an in-progress unpublished draft if you navigate far away and back); whether review-container document order always matches visual top-to-bottom order; whether Play Console's actual Discard/Cancel button text matches the English/Spanish substrings in `DISCARD_LABELS`; and the Alt+Left/Right collision noted above. (The paginator's aria-labels and `material-button` tag name _are_ confirmed against real Play Console.)

### Config is `chrome.storage`-backed, shared between content scripts and the options page

Modules under `utils/` define storage schemas via `@wxt-dev/storage`'s `storage.defineItem` (imported explicitly, not via WXT's `#imports` auto-import, so they stay usable from plain unit tests):

- `utils/apps.ts` — `sync:appMappings`: array of `{label, slug}`. `resolveAppSlug()` tries exact label match, then substring match (preserving the original `.includes()`-style fuzzy behavior), then falls back to auto-slugifying the raw label. No mapping is pre-seeded on install.
- `utils/shortcuts.ts` — the six key-combo items (`sync:quickReplyShortcut`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`, `sync:nextReviewPageShortcut`, `sync:prevReviewPageShortcut`) all share the `KeyShortcut` type and are declared through a local `defineShortcut(key, fallback)` helper, plus `sync:parseReviewModifier` (modifiers only, default Alt) and `sync:autoTranslateReply` (boolean, default `true`). Modifier matching is **exact** on every flag — a deliberate tightening vs. the original hardcoded checks, necessary so distinct configured combos don't collide; `matchesKeyShortcut()` and `matchesParseReviewModifier()` both delegate to one private `matchesModifiers()` so the key and mouse paths can't drift apart.
- `utils/canned-replies.ts` — `sync:cannedReplies`: array of `{id, label, content}` (see "Canned reply templates" above).
- `utils/bookmarks.ts` — `sync:pageBookmarks` (see "Saved page shortcuts" below).

All items live in `chrome.storage.sync` (not `.local`) so settings roam with the user's Chrome profile across devices. `utils/apps.ts`'s app mapping list and `utils/canned-replies.ts`'s template list are the items with meaningful size — `chrome.storage.sync` caps each item at 8KB, so the editable-list sections' shared `persist()` catches a quota-exceeded write and surfaces it in the status line instead of silently failing.

Content scripts load the current value on init _and_ call `.watch(...)` on the storage item so options-page edits apply live without a page reload — don't reintroduce a load-once pattern here. All four feature modules do this through `utils/watch.ts`'s `watchValue(ctx, item)`, which loads, watches, registers the `ctx.onInvalidated` unwatch, and returns a **getter** — callers write `shortcut()` at use time so they can't accidentally close over a stale value.

### One-time local→sync storage migration

These settings originally lived in `chrome.storage.local` (per-device); `utils/migration.ts`'s `migrateLocalSettingsToSync()` copies any pre-existing `local:*` value over to its `sync:*` counterpart, run once from `entrypoints/background.ts`'s top-level `defineBackground(() => ...)` body (not gated behind an `onInstalled` listener) so it fires whenever the service worker wakes — cheap and idempotent, since it only writes when the `sync:` key is still unset. It deliberately never overwrites a `sync:` value once _any_ device has migrated it in, and never deletes the old `local:` value (harmless leftover, cheap insurance against a migration bug losing data). This code — and the legacy `local:*` key literals in it — can be deleted once enough time has passed that no user is expected to still be upgrading from a pre-sync version.

The 4 storage items added for canned replies and review navigation (`sync:cannedReplies`, `sync:cannedReplyShortcut`, `sync:nextReviewShortcut`, `sync:prevReviewShortcut`) are deliberately **not** in this migration — they never existed under `local:*`, so there's nothing to copy.

### Shared Play Console URL matcher

`utils/console-url.ts` exports `CONSOLE_URL_MATCH_PATTERN` (`https://play.google.com/console/*`) and `isConsoleUrl()`. It's the single source of truth for "is this a Play Console page" — used by the content script's `matches`, the background script's icon logic, and the popup's guidance-vs-bookmark-control check. Don't hardcode the pattern or a second URL check elsewhere.

### Background script keeps the toolbar icon in sync

`entrypoints/background.ts` sets the per-tab toolbar icon via `browser.action.setIcon({tabId, path})`: colored (`/icons/*.png`) when `isConsoleUrl(tab.url)`, grayscale (`/icons/gray/*.png`, generated from the colored set) otherwise — grayscale is also `action.default_icon` in `wxt.config.ts`, so new tabs start gray before any listener fires. It listens on `tabs.onUpdated` and `tabs.onActivated`, plus a one-time `tabs.query({})` sweep on startup for tabs already open.

**Gotcha:** `tab.url` is only populated when the extension has host permission for that tab's _current_ URL. Declaring `https://play.google.com/console/*` only via `content_scripts.matches` was _not_ enough to reveal it to `tabs.onUpdated`/`tabs.query` in testing — `tab.url` came back `undefined` for every tab, console pages included, so the icon logic silently never fired. Fixed by also adding `host_permissions: [CONSOLE_URL_MATCH_PATTERN]` in `wxt.config.ts`. If you add other tab/URL-reading logic, don't assume `content_scripts.matches` alone grants it.

### Popup

`entrypoints/popup/` (Vue, same `@wxt-dev/module-vue` setup as options). On mount it queries the active tab (`browser.tabs.query({active: true, currentWindow: true})`) and sets `isConsoleUrl(tab.url)`. The header row (title + icon-only Options/Documentation buttons — `browser.runtime.openOptionsPage()` and a link to `pcu.visnalize.com`) is always visible, regardless of context, since the extension's utilities span Google Play Console as a whole and not just the review section. Below the header, it branches on `isConsoleUrl`: off Play Console it shows a short generic guidance message (mentioning saved shortcuts if any exist); on Play Console it shows the bookmark-this-page control described below. A "By Visnalize" credit footer is always shown.

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
- `ShortcutsSection.vue` — the six key-combo shortcut rows, rendered with `v-for` over a `keyShortcutRows` table built by a local `makeShortcutRow(label, item, fallback)` factory, each row using the reusable `ShortcutRecorder.vue` (click to record real keydown, Esc cancels). Plus checkboxes for the parse-review modifier(s) (blocked from saving an all-unchecked state, since that would silently disable the feature) and the auto-translate toggle.

`autosave.ts` holds the two composables the sections share:

- `useSaveStatus()` — the `status` ref plus `flashSaved()`/`showError()`; used by all three sections.
- `useEditableList({item, sanitize, quotaMessage})` — the whole editable-table behavior the two list sections had duplicated line-for-line: load rows on mount (`load()`), debounced autosave on edit, immediate save on row removal, focus the new row's first input via `setFirstInputRef`, and the storage-quota error path. A section supplies only its row shape, its `sanitize` (trim + drop incomplete rows) and its quota message. A third list section should reuse this rather than re-deriving the pattern.

### Testing

`vitest.config.ts` uses the `WxtVitest` plugin (`wxt/testing/vitest-plugin`), which polyfills `browser`/`chrome` with an in-memory `@webext-core/fake-browser` implementation — this is what makes `storage.defineItem()` work in tests with no manual mocking. Reset state between tests with `fakeBrowser.reset()` (from `wxt/testing/fake-browser`), not by manually clearing storage values.

`fake-browser` doesn't model per-tab icon state or real popup/tab-focus semantics, so the background script's icon logic and the popup's active-tab branching aren't covered by vitest — they need a real Chromium loading `.output/chrome-mv3` to verify (see the `run` skill).

**No `jsdom`/`happy-dom` dependency exists in this project** — vitest runs in the plain `node` environment, so `document`/`Element` aren't available in tests. `utils/dom.test.ts` (and `utils/shortcuts.test.ts`'s `KeyboardEvent`/`MouseEvent` fakes before it) work around this with small duck-typed fake objects (`fakeContainer`/`fakeButton`/`fakeScope`, cast `as Element`/`as HTMLElement`) rather than real DOM nodes, and `getActiveAppLabel()`'s read of the global `document` is tested via `vi.stubGlobal('document', ...)`. Don't add a real DOM dependency for a test — follow this fake-object pattern instead. Note the tests import the selectors from `utils/selectors.ts` rather than re-typing the literals, so a selector change can't leave a test asserting against a stale one.

The parts of `utils/dom.ts` that need layout or live focus (`getReviewContainers`, `flashHighlight`/`flashPublished`, `findReplyFieldIn`, `setReplyText`) and the feature modules themselves have no unit tests: they depend on `getBoundingClientRect`/`scrollIntoView`/real focus-and-keydown-through-Angular, none of which a fake object can meaningfully stand in for — verify those in a real loaded Chromium instead.
