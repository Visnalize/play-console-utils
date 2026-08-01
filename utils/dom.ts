// The extension's only DOM layer: every read of, and write to, the Play
// Console page goes through here so feature modules stay free of selector
// details (those live in utils/selectors.ts) and browser quirks.
import {
  ACTIVE_APP_BUTTON,
  BUTTON,
  COLUMN_HEADER,
  NON_PRICE_INPUT_TYPES,
  PRICE_CELL_TEXT,
  PRICE_CONFIRM_LABELS,
  PRICE_EDIT_POPUP,
  PRICE_EDIT_POPUP_VISIBLE,
  PRICE_EDIT_SAVE_HOST,
  PRICE_GROUP_TOGGLE,
  PRICE_INPUT,
  PRICE_REGION_CELL,
  PRICE_ROW,
  PRICE_VALUE_CELL,
  REPLY_FIELD,
  REVIEW_AUTHOR,
  REVIEW_AVATAR,
  REVIEW_CONTAINER,
  REVIEW_DATE,
  REVIEW_TEXT,
} from './selectors';

export const UNKNOWN_AUTHOR = 'Unknown Author';
export const UNKNOWN_DATE = 'Unknown Date';

// Class names the extension adds itself (styled in
// entrypoints/reviews.content/style.css).
export const HIGHLIGHT_CLASS = 'pcu-highlight';
export const PUBLISH_FLASH_CLASS = 'pcu-publish-flash';

function innerTextOf(
  container: Element | null | undefined,
  selector: string,
): string {
  return (
    container?.querySelector<HTMLElement>(selector)?.innerText?.trim() ?? ''
  );
}

/* -------------------------------- reviews -------------------------------- */

// Never cached by callers — Angular may re-render the review list between
// keypresses, so each lookup re-queries the live DOM.
export function getReviewContainers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(REVIEW_CONTAINER));
}

export function getReviewContainerOf(
  el: Element | null | undefined,
): HTMLElement | null {
  return el?.closest<HTMLElement>(REVIEW_CONTAINER) ?? null;
}

export function getReviewAuthor(container: Element | null | undefined): string {
  return innerTextOf(container, REVIEW_AUTHOR) || UNKNOWN_AUTHOR;
}

export function getReviewDate(container: Element | null | undefined): string {
  const raw = innerTextOf(container, REVIEW_DATE);
  if (!raw) return UNKNOWN_DATE;
  return raw.includes(',') ? raw.split(',').slice(0, 2).join(',').trim() : raw;
}

export function getReviewAvatarUrl(
  container: Element | null | undefined,
): string | null {
  return container?.querySelector<HTMLImageElement>(REVIEW_AVATAR)?.src ?? null;
}

// The raw label of the app selector — a display name, not a slug (slugs are
// utils/apps.ts's concern).
export function getActiveAppLabel(): string {
  return (
    document.querySelector<HTMLElement>(ACTIVE_APP_BUTTON)?.ariaLabel ?? ''
  );
}

// The review body only — the element that receives a click on it is a wrapper
// that also carries the device line, the "Translated from …" banner and the
// reply box's helper text, so the clicked element's own innerText is all of
// that at once.
export function getReviewText(container: Element | null | undefined): string {
  return innerTextOf(container, REVIEW_TEXT);
}

/* ----------------------------- reply fields ------------------------------ */

export function isReplyField(el: Element): boolean {
  return el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function getFocusedReplyField(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !isReplyField(active)) return null;
  return active;
}

export function findReplyFieldIn(container: Element): HTMLElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLElement>(REPLY_FIELD)).find(
      isReplyField,
    ) ?? null
  );
}

export function getReplyText(el: HTMLElement): string {
  return el.tagName === 'TEXTAREA'
    ? (el as HTMLTextAreaElement).value
    : el.innerText;
}

function selectAllIn(el: HTMLElement) {
  if (el.tagName === 'TEXTAREA') {
    (el as HTMLTextAreaElement).select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

// Replaces the field's content the way a user would: select everything, then
// type over it. execCommand is deprecated but it's still the only API that
// runs the browser's real editing pipeline, which matters twice over here —
// it emits trusted beforeinput/input events Play Console's Angular bindings
// can't miss, and it keeps the caret (and therefore focus) inside the field.
// Assigning `.innerText` instead tears out the node the caret lives in, which
// drops focus out of a contenteditable reply box and takes Play Console's
// reply toolbar — Publish button included — down with it.
export function setReplyText(el: HTMLElement, text: string) {
  el.focus({ preventScroll: true });
  try {
    selectAllIn(el);
    document.execCommand('insertText', false, text);
    if (getReplyText(el).trim() === text.trim()) return;
  } catch {
    // Fall through to the direct write below.
  }

  if (el.tagName === 'TEXTAREA') {
    (el as HTMLTextAreaElement).value = text;
  } else {
    el.innerText = text;
  }
  // Play Console's Angular bindings only notice a programmatic write once
  // these are dispatched — and even then not synchronously.
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  // The write above may have blown away the caret; put focus back so the
  // reply toolbar stays open.
  el.focus({ preventScroll: true });
}

/* -------------------------------- pricing -------------------------------- */

export interface PriceRow {
  row: HTMLElement;
  /** Text naming the market, from the region cell — e.g. "India". */
  text: string;
  /** The price cell's current text, e.g. "INR 100.00". Empty if unset. */
  valueText: string;
  /**
   * Click target that opens this row's price editor: the price cell itself.
   *
   * Not the `.ess-edit-icon` inside it — that icon is only the visible
   * affordance, and targeting it meant dealing with its `transparent` class
   * and the cell's `trigger-hover`, i.e. synthesising a hover first. The cell
   * takes a plain click, so none of that is needed.
   */
  edit: HTMLElement | null;
  /** Direct input, for price surfaces rendered as a plain form instead. */
  input: HTMLInputElement | null;
}

// An editable field that could plausibly hold a price. Disabled and read-only
// fields are excluded because writing to them wouldn't stick anyway.
export function isPriceInput(el: HTMLInputElement): boolean {
  const type = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (NON_PRICE_INPUT_TYPES.includes(type)) return false;
  return !el.disabled && !el.readOnly;
}

function cellText(cell: Element | null | undefined): string {
  if (!cell) return '';
  const inner = cell.querySelector<HTMLElement>(PRICE_CELL_TEXT);
  return ((inner ?? (cell as HTMLElement)).innerText ?? '').trim();
}

// Exported for testing: the per-row half of getPriceRows(), which is the part
// with no layout or live-document dependency.
export function toPriceRow(row: HTMLElement): PriceRow | null {
  // The header row carries the same essfield columns as a data row, so it
  // would otherwise be scanned (and counted) as one that simply didn't match.
  if (row.querySelector(COLUMN_HEADER)) return null;

  // So does a collapsible group header ("Other countries / regions (USD)").
  // It has no price of its own and nothing to edit, but its label contains a
  // currency code — so without this it matched USD/EUR and showed a bogus
  // averaged price for a row that can't be filled at all.
  if (row.querySelector(PRICE_GROUP_TOGGLE)) return null;

  // Preferred shape — the real Play Console price table (see selectors.ts).
  const regionCell = row.querySelector(PRICE_REGION_CELL);
  const valueCell = row.querySelector(PRICE_VALUE_CELL);
  if (regionCell && valueCell) {
    const text = cellText(regionCell);
    if (!text) return null;
    return {
      row,
      text,
      valueText: cellText(valueCell),
      // The price cell itself opens the editor — see PriceRow.edit.
      edit: valueCell as HTMLElement,
      input:
        Array.from(
          valueCell.querySelectorAll<HTMLInputElement>(PRICE_INPUT),
        ).find(isPriceInput) ?? null,
    };
  }

  // Fallback — a price surface rendered as a plain form.
  const input = Array.from(
    row.querySelectorAll<HTMLInputElement>(PRICE_INPUT),
  ).find(isPriceInput);
  if (!input) return null;

  const text = (row.innerText ?? '').trim();
  if (!text) return null;

  return { row, text, valueText: input.value.trim(), edit: null, input };
}

// Re-queried on every use, never cached — Play Console's price tables are
// Angular-rendered and rows come and go as the market list is filtered.
export function getPriceRows(): PriceRow[] {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(PRICE_ROW));
  const found: PriceRow[] = [];
  const seen = new Set<Element>();

  for (const row of rows) {
    const priceRow = toPriceRow(row);
    if (!priceRow) continue;
    // PRICE_ROW can match nested rows in some layouts, so the same row content
    // is reachable twice. Key on the identifying cell/input, not the row node.
    const key = priceRow.input ?? row.querySelector(PRICE_VALUE_CELL) ?? row;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(priceRow);
  }

  return found;
}

/** True when the row already shows a price, i.e. more than just a currency. */
export function hasPriceValue(row: PriceRow): boolean {
  return /\d/.test(row.valueText);
}

export function getPriceInputValue(input: HTMLInputElement): string {
  return input.value.trim();
}

// Writes a price the way setReplyText writes a reply, and for the same reason:
// execCommand runs the browser's real editing pipeline, so Angular sees
// trusted input events rather than a silent property assignment it never
// notices. Falls back to the native value setter — Angular overrides `value`
// on the element instance, so assigning `input.value` directly can be
// swallowed; the prototype's setter is the one that actually writes through.
export function setPriceInputValue(input: HTMLInputElement, value: string) {
  input.focus({ preventScroll: true });
  try {
    input.select();
    document.execCommand('insertText', false, value);
    if (input.value.trim() === value.trim()) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  } catch {
    // Fall through to the direct write below.
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const POLL_MS = 50;

/** Resolves once `read` returns something truthy, or null on timeout. */
export async function waitFor<T>(
  read: () => T | null | undefined,
  timeoutMs: number,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

export interface PriceEditor {
  popup: HTMLElement;
  input: HTMLInputElement;
  /** Play Console's own Save button; null when only Enter is available. */
  save: HTMLElement | null;
}

export function isPriceEditorOpen(popup: HTMLElement): boolean {
  return (
    popup.isConnected && popup.classList.contains(PRICE_EDIT_POPUP_VISIBLE)
  );
}

/**
 * The price editor Play Console opens after a row's edit affordance is
 * clicked. Scoped to the popup element: the popup is portalled to the end of
 * <body>, and a real console page has many unrelated inputs, so a
 * document-wide "find the one input" search finds the wrong thing or nothing.
 */
export function findOpenPriceEditor(): PriceEditor | null {
  const popups = Array.from(
    document.querySelectorAll<HTMLElement>(PRICE_EDIT_POPUP),
  );
  for (const popup of popups) {
    if (!isPriceEditorOpen(popup)) continue;
    const input = Array.from(
      popup.querySelectorAll<HTMLInputElement>(PRICE_INPUT),
    ).find(isPriceInput);
    if (!input) continue;
    // The debug-id sits on the <console-button> wrapper, but the wrapper has
    // no `disabled` and swallows clicks — the real control is the <button>
    // inside it. Getting this wrong is silent: the enabled-check passes
    // instantly and the click does nothing at all.
    const saveHost = popup.querySelector<HTMLElement>(PRICE_EDIT_SAVE_HOST);
    const save =
      saveHost?.querySelector<HTMLElement>(BUTTON) ??
      saveHost ??
      findButtonByText(popup, PRICE_CONFIRM_LABELS) ??
      null;

    return { popup, input, save };
  }
  return null;
}

// Legacy `keyCode` is still what some Angular Material handlers read.
const LEGACY_KEY_CODES: Record<string, number> = { Enter: 13, Escape: 27 };

/** Finds the live row for a market name, re-querying the current DOM. */
export function findPriceRowByText(text: string): PriceRow | null {
  return getPriceRows().find((row) => row.text === text) ?? null;
}

/**
 * Presses an element the way a mouse button does — the down/up pair, then the
 * click. Material components commonly bind to `mousedown` rather than `click`
 * alone, so `.click()` on its own can be a no-op.
 *
 * No hover events: an earlier version fired a whole `pointerover`/`mouseenter`
 * preamble because it was aiming at the price cell's `.ess-edit-icon`, which
 * is hover-gated. Clicking the cell needs none of that.
 */
export function clickLikeMouse(el: HTMLElement) {
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
  };
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    const Ctor =
      type.startsWith('pointer') && typeof PointerEvent === 'function'
        ? PointerEvent
        : MouseEvent;
    el.dispatchEvent(new Ctor(type, init));
  }
  el.click();
}

export function pressKey(el: HTMLElement, key: string) {
  const keyCode = LEGACY_KEY_CODES[key] ?? 0;
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    el.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code: key,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

/* -------------------------------- buttons -------------------------------- */

export function findButtonByText(
  scope: ParentNode,
  labels: string[],
): HTMLElement | undefined {
  return Array.from(scope.querySelectorAll<HTMLElement>(BUTTON)).find((btn) => {
    // Icon-only buttons (e.g. paginator prev/next) have no visible text, only
    // an aria-label — check both so one matcher covers labeled and icon buttons.
    const text =
      `${btn.textContent ?? ''} ${btn.getAttribute('aria-label') ?? ''}`
        .trim()
        .toLowerCase();
    return labels.some((label) => text.includes(label));
  });
}

// Custom button elements don't necessarily expose the native
// HTMLButtonElement.disabled IDL property, so check the attribute forms
// Angular Material-style components actually reflect it through too.
export function isButtonDisabled(btn: HTMLElement): boolean {
  return (
    (btn as HTMLButtonElement).disabled === true ||
    btn.hasAttribute('disabled') ||
    btn.getAttribute('aria-disabled') === 'true'
  );
}

/* ------------------------------- animation ------------------------------- */

function flashClass(el: Element, className: string) {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth; // force reflow so the animation restarts on repeat triggers
  el.classList.add(className);
  el.addEventListener('animationend', () => el.classList.remove(className), {
    once: true,
  });
}

export function flashHighlight(el: Element) {
  flashClass(el, HIGHLIGHT_CLASS);
}

export function flashPublished(el: Element) {
  flashClass(el, PUBLISH_FLASH_CLASS);
}
