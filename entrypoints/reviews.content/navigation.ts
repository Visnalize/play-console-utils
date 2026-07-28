import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  matchesKeyShortcut,
  nextReviewPageShortcutItem,
  nextReviewShortcutItem,
  prevReviewPageShortcutItem,
  prevReviewShortcutItem,
  type KeyShortcut,
} from '@/utils/shortcuts';
import {
  findButtonByText,
  findReplyFieldIn,
  flashHighlight,
  getFocusedReplyField,
  getReplyText,
  getReviewContainerOf,
  getReviewContainers,
  isButtonDisabled,
} from '@/utils/dom';
import {
  DISCARD_LABELS,
  NEXT_PAGE_LABELS,
  PREV_PAGE_LABELS,
} from '@/utils/selectors';
import { watchValue } from '@/utils/watch';
import { showToast } from './toast';

// A review whose top has scrolled slightly above the viewport top still
// counts as "current" — otherwise the very review you're looking at gets
// skipped as soon as you've scrolled past its top edge by a few pixels.
const CURRENT_THRESHOLD_PX = 80;

function getFocusedReviewContainer(): HTMLElement | null {
  return getReviewContainerOf(getFocusedReplyField());
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
  const focusedContainer = getFocusedReviewContainer();
  if (focusedContainer) {
    const index = containers.indexOf(focusedContainer);
    if (index !== -1) return index;
  }
  return getCurrentIndexByViewport(containers);
}

// Leaving a review with an unpublished draft would strand it there
// indefinitely — clicking Discard resets it instead of letting stray drafts
// pile up across the list as you navigate through it. An unfocused or already
// empty reply field is left alone.
function discardUnpublishedDraft(container: Element) {
  const replyField = findReplyFieldIn(container);
  if (!replyField || document.activeElement !== replyField) return;
  if (!getReplyText(replyField).trim()) return;
  findButtonByText(container, DISCARD_LABELS)?.click();
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
  // preventScroll so the browser's default focus-scroll doesn't fight the
  // smooth scrollIntoView above.
  findReplyFieldIn(target)?.focus({ preventScroll: true });
}

// Clicks Play Console's own paginator instead of moving within the list. No
// attempt is made to scroll to or focus anything afterwards — the page swap is
// Angular-driven and async, so there's no reliable moment to act.
function navigatePage(isNext: boolean) {
  const button = findButtonByText(
    document,
    isNext ? NEXT_PAGE_LABELS : PREV_PAGE_LABELS,
  );
  if (!button || isButtonDisabled(button)) {
    showToast(
      isNext
        ? "You're on the last page of reviews"
        : "You're on the first page of reviews",
    );
    return;
  }

  const focusedContainer = getFocusedReviewContainer();
  if (focusedContainer) discardUnpublishedDraft(focusedContainer);

  button.click();
}

export async function initNavigation(ctx: ContentScriptContext) {
  const bindings: Array<{ shortcut: () => KeyShortcut; run: () => void }> = [
    {
      shortcut: await watchValue(ctx, nextReviewShortcutItem),
      run: () => navigateReview(true),
    },
    {
      shortcut: await watchValue(ctx, prevReviewShortcutItem),
      run: () => navigateReview(false),
    },
    {
      shortcut: await watchValue(ctx, nextReviewPageShortcutItem),
      run: () => navigatePage(true),
    },
    {
      shortcut: await watchValue(ctx, prevReviewPageShortcutItem),
      run: () => navigatePage(false),
    },
  ];

  ctx.addEventListener(window, 'keydown', (e: KeyboardEvent) => {
    const binding = bindings.find((b) => matchesKeyShortcut(e, b.shortcut()));
    if (!binding) return;
    // Called before the handler runs so the page-navigation defaults
    // (Alt+ArrowLeft/Right) don't also trigger Chrome's browser-back/forward
    // accelerator on Windows/Linux.
    e.preventDefault();
    binding.run();
  });
}
