import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { resolveAppSlug } from '@/utils/apps';
import {
  matchesParseReviewModifier,
  parseReviewModifierItem,
} from '@/utils/shortcuts';
import {
  flashHighlight,
  getActiveAppLabel,
  getReviewAuthor,
  getReviewAvatarUrl,
  getReviewContainerOf,
  getReviewDate,
  getReviewText,
} from '@/utils/dom';
import { watchValue } from '@/utils/watch';
import { showToast } from '@/utils/toast';

// Google's image URLs take a size suffix; s50 keeps the copied avatar small.
const AVATAR_SIZE_SUFFIX = '=s50';

export async function initParseReview(ctx: ContentScriptContext) {
  const modifier = await watchValue(ctx, parseReviewModifierItem);

  ctx.addEventListener(
    document,
    'click',
    async (e: MouseEvent) => {
      if (!matchesParseReviewModifier(e, modifier())) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const { slug: appName, matched } =
        await resolveAppSlug(getActiveAppLabel());

      const container = getReviewContainerOf(target);
      if (container) flashHighlight(container);

      const author = getReviewAuthor(container);
      const avatarUrl = getReviewAvatarUrl(container);

      const data: Record<string, string> = {
        author,
        date: getReviewDate(container),
        app: appName,
        content: getReviewText(container),
      };

      if (avatarUrl) {
        data.image = `${avatarUrl}${AVATAR_SIZE_SUFFIX}`;
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
}
