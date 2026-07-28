import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  matchesKeyShortcut,
  nextReviewPageShortcutItem,
  nextReviewShortcutItem,
  prevReviewPageShortcutItem,
  prevReviewShortcutItem,
  type KeyShortcut,
} from '@/utils/shortcuts';
import { showToast } from './toast';
import { flashHighlight } from './highlight';
import {
  findReplyFieldIn,
  getFocusedReplyField,
  getReplyText,
} from './reply-field';
import { findButtonByText, isButtonDisabled } from './button-finder';

// A review whose top has scrolled slightly above the viewport top still
// counts as "current" — otherwise the very review you're looking at gets
// skipped as soon as you've scrolled past its top edge by a few pixels.
const CURRENT_THRESHOLD_PX = 80;

function getReviewContainers(): Element[] {
  return Array.from(document.querySelectorAll('.review-container'));
}

function getCurrentIndexByViewport(containers: Element[]): number {
  let currentIndex = 0;
  for (let i = 0; i < containers.length; i++) {
    if (containers[i].getBoundingClientRect().top <= CURRENT_THRESHOLD_PX) {
      currentIndex = i;
    } else {
      break;
    }
  }
  return currentIndex;
}

// Prefer the review whose reply field you're actively focused in — it's a
// more precise "where you are" than the viewport-position guess, e.g. if
// you've scrolled slightly while typing a reply.
function getCurrentIndex(containers: Element[]): number {
  const focusedContainer = getFocusedReplyField()?.closest('.review-container');
  if (focusedContainer) {
    const index = containers.indexOf(focusedContainer);
    if (index !== -1) return index;
  }
  return getCurrentIndexByViewport(containers);
}

function findDiscardButton(container: Element): HTMLElement | undefined {
  return findButtonByText(container, [
    'discard',
    'cancel',
    'descartar',
    'cancelar',
  ]);
}

// Leaving a review with an unpublished, unfocused draft would strand it
// there indefinitely — clicking Discard resets it instead of letting stray
// drafts pile up across the list as you navigate through it.
function discardUnpublishedDraft(container: Element) {
  const replyField = findReplyFieldIn(container);
  if (!replyField || document.activeElement !== replyField) return;
  if (!getReplyText(replyField).trim()) return;
  findDiscardButton(container)?.click();
}

function navigateReview(isNext: boolean) {
  const containers = getReviewContainers();
  if (containers.length === 0) return;

  const currentIndex = getCurrentIndex(containers);
  const targetIndex = isNext
    ? Math.min(currentIndex + 1, containers.length - 1)
    : Math.max(currentIndex - 1, 0);

  if (targetIndex === currentIndex) {
    showToast(
      isNext
        ? "You've reached the last review"
        : "You've reached the first review",
    );
    return;
  }

  discardUnpublishedDraft(containers[currentIndex]);

  const target = containers[targetIndex];
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  flashHighlight(target);
  findReplyFieldIn(target)?.focus({ preventScroll: true });
}

// Play Console's review list paginator's prev/next controls are a
// `material-button` custom element, not a native <button> — icon-only (no
// visible text), with default English labels exactly "Previous page"/"Next
// page" read via aria-label since findButtonByText also checks that.
function findNextPageButton(): HTMLElement | undefined {
  return findButtonByText(document, ['next page', 'página siguiente']);
}

function findPrevPageButton(): HTMLElement | undefined {
  return findButtonByText(document, ['previous page', 'página anterior']);
}

function navigatePage(isNext: boolean) {
  const button = isNext ? findNextPageButton() : findPrevPageButton();
  if (!button || isButtonDisabled(button)) {
    showToast(
      isNext
        ? "You're on the last page of reviews"
        : "You're on the first page of reviews",
    );
    return;
  }

  const focusedContainer = getFocusedReplyField()?.closest('.review-container');
  if (focusedContainer) discardUnpublishedDraft(focusedContainer);

  button.click();
}

export async function initReviewNavigation(ctx: ContentScriptContext) {
  let nextShortcut: KeyShortcut = await nextReviewShortcutItem.getValue();
  const unwatchNext = nextReviewShortcutItem.watch((value) => {
    nextShortcut = value;
  });
  ctx.onInvalidated(() => unwatchNext());

  let prevShortcut: KeyShortcut = await prevReviewShortcutItem.getValue();
  const unwatchPrev = prevReviewShortcutItem.watch((value) => {
    prevShortcut = value;
  });
  ctx.onInvalidated(() => unwatchPrev());

  let nextPageShortcut: KeyShortcut =
    await nextReviewPageShortcutItem.getValue();
  const unwatchNextPage = nextReviewPageShortcutItem.watch((value) => {
    nextPageShortcut = value;
  });
  ctx.onInvalidated(() => unwatchNextPage());

  let prevPageShortcut: KeyShortcut =
    await prevReviewPageShortcutItem.getValue();
  const unwatchPrevPage = prevReviewPageShortcutItem.watch((value) => {
    prevPageShortcut = value;
  });
  ctx.onInvalidated(() => unwatchPrevPage());

  ctx.addEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (matchesKeyShortcut(e, nextShortcut)) {
      e.preventDefault();
      navigateReview(true);
    } else if (matchesKeyShortcut(e, prevShortcut)) {
      e.preventDefault();
      navigateReview(false);
    } else if (matchesKeyShortcut(e, nextPageShortcut)) {
      e.preventDefault();
      navigatePage(true);
    } else if (matchesKeyShortcut(e, prevPageShortcut)) {
      e.preventDefault();
      navigatePage(false);
    }
  });

  console.log('Play Console Utils: review navigation shortcuts active.');
}
