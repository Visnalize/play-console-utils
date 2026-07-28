import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { resolveAppSlug } from '@/utils/app-mapping';
import {
  matchesParseReviewModifier,
  parseReviewModifierItem,
  type ModifierKeys,
} from '@/utils/shortcuts';
import {
  extractAuthorFromContainer,
  extractDateFromContainer,
  getActiveAppLabel,
} from '@/utils/review-fields';
import { showToast } from './toast';
import { flashHighlight } from './highlight';

export async function initParseReview(ctx: ContentScriptContext) {
  let modifier: ModifierKeys = await parseReviewModifierItem.getValue();
  const unwatch = parseReviewModifierItem.watch((value) => {
    modifier = value;
  });
  ctx.onInvalidated(() => unwatch());

  ctx.addEventListener(
    document,
    'click',
    async (e: MouseEvent) => {
      if (!matchesParseReviewModifier(e, modifier)) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const { slug: appName, matched } = await resolveAppSlug(
        getActiveAppLabel(),
      );

      const reviewContainer = target.closest('.review-container');
      if (reviewContainer) flashHighlight(reviewContainer);

      const avatar =
        reviewContainer?.querySelector<HTMLImageElement>('.review-avatar');
      const author = extractAuthorFromContainer(reviewContainer);
      const dateStr = extractDateFromContainer(reviewContainer);
      const content = target.innerText.trim();

      const data: Record<string, string> = {
        author,
        date: dateStr,
        app: appName,
        content,
      };

      if (avatar) {
        data.image = `${avatar.src}=s50`;
      }

      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));

      showToast(
        matched
          ? `✅ Copied quote by ${author}`
          : `✅ Copied quote by ${author} (auto slug "${appName}" — configure in options)`,
      );
    },
    { capture: true },
  );

  console.log('Play Console Utils: review parser shortcut active.');
}
