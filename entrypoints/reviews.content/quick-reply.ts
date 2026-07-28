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
import { showToast } from './toast';

function findPublishButton(): HTMLElement | undefined {
  return findButtonByText(document, PUBLISH_LABELS);
}

// Setting the reply's content programmatically still routes through Play
// Console's Angular change detection before the publish button's disabled
// state reflects it — that isn't synchronous with the dispatched input
// event, so poll briefly instead of checking once right after the mutation.
async function waitForEnabledPublishButton(
  timeoutMs = 1000,
  intervalMs = 50,
): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;
  let btn = findPublishButton();
  while ((!btn || isButtonDisabled(btn)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    btn = findPublishButton();
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

    const translated = autoTranslate()
      ? await translateReplyToReviewLanguage(active)
      : false;

    const publishBtn = translated
      ? await waitForEnabledPublishButton()
      : findPublishButton();

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
