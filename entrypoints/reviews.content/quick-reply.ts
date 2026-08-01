import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  autoTranslateReplyItem,
  matchesKeyShortcut,
  quickReplyShortcutItem,
} from '@/utils/shortcuts';
import { extractTargetLanguageCode } from '@/utils/language';
import {
  detectLanguage,
  isTranslationSupported,
  languagesMatch,
  translateText,
} from '@/utils/translation';
import {
  findButtonByText,
  flashPublished,
  getFocusedReplyField,
  getReplyText,
  getReviewContainerOf,
  isButtonDisabled,
  setReplyText,
} from '@/utils/dom';
import { ORIGINAL_LANGUAGE_HEADER, PUBLISH_LABELS } from '@/utils/selectors';
import { watchValue } from '@/utils/watch';
import { showToast } from '@/utils/toast';

// Scoped to the review being replied to where possible: PUBLISH_LABELS is
// matched as a substring against text *or* aria-label, so a document-wide
// search can land on another review's (disabled) publish button before the
// one that belongs to this reply.
function findPublishButton(scope?: Element | null): HTMLElement | undefined {
  return (
    (scope && findButtonByText(scope, PUBLISH_LABELS)) ??
    findButtonByText(document, PUBLISH_LABELS)
  );
}

// The publish button's disabled state only reflects a programmatic write once
// Angular's change detection has run, which isn't synchronous with the input
// event — so poll rather than checking once right after the mutation.
async function waitForEnabledPublishButton(
  scope: Element | null,
  timeoutMs = 3000,
  intervalMs = 50,
): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;
  let btn = findPublishButton(scope);
  while ((!btn || isButtonDisabled(btn)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    btn = findPublishButton(scope);
  }
  return btn;
}

async function translateReplyToReviewLanguage(
  active: HTMLElement,
): Promise<boolean> {
  if (!isTranslationSupported()) return false;

  const headerText = getReviewContainerOf(active)?.querySelector(
    ORIGINAL_LANGUAGE_HEADER,
  )?.textContent;
  const targetLanguage = extractTargetLanguageCode(headerText);
  if (!targetLanguage) return false;

  const replyText = getReplyText(active);
  if (!replyText.trim()) return false;

  const progressToast = showToast('🌐 Translating reply…', { sticky: true });
  try {
    const sourceLanguage = (await detectLanguage(replyText)) ?? 'en';
    if (languagesMatch(sourceLanguage, targetLanguage)) return false;

    const translated = await translateText(
      replyText,
      sourceLanguage,
      targetLanguage,
    );
    if (!translated) {
      showToast('⚠️ Translation unavailable — publishing original text');
      return false;
    }

    setReplyText(active, translated);
    showToast("✅ Reply translated to match the review's language");
    return true;
  } finally {
    progressToast.hide();
  }
}

export async function initQuickReply(ctx: ContentScriptContext) {
  const shortcut = await watchValue(ctx, quickReplyShortcutItem);
  const autoTranslate = await watchValue(ctx, autoTranslateReplyItem);

  ctx.addEventListener(window, 'keydown', async (e: KeyboardEvent) => {
    if (!matchesKeyShortcut(e, shortcut())) return;

    const active = getFocusedReplyField();
    if (!active) return;

    e.preventDefault();

    const container = getReviewContainerOf(active);

    // A throw from the on-device translation APIs (unavailable model, a
    // download the page can't start) would otherwise reject this async listener
    // and skip publishing entirely, leaving only an unhandled rejection.
    let translated = false;
    if (autoTranslate()) {
      try {
        translated = await translateReplyToReviewLanguage(active);
      } catch (error) {
        console.warn('Play Console Utils: translation failed.', error);
        showToast('⚠️ Translation failed — publishing original text');
      }
    }

    const publishBtn = translated
      ? await waitForEnabledPublishButton(container)
      : findPublishButton(container);

    if (!publishBtn || isButtonDisabled(publishBtn)) {
      if (translated) {
        console.warn(
          'Play Console Utils: reply was translated but the publish button never became available.',
        );
        showToast('⚠️ Reply translated — click Publish manually to send it');
      }
      return;
    }

    publishBtn.click();
    flashPublished(publishBtn);
  });
}
