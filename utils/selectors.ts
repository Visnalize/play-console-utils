// Every selector and button label the extension uses to reach into Play
// Console's DOM lives here — that DOM is a third-party contract that can
// change without notice, so keeping it in one file makes "what broke when
// Play Console re-skinned the reviews page" a single-file question.
// Behaviour that reads through these selectors belongs in utils/dom.ts.

export const REVIEW_CONTAINER = '.review-container';
export const REVIEW_AUTHOR = '.author-display-name';
export const REVIEW_DATE = '.last-update-time';
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
