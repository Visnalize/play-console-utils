# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension (built with [WXT](https://wxt.dev)) that adds productivity shortcuts to the Google Play Console review section: a configurable quick-reply key combo, a configurable modifier+click "parse review" action that copies structured review JSON to the clipboard, an options page for configuring both plus per-app slug mappings, a background script that keeps the toolbar icon in sync with whether the active tab is a Play Console page, and a popup with quick links.

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

There is no `manifest.json` in the repo. WXT generates it at build time from `wxt.config.ts` (top-level fields: name, description, permissions, icons, action) plus whatever each entrypoint declares (`content_scripts.matches` comes from `defineContentScript({ matches })`; `options_ui` is auto-detected from `entrypoints/options/`). `manifest.version` is deliberately *not* set in `wxt.config.ts` — WXT falls back to `package.json`'s `version` field, which is the single source of truth (bumped directly, or via the release workflow from a pushed tag; see README's Releasing section). Don't add a manifest field in `wxt.config.ts` that an entrypoint already declares, or re-add an explicit `version`, — that causes duplication/drift.

### One content-script entrypoint, two feature modules

`entrypoints/console.content/index.ts` is the only registered content script (directory-entrypoint form, matches `https://play.google.com/console/*`). Its `main(ctx)` wires up two independent feature modules that live alongside it:

- `quick-reply.ts` — listens for a configurable key combo while a reply textarea/contenteditable is focused, finds and clicks the publish button (English/Spanish label variants), flashes it green.
- `parse-review.ts` — listens for a configurable modifier+click on review text, scrapes author/date/avatar/content from the closest `.review-container`, resolves the app slug, copies JSON to the clipboard, shows a toast, and briefly highlights the review container (`.quote-ext-highlight` animation in `toast.css`).

Both register listeners through `ctx.addEventListener(...)` / `ctx.onInvalidated(...)` (from the `ContentScriptContext` WXT passes into `main`), not raw `window`/`document` listeners — this auto-cleans-up if the extension reloads while the tab stays open, instead of the old manual `window.__xLoaded` guard pattern.

**Gotcha:** `ContentScriptContext` must be imported as a type from `'wxt/utils/content-script-context'`. The auto-imported global of the same name is value-only (`declare const ContentScriptContext: typeof ...`) and will fail type-checking (`TS2749`) if used directly as a parameter type annotation.

### Config is `chrome.storage`-backed, shared between content scripts and the options page

Two modules under `utils/` define storage schemas via `@wxt-dev/storage`'s `storage.defineItem` (imported explicitly, not via WXT's `#imports` auto-import, so they stay usable from plain unit tests):

- `utils/app-mapping.ts` — `local:appMappings`: array of `{label, slug}`. `resolveAppSlug()` tries exact label match, then substring match (preserving the original `.includes()`-style fuzzy behavior), then falls back to auto-slugifying the raw label. No mapping is pre-seeded on install.
- `utils/shortcuts.ts` — `local:quickReplyShortcut` (modifiers + a trigger key, default Ctrl/⌘+Enter) and `local:parseReviewModifier` (modifiers only, default Alt). Matching is **exact** on every modifier flag — a deliberate tightening vs. the original hardcoded checks, necessary so distinct configured combos don't collide.

Content scripts load the current value on init _and_ call `.watch(...)` on the storage item so options-page edits apply live without a page reload — don't reintroduce a load-once pattern here.

### Shared Play Console URL matcher

`utils/console-url.ts` exports `CONSOLE_URL_MATCH_PATTERN` (`https://play.google.com/console/*`) and `isConsoleUrl()`. It's the single source of truth for "is this a Play Console page" — used by the content script's `matches`, the background script's icon logic, and the popup's guidance-vs-links check. Don't hardcode the pattern or a second URL check elsewhere.

### Background script keeps the toolbar icon in sync

`entrypoints/background.ts` sets the per-tab toolbar icon via `browser.action.setIcon({tabId, path})`: colored (`/icons/*.png`) when `isConsoleUrl(tab.url)`, grayscale (`/icons/gray/*.png`, generated from the colored set) otherwise — grayscale is also `action.default_icon` in `wxt.config.ts`, so new tabs start gray before any listener fires. It listens on `tabs.onUpdated` and `tabs.onActivated`, plus a one-time `tabs.query({})` sweep on startup for tabs already open.

**Gotcha:** `tab.url` is only populated when the extension has host permission for that tab's *current* URL. Declaring `https://play.google.com/console/*` only via `content_scripts.matches` was *not* enough to reveal it to `tabs.onUpdated`/`tabs.query` in testing — `tab.url` came back `undefined` for every tab, console pages included, so the icon logic silently never fired. Fixed by also adding `host_permissions: [CONSOLE_URL_MATCH_PATTERN]` in `wxt.config.ts`. If you add other tab/URL-reading logic, don't assume `content_scripts.matches` alone grants it.

### Popup

`entrypoints/popup/` (Vue, same `@wxt-dev/module-vue` setup as options). On mount it queries the active tab (`browser.tabs.query({active: true, currentWindow: true})`) and branches on `isConsoleUrl(tab.url)`: off Play Console it shows a short guidance message; on Play Console it shows an "Options" button (`browser.runtime.openOptionsPage()`), a docs link to `pcu.visnalize.com`, and a "By Visnalize" credit footer linking to `visnalize.com`.

### Options page (Vue)

`entrypoints/options/` uses `@wxt-dev/module-vue` (declared in `wxt.config.ts`'s `modules`). `App.vue` composes two independent sections:

- `AppMappingsSection.vue` — editable table of app label→slug rows, debounced autosave.
- `ShortcutsSection.vue` — quick-reply combo via the reusable `ShortcutRecorder.vue` (click to record real keydown, Esc cancels), plus checkboxes for the parse-review modifier(s) (blocked from saving an all-unchecked state, since that would silently disable the feature).

### Testing

`vitest.config.ts` uses the `WxtVitest` plugin (`wxt/testing/vitest-plugin`), which polyfills `browser`/`chrome` with an in-memory `@webext-core/fake-browser` implementation — this is what makes `storage.defineItem()` work in tests with no manual mocking. Reset state between tests with `fakeBrowser.reset()` (from `wxt/testing/fake-browser`), not by manually clearing storage values.

`fake-browser` doesn't model per-tab icon state or real popup/tab-focus semantics, so the background script's icon logic and the popup's active-tab branching aren't covered by vitest — they need a real Chromium loading `.output/chrome-mv3` to verify (see the `run` skill).
