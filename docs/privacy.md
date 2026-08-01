---
title: Privacy Policy
description: How Play Console Utils handles your data - no analytics, no network requests, no review content or clipboard data ever leaving your device. Settings are stored only in Chrome's own sync storage.
---

# Privacy Policy for Play Console Utils

**Last updated: 2026-08-01**

Play Console Utils ("the extension") is a browser extension that adds productivity shortcuts to the Google Play Console: a configurable quick-reply key combo, a configurable modifier+click action that copies structured review data to your clipboard, a configurable shortcut that inserts one of your saved canned reply templates into the reply box, configurable shortcuts to jump between reviews, a side panel that fills Play Console's price editors at purchasing-power parity, an options page for configuring all of the above plus per-app label mappings, and a toolbar icon/popup that indicate whether the current tab is a Play Console page.

This policy explains what data the extension accesses and, most importantly, what it does not do with it.

## Summary

- The extension does not collect, transmit, sell, or share any data — it has no server, no analytics, and makes no network requests of any kind itself.
- Review content and clipboard data never leave your device.
- Your extension settings (shortcuts, app mappings) are stored via Chrome's built-in `storage.sync` API so they follow you across your signed-in devices. That syncing is performed by Chrome/Google, not by the extension contacting anything — see "Extension settings" below for what that means.

## What the extension accesses

**Page content on Google Play Console.** The extension's content script only runs on pages matching `https://play.google.com/console/*`. When you use the "parse review" shortcut, it reads text already visible on the page — the review author's name, date, the review text, the reviewer's avatar image URL, and the currently selected app's name — and copies it as JSON to your clipboard. When you use the canned-reply-template shortcut, it reads the same review author's name, date, and app name (not the review text or avatar) to fill placeholders in the template you pick, then writes the filled-in text into the reply box you're already typing in. When you use the review-navigation shortcuts (including the ones that page through the review list), if you're leaving a review with an unpublished, still-focused draft reply, the extension clicks that review's own Discard button on your behalf (the same action available to you manually) rather than leaving the draft behind; no draft text is read, copied, or sent anywhere for this. Paging through the review list clicks Play Console's own next/previous-page button on your behalf — the same button you'd otherwise click yourself. All of this happens only when you deliberately trigger one of these shortcuts; nothing is read, copied, written, or clicked automatically or in the background.

**PPP pricing.** When you open the pricing side panel, the extension reads the visible label of each price row on the page (a country name and/or currency code) to work out which market each row is for, and reads the price each row currently shows so the panel can display it next to the proposed one and work out the percentage difference. Both stay inside your browser and are used only to render that panel. When you click "Fill prices" it writes the converted prices in through Play Console's own per-row editor — the same control you would otherwise click by hand. Nothing is submitted or saved on your behalf: Play Console's own Save/Apply button is still yours to press, so you can review or undo everything first. The base price you type is used only for that calculation and is never stored. When you open the extension's popup on a Play Console page, it asks the page how many price rows it contains — a count only, never their values — so it can tell you whether the pricing side panel is usable there. The conversion tables (World Bank indicators `PA.NUS.PPP` for purchasing power parity and `PA.NUS.FCRF` for exchange rates, the latter needed because Play Console bills some markets in a currency that is not their own) are bundled inside the extension and read from disk — no pricing data, product data, or anything else about your apps is sent anywhere, and no network request is made at any point.

**Quick-reply translation (optional, on by default).** When you trigger the quick-reply shortcut, the extension reads the text you've typed in the reply box and, if the review is shown in a different language, translates it to match using Chrome's built-in on-device translation feature before publishing. This runs entirely on your device via your browser — no reply text, review text, or any other data is sent to the extension developer or any third-party server. You can turn this off in the options page.

**Extension settings.** Your configured keyboard shortcuts, auto-translate toggle, parse-review modifier key, PPP pricing preferences (base country, rounding style, custom factor, and the overwrite toggle), app label→slug mappings, canned reply templates (labels and template text you write yourself), and any page shortcuts you choose to bookmark from the popup (a label and the page's URL) are saved using the browser's built-in `storage` API, specifically `chrome.storage.sync`. If you're signed into Chrome with sync enabled, Chrome syncs this data through your Google account so it's available on your other signed-in devices — this is standard Chrome Sync infrastructure, not a server operated by the extension or its developer, and the data involved is limited to your shortcut key combos, PPP pricing preferences, app label/slug mappings, canned reply templates, and bookmarked page labels/URLs (never review content, prices, or clipboard data). If you're not signed into Chrome sync, this data simply stays on your device, the same as before.

## What the extension does not do

- It does not make any network requests itself — there is no remote server this extension talks to.
- It does not use analytics, crash reporting, or telemetry of any kind.
- It does not collect or transmit review content, clipboard data, browsing history, or any other personal data — the only thing that may leave your device is your own settings, and only via Chrome's own sync feature, described above.
- It does not share data with third parties.

## Permissions

The extension requests the `storage` permission, used exclusively to save your own configuration (shortcuts, PPP pricing preferences, app mappings, and canned reply templates) via `chrome.storage.sync` (see "Extension settings" above). On Chrome it also requests `sidePanel`, which only allows the extension to show its own page in the browser's side panel; it grants no access to your data or to any website. It also declares host permission for `https://play.google.com/console/*`, which is required for its content scripts (quick-reply, parse-review, canned-reply picker, review navigation, and the PPP price filling) to run there, and for a background script to read the URL of tabs on that host so it can show the colored toolbar icon only there (grayscale everywhere else). No URL or tab information for any other site is ever read.

## Data retention and deletion

Your settings live in Chrome's extension storage (synced or local, depending on your Chrome sign-in state) and are removed when you remove the extension. You can also clear them via your browser's settings without uninstalling. Clipboard contents are managed entirely by your operating system, not by the extension.

## Changes to this policy

If this extension's data practices change in the future, this document will be updated accordingly, and the "Last updated" date above will reflect the change.

## Contact

Questions about this policy can be directed to: <hey@visnalize.com>
