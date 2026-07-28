import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  autoTranslateReplyItem,
  matchesKeyShortcut,
  quickReplyShortcutItem,
  type KeyShortcut,
} from '@/utils/shortcuts';
import {
  ORIGINAL_LANGUAGE_HEADER_SELECTOR,
  extractTargetLanguageCode,
} from '@/utils/review-language';
import {
  detectLanguage,
  isTranslationSupported,
  languagesMatch,
  translateText,
} from '@/utils/translation';
import { showToast } from './toast';
import { getFocusedReplyField, getReplyText, setReplyText } from './reply-field';
import { findButtonByText, isButtonDisabled } from './button-finder';

function findPublishButton(): HTMLElement | undefined {
  return findButtonByText(document, [
    'publish reply',
    'publish',
    'enviar',
    'responder',
  ]);
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

  const headerText = active
    .closest('.review-container')
    ?.querySelector(ORIGINAL_LANGUAGE_HEADER_SELECTOR)?.textContent;
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
  let shortcut: KeyShortcut = await quickReplyShortcutItem.getValue();
  const unwatchShortcut = quickReplyShortcutItem.watch((value) => {
    shortcut = value;
  });
  ctx.onInvalidated(() => unwatchShortcut());

  let autoTranslate = await autoTranslateReplyItem.getValue();
  const unwatchAutoTranslate = autoTranslateReplyItem.watch((value) => {
    autoTranslate = value;
  });
  ctx.onInvalidated(() => unwatchAutoTranslate());

  ctx.addEventListener(window, 'keydown', async (e: KeyboardEvent) => {
    if (!matchesKeyShortcut(e, shortcut)) return;

    const active = getFocusedReplyField();
    if (!active) return;

    e.preventDefault();

    const translated = autoTranslate
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
    publishBtn.style.transition = 'all 0.2s ease';
    publishBtn.style.backgroundColor = '#2e7d32';
    publishBtn.style.color = '#ffffff';
    publishBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      publishBtn.style.transform = 'none';
    }, 200);
  });

  console.log('Play Console Utils: quick reply shortcut active.');
}
