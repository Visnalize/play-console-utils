import {
  clickLikeMouse,
  findOpenPriceEditor,
  findPriceRowByText,
  getPriceRows,
  hasPriceValue,
  isButtonDisabled,
  isPriceEditorOpen,
  pressKey,
  setPriceInputValue,
  waitFor,
  type PriceRow,
} from '@/utils/dom';
import {
  formatPrice,
  getPppCountry,
  matchPriceTarget,
  parsePriceValue,
  percentChange,
  quotePrice,
  toBaseCurrency,
  type PppSettings,
  type PriceTarget,
  type QuotedPrice,
} from '@/utils/ppp';
import type { PppCountry } from '@/utils/ppp-data';
import type { PppFillResult, PppScanResult } from '@/utils/messages';

// How long to wait for Play Console's editor popup to appear and to close.
const EDITOR_OPEN_TIMEOUT_MS = 2000;
const EDITOR_CLOSE_TIMEOUT_MS = 2000;
// Angular re-validates on input, so Save can be briefly disabled after a write.
const EDITOR_COMMIT_TIMEOUT_MS = 1000;
// If several rows in a row fail, the assumption behind the flow is wrong and
// grinding through the rest just wastes the user's time.
const CONSECUTIVE_FAILURE_LIMIT = 3;

/**
 * One row's worth of decision, carrying **no element reference**.
 *
 * The row is re-found by market name at the moment it's filled. Holding the
 * element instead is how an earlier version wrote one market's price into
 * another's editor: Play Console re-renders a row after its price changes, so
 * a reference captured when the plan was built can be a node the console has
 * since reused for something else.
 */
interface PlannedRow {
  /** The row's own region label — also how the row is found again. */
  market: string;
  /** The price cell's text at plan time, e.g. "INR 100.00". */
  valueText: string;
  target: PriceTarget;
  /** Already converted into the currency the row is billed in. */
  quoted: QuotedPrice;
  /** Already has a value, and settings say not to overwrite it. */
  skipped: boolean;
}

/**
 * Identifies the market a row prices. The region cell alone is the precise
 * signal; falling back to the row's price text lets a currency-only row
 * ("EUR 4.99") still resolve when the region name isn't one we know.
 */
function targetFor(row: PriceRow): PriceTarget | null {
  return (
    matchPriceTarget(row.text) ??
    matchPriceTarget(`${row.text} ${row.valueText}`)
  );
}

/**
 * Works out what each price row on the page should say. Rows naming no
 * country or currency are left out entirely, and so are rows billed in a
 * currency the dataset can't reach — see quotePrice().
 */
function planPrices(
  basePrice: number,
  settings: PppSettings,
): { planned: PlannedRow[]; scanned: number } {
  const base = getPppCountry(settings.baseCountry);
  const rows = getPriceRows();
  if (!base) return { planned: [], scanned: rows.length };

  const planned: PlannedRow[] = [];
  for (const priceRow of rows) {
    const target = targetFor(priceRow);
    if (!target) continue;

    // The currency the row is actually billed in, which is not always the
    // market's own: Play Console bills Cambodia and Angola in USD, and much
    // of non-euro Europe in EUR. Read it from the cell, never assume.
    const quoted = quotePrice(
      basePrice,
      base,
      target,
      currencyCodeIn(priceRow.valueText),
      settings,
    );
    if (!quoted || quoted.amount <= 0) continue;

    planned.push({
      market: priceRow.text,
      valueText: priceRow.valueText,
      target,
      quoted,
      skipped: !settings.overwriteFilled && hasPriceValue(priceRow),
    });
  }

  return { planned, scanned: rows.length };
}

/**
 * Counts, plus an already-converted preview when there's something to convert.
 * Callers that only need the count (the popup, deciding whether to enable its
 * button) can omit `settings` entirely.
 */
export function scanPrices(
  basePrice: number,
  settings?: PppSettings,
): PppScanResult {
  if (!settings) return { scanned: getPriceRows().length, rows: [] };

  const base = getPppCountry(settings.baseCountry);
  const { planned, scanned } = planPrices(basePrice, settings);
  return {
    scanned,
    rows: planned.map((item) => previewRow(item, base)),
  };
}

function previewRow(item: PlannedRow, base: PppCountry | undefined) {
  const { target, quoted } = item;
  // What the console shows today, so the panel can put the two side by side.
  // null (no digits in the cell) means unpriced, which is not the same as 0.
  // It's in the row's billing currency, same as the proposal — so the two are
  // directly comparable and the percentage is meaningful.
  const current = parsePriceValue(item.valueText);
  const inBase = (value: number) =>
    base
      ? formatPrice(
          toBaseCurrency(value, quoted.currency, base, target),
          base.decimals,
        )
      : '';

  return {
    // The row's own region label, not the matched target's name. A market
    // with no World Bank observation (Vatican City) resolves only by
    // currency, and target.name would then be the bare code — the panel
    // showed "EUR" where the console says "Vatican City". It also keeps the
    // list keys unique when several unmatched rows share a currency.
    market: item.market || target.name,
    currency: quoted.currency,
    price: formatPrice(quoted.amount, quoted.decimals),
    priceBase: inBase(quoted.amount),
    current: current === null ? null : formatPrice(current, quoted.decimals),
    currentBase: current === null ? null : inBase(current),
    change: current === null ? null : percentChange(current, quoted.amount),
    approximate: target.approximate,
    converted: quoted.converted,
    skipped: item.skipped,
  };
}

type FillOutcome = 'filled' | 'missing' | 'failed';

const CURRENCY_CODE = /\b[A-Z]{3}\b/;

/** e.g. "INR 650.00" -> "INR". Null when the text names no currency. */
function currencyCodeIn(text: string): string | null {
  return CURRENCY_CODE.exec(text)?.[0] ?? null;
}

/**
 * Dismisses a popup left open from a previous row.
 *
 * Play Console reuses one editor pane, so a popup that hasn't finished
 * closing is the popup `findOpenPriceEditor()` returns for the *next* row —
 * which then gets that row's price typed into the previous row's editor. The
 * currency check in `fillRow()` catches the consequence, but only by skipping
 * the market, so clearing it up front is what keeps the skip from happening.
 */
async function closeStrayEditor() {
  const stray = findOpenPriceEditor();
  if (!stray) return;
  pressKey(stray.input, 'Escape');
  await waitFor(() => !isPriceEditorOpen(stray.popup), EDITOR_CLOSE_TIMEOUT_MS);
}

/**
 * Writes one row's price.
 *
 * The price table has no input per row: the price is text, and editing means
 * clicking the row's edit affordance, which opens a popup carrying the actual
 * field. So each row is a click, a wait, a write and a commit — sequential by
 * nature, since only one popup opens at a time.
 */
async function fillRow(item: PlannedRow): Promise<FillOutcome> {
  const value = formatPrice(item.quoted.amount, item.quoted.decimals);

  // Found fresh, by name, every time — never held from the plan.
  const row = findPriceRowByText(item.market);
  if (!row) return 'missing';

  // A price surface that really is a plain form needs none of the dance.
  if (row.input) {
    setPriceInputValue(row.input, value);
    row.input.blur();
    return 'filled';
  }
  if (!row.edit) return 'missing';

  await closeStrayEditor();

  // Clicking the price cell is all it takes to open the editor.
  clickLikeMouse(row.edit);
  const editor = await waitFor(findOpenPriceEditor, EDITOR_OPEN_TIMEOUT_MS);
  if (!editor) return 'failed';

  // The editor is portalled to the end of <body>, so nothing structural ties
  // it to the row that opened it — if the click landed on a neighbour, this
  // is the last chance to notice before pricing the wrong market. Its
  // aria-label carries the currency; so does the row's own cell.
  // Compare against the currency the plan priced in, which is the row's
  // own billing currency — not the market's.
  const rowCurrency = item.quoted.currency;
  const editorCurrency = currencyCodeIn(
    editor.input.getAttribute('aria-label') ?? '',
  );
  if (rowCurrency && editorCurrency && rowCurrency !== editorCurrency) {
    pressKey(editor.input, 'Escape');
    return 'missing';
  }

  setPriceInputValue(editor.input, value);

  if (editor.save) {
    // Angular validates on input, so Save can still be disabled for a tick
    // after the write — clicking too early is a no-op that leaves the popup
    // open and desynchronises every row after it.
    await waitFor(
      () => !isButtonDisabled(editor.save!),
      EDITOR_COMMIT_TIMEOUT_MS,
    );
    editor.save.click();
  } else {
    pressKey(editor.input, 'Enter');
  }

  // Don't move on until the popup is gone, or the next row's click lands on
  // the overlay instead of the row.
  const closed = await waitFor(
    () => !isPriceEditorOpen(editor.popup),
    EDITOR_CLOSE_TIMEOUT_MS,
  );
  if (!closed) {
    pressKey(editor.input, 'Escape');
    return 'failed';
  }
  return 'filled';
}

interface WalkState {
  filled: number;
  /** Length of the plan — the progress bar's denominator. */
  total: number;
  consecutiveFailures: number;
  gaveUp: boolean;
}

/** Fills each item in order; returns the ones that didn't take. */
async function fillEach(
  items: PlannedRow[],
  state: WalkState,
  onProgress: (done: number, total: number) => void,
  isAborted: () => boolean,
): Promise<PlannedRow[]> {
  const leftovers: PlannedRow[] = [];

  for (const item of items) {
    if (isAborted() || state.gaveUp) break;

    const outcome = await fillRow(item).catch<FillOutcome>(() => 'failed');
    if (outcome === 'filled') {
      state.filled++;
      state.consecutiveFailures = 0;
      // Reported *after* the write, never before: a count that leads the work
      // is the bug that made the old "N filled" label wrong in both
      // directions. The bar can only ever lag reality, not overstate it.
      onProgress(state.filled, state.total);
      continue;
    }

    leftovers.push(item);
    // 'missing' is the row not being where we looked — worth another go, but
    // no evidence the flow itself is broken, so it doesn't spend the budget.
    if (outcome === 'missing') continue;

    state.consecutiveFailures++;
    if (state.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      state.gaveUp = true;
    }
  }

  return leftovers;
}

/**
 * Walks the table once, then retries whatever didn't take.
 *
 * Every price row is in the DOM from the start — the table doesn't
 * virtualise, and a row's edit control works without scrolling it into view —
 * so one ordered pass reaches every market and there is nothing to
 * re-discover. (An earlier version scrolled the table and swept it repeatedly
 * on the assumption that it did virtualise. That machinery is gone; it caused
 * far more trouble than it solved, jumping the page around mid-fill.)
 *
 * The single retry is for transient trouble only: a row Angular happened to
 * be re-rendering, or an editor that was slow to close. It costs one extra
 * attempt per market that didn't take, and nothing at all when they all did.
 */
export async function runFill(
  basePrice: number,
  settings: PppSettings,
  onProgress: (done: number, total: number) => void,
  isAborted: () => boolean,
): Promise<PppFillResult> {
  const plan = planPrices(basePrice, settings).planned.filter(
    (item) => !item.skipped,
  );
  const state: WalkState = {
    filled: 0,
    total: plan.length,
    consecutiveFailures: 0,
    gaveUp: false,
  };

  // Publish the denominator before any work, so the bar starts at a real 0/N
  // rather than sitting empty until the first row lands.
  onProgress(0, state.total);

  const leftovers = await fillEach(plan, state, onProgress, isAborted);
  if (leftovers.length && !state.gaveUp && !isAborted()) {
    await fillEach(leftovers, state, onProgress, isAborted);
  }

  return {
    filled: state.filled,
    gaveUp: state.gaveUp,
    aborted: isAborted(),
  };
}
