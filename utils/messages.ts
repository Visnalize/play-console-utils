// The contract between the PPP side panel and the pricing content script.
//
// The side panel is an extension page, so it can't touch the Play Console DOM
// at all — every read and write goes through these messages. Prices are always
// computed content-script side and sent over as plain data, so the two never
// disagree about what a row should say.
//
// Settings ride along on each request rather than being watched separately in
// the content script. That's deliberate: the panel writes a setting and scans
// immediately, and a storage watch on the other side hasn't necessarily fired
// yet, so the scan would silently use the previous value.

import type { PppSettings } from './ppp';

export const PPP_SCAN = 'ppp:scan';
export const PPP_FILL = 'ppp:fill';
export const PPP_ABORT = 'ppp:abort';
/** Broadcast from the content script during a fill; nothing replies to it. */
export const PPP_PROGRESS = 'ppp:progress';

export type PricingMessage =
  // `settings` is optional: the popup only wants the row count, to decide
  // whether to enable its button, and counting needs no pricing config.
  | { type: typeof PPP_SCAN; basePrice: number; settings?: PppSettings }
  | { type: typeof PPP_FILL; basePrice: number; settings: PppSettings }
  | { type: typeof PPP_ABORT }
  // Drives the panel's progress bar. `done` counts rows actually committed
  // and is only ever sent *after* a write lands, so it can't run ahead of
  // reality; `total` is the length of the plan, which is exact because every
  // price row is in the DOM before the walk starts.
  | { type: typeof PPP_PROGRESS; done: number; total: number };

/**
 * One row of the preview, already converted and formatted.
 *
 * Every figure comes over pre-computed, in both the market's own currency and
 * the base country's. The panel's "show in base currency" toggle is therefore
 * a pure view switch — it re-renders without re-scanning, and the two sides
 * can't disagree about what a row is worth.
 */
export interface PppPreviewRow {
  market: string;
  /**
   * The currency the row is *billed* in, which is not always the market's own
   * — Play Console bills Cambodia in USD and much of non-euro Europe in EUR.
   */
  currency: string;
  /** The proposed price, in the market's own currency. */
  price: string;
  /** The same proposed price expressed in the base country's currency. */
  priceBase: string;
  /** What Play Console shows today; null when the row has no price yet. */
  current: string | null;
  currentBase: string | null;
  /** Percent difference from `current` to `price`; null with no `current`. */
  change: number | null;
  /** PPP averaged across every country sharing the currency (EUR, XOF…). */
  approximate: boolean;
  /**
   * True when reaching the billing currency needed a market exchange rate,
   * i.e. the row isn't billed in the market's own currency. Such a price
   * drifts with the currency, unlike a pure-PPP one.
   */
  converted: boolean;
  /** Has a price already and settings say don't overwrite. */
  skipped: boolean;
}

export interface PppScanResult {
  /** Price rows currently in the DOM. The table virtualises, so this grows. */
  scanned: number;
  rows: PppPreviewRow[];
}

export interface PppFillResult {
  filled: number;
  /** True when the walk bailed after repeated editor failures. */
  gaveUp: boolean;
  /** True when the side panel asked it to stop. */
  aborted: boolean;
}
