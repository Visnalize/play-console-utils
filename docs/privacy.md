---
title: Privacy Policy
description: How Play Console Utils handles your data - no analytics, no network requests, no review content or clipboard data ever leaving your device. Settings are stored only in Chrome's own sync storage.
---

# Privacy Policy for Play Console Utils

**Last updated: 2026-08-01**

Play Console Utils ("the extension") is a browser extension that adds productivity shortcuts to the Google Play Console. This policy explains what data it accesses and, most importantly, what it does not do with it.

## Summary

- The extension does not collect, transmit, sell, or share any data — it has no server, no analytics, and makes no network requests of any kind itself.
- Review content, prices, and clipboard data never leave your device.
- Your settings are stored via Chrome's built-in `storage.sync` API so they follow you across your signed-in devices. That syncing is performed by Chrome/Google, not by the extension contacting anything — see "Extension settings" below.

## What the extension accesses

Everything below happens only on pages matching `https://play.google.com/console/*`, and only when you deliberately trigger it. Nothing is read, copied, written, or clicked automatically or in the background.

**Page content on Google Play Console.**

- _Parse review_ reads text already visible on the page — the review author's name, date, the review text, the reviewer's avatar image URL, and the selected app's name — and copies it as JSON to your clipboard.
- _Canned reply templates_ read the author's name, date, and app name (not the review text or avatar) to fill placeholders in the template you pick, then write the result into the reply box you're already typing in.
- _Review navigation_ clicks Play Console's own next/previous-page button on your behalf. If you leave a review with an unpublished, still-focused draft, it clicks that review's own Discard button rather than stranding the draft; the draft text itself is never read, copied, or sent anywhere.

**PPP pricing.** Opening the pricing side panel reads each price row's visible label (a country name and/or currency code) to work out which market it is for, plus the price the row currently shows so the panel can display it beside the proposed one. Both stay inside your browser and are used only to render that panel; the base price you type is used only for the calculation and is never stored. "Fill prices" writes through Play Console's own per-row editor — the same control you would click by hand — and saves nothing on your behalf, so its Save/Apply button is still yours to press. The extension's popup asks the page only how many price rows it contains, never their values, so it can tell you whether the panel is usable there.

The conversion tables (World Bank indicators `PA.NUS.PPP` for purchasing power parity and `PA.NUS.FCRF` for exchange rates, the latter needed because Play Console bills some markets in a currency that is not their own) are bundled inside the extension and read from disk. Nothing about your pricing, products, or apps is sent anywhere, and no network request is made at any point.

**Quick-reply translation (optional, on by default).** When you trigger the quick-reply shortcut, the extension reads the text you've typed in the reply box and, if the review is shown in a different language, translates it to match before publishing — entirely on your device, using Chrome's built-in translation feature. No reply text, review text, or other data is sent to the extension developer or any third-party server. You can turn this off in the options page.

**Extension settings.** Your keyboard shortcuts, auto-translate toggle, parse-review modifier key, PPP pricing preferences (base country, rounding style, custom factor, overwrite toggle), app label→slug mappings, canned reply templates, and any page bookmarks you save from the popup (a label and the page's URL) are stored with `chrome.storage.sync`. If you're signed into Chrome with sync enabled, Chrome syncs that data through your Google account so it's available on your other devices — standard Chrome Sync infrastructure, not a server operated by the extension or its developer. It never includes review content, prices, or clipboard data. If you're not signed into Chrome sync, it simply stays on your device.

## What the extension does not do

- It does not make any network requests itself — there is no remote server this extension talks to.
- It does not use analytics, crash reporting, or telemetry of any kind.
- It does not collect or transmit review content, clipboard data, browsing history, or any other personal data — the only thing that may leave your device is your own settings, and only via Chrome's own sync feature, described above.
- It does not share data with third parties.

## Permissions

- `storage` — used exclusively to save your own configuration, via `chrome.storage.sync` (see "Extension settings" above).
- `sidePanel` (Chrome only) — allows the extension to show its own page in the browser's side panel. It grants no access to your data or to any website.
- Host permission for `https://play.google.com/console/*` — required for the content scripts to run there, and for a background script to read the URL of tabs on that host so the toolbar icon is colored only on Play Console (grayscale everywhere else). No URL or tab information for any other site is ever read.

## Data retention and deletion

Your settings live in Chrome's extension storage (synced or local, depending on your Chrome sign-in state) and are removed when you remove the extension. You can also clear them via your browser's settings without uninstalling. Clipboard contents are managed entirely by your operating system, not by the extension.

## Changes to this policy

If this extension's data practices change in the future, this document will be updated accordingly, and the "Last updated" date above will reflect the change.

## Contact

Questions about this policy can be directed to: <hey@visnalize.com>
