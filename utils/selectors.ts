// Every selector and button label the extension uses to reach into Play
// Console's DOM lives here — that DOM is a third-party contract that can
// change without notice, so keeping it in one file makes "what broke when
// Play Console re-skinned the reviews page" a single-file question.
// Behaviour that reads through these selectors belongs in utils/dom.ts.

export const REVIEW_CONTAINER = '.review-container';
export const REVIEW_AUTHOR = '.author-display-name';
export const REVIEW_DATE = '.last-update-time';
export const REVIEW_TEXT = '.review-text';
export const REVIEW_AVATAR = '.review-avatar';
export const ACTIVE_APP_BUTTON = '.active-app-button';

// Rendered only when the review's language differs from the console's display
// language (see utils/language.ts).
export const ORIGINAL_LANGUAGE_HEADER =
  '[debug-id="original-language-area-header"]';

// A reply box is either a textarea or a contenteditable depending on where in
// the console it's rendered — isReplyField() narrows the matches further.
export const REPLY_FIELD = 'textarea, [contenteditable]';

// Play Console doesn't render every clickable control as a native <button> —
// e.g. the review-list paginator's prev/next controls are a `material-button`
// custom element — so this searches both instead of assuming native buttons.
export const BUTTON = 'button, material-button';

/* -------------------------------- pricing -------------------------------- */

// Play Console's price table is a grid of `<ess-cell>` columns keyed by an
// `essfield` attribute, NOT a form:
//
//   <div class="particle-table-row" role="row">
//     <ess-cell essfield="region-column"> … <span class="main-text">India</span>
//     <ess-cell essfield="price-column">  … <span class="main-text">INR 100.00</span>
//       <div class="ess-edit-icon" role="button" aria-haspopup="true">
//     <ess-cell essfield="tax-column">    … 18%
//
// There is no `<input>` in the row — the price is rendered text, and editing
// it means clicking the price cell to open a popup editor. (The `.ess-edit-icon`
// is only the visible affordance; the cell itself takes the click.) An earlier
// version of this file assumed an input per row and so matched nothing at all.
export const PRICE_ROW = '[role="row"]';

// A header row uses the same essfield columns as a data row, so it's excluded
// by its cells' role rather than by guessing at its text.
export const COLUMN_HEADER = '[role="columnheader"]';

// "Other countries / regions (USD)" and "(EUR)" are collapsible *group*
// headers, and they use the exact same row markup as a real market: same
// `particle-table-row`, same region/price/tax cells. What sets them apart is
// this expand/collapse control, plus an empty price cell with no edit
// affordance. Matching on Play Console's own debug-id beats matching the
// label, which is localised.
export const PRICE_GROUP_TOGGLE = '[debug-id="zippy-button"]';

// The market name and the price live in separate cells. Reading the market
// from its own cell (rather than the whole row's text) keeps the price cell's
// currency code and the tax cell's percentage out of the match.
export const PRICE_REGION_CELL = '[essfield="region-column"]';
// Doubles as the click target that opens the editor — the whole cell is
// clickable, so the `.ess-edit-icon` inside it needs no selector of its own.
export const PRICE_VALUE_CELL = '[essfield="price-column"]';

// Cells wrap their visible value in this; falls back to the cell's own text.
export const PRICE_CELL_TEXT = '.main-text';

// Some Play Console price surfaces may still be plain forms, so the input path
// is kept as a fallback. isPriceInput() does the real filtering, since price
// fields are rendered both with and without a `type`.
export const PRICE_INPUT = 'input';

// Input types that are never a price, so a row's search box or "apply to all"
// checkbox can't be mistaken for one.
export const NON_PRICE_INPUT_TYPES = [
  'checkbox',
  'radio',
  'search',
  'hidden',
  'button',
  'submit',
  'file',
  'range',
  'color',
  'date',
];

// Clicking a row's edit affordance opens this popup, portalled to the end of
// <body> rather than nested in the row:
//
//   <div class="pane edit-popup console-popup visible">
//     <div class="popup-wrapper" role="dialog" aria-label="Price cell edit popup">
//       <input class="mdc-text-field__input" type="money64" aria-label="INR">
//       <console-button debug-id="save-button">   <button aria-label="Save">
//       <console-button debug-id="cancel-button"> <button aria-label="Cancel">
//
// So the editor is found by scoping to the popup, never by scanning the whole
// document for "the one input" — a real console page has plenty of others.
export const PRICE_EDIT_POPUP = '.edit-popup';

// Present only while the popup is actually showing; Angular leaves the pane
// element in place between opens.
export const PRICE_EDIT_POPUP_VISIBLE = 'visible';

// `debug-id` is Play Console's own stable hook and beats matching button text,
// which changes with the console's display language. Note this names the
// <console-button> *wrapper* — the interactive element is the <button> nested
// inside it, which is what carries `disabled`. See findOpenPriceEditor().
export const PRICE_EDIT_SAVE_HOST = '[debug-id="save-button"]';

// Fallback for a popup without the debug-id hook, matched against text or
// aria-label the same way PUBLISH_LABELS is.
export const PRICE_CONFIRM_LABELS = [
  'save',
  'apply',
  'update',
  'done',
  'guardar',
  'aplicar',
];

/* ---------------------------- button labels ---------------------------- */

// Lowercased substrings matched against a button's text *or* aria-label
// (icon-only controls like the paginator only have the latter). The console's
// display language follows the user's account, so each list carries the
// English and Spanish wordings we've seen in the wild.
export const PUBLISH_LABELS = [
  'publish reply',
  'publish',
  'enviar',
  'responder',
];
export const DISCARD_LABELS = ['discard', 'cancel', 'descartar', 'cancelar'];
export const NEXT_PAGE_LABELS = ['next page', 'página siguiente'];
export const PREV_PAGE_LABELS = ['previous page', 'página anterior'];
