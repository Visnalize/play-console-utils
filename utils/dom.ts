// The extension's only DOM layer: every read of, and write to, the Play
// Console page goes through here so feature modules stay free of selector
// details (those live in utils/selectors.ts) and browser quirks.
import {
  ACTIVE_APP_BUTTON,
  BUTTON,
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
