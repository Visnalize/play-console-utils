import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { resolveAppSlug } from '@/utils/app-mapping';
import {
  matchesParseReviewModifier,
  parseReviewModifierItem,
  type ModifierKeys,
} from '@/utils/shortcuts';

function flashHighlight(el: Element) {
  el.classList.remove('quote-ext-highlight');
  void (el as HTMLElement).offsetWidth; // force reflow so the animation restarts on repeat captures
  el.classList.add('quote-ext-highlight');
  el.addEventListener(
    'animationend',
    () => el.classList.remove('quote-ext-highlight'),
    { once: true },
  );
}

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
      const appLabel =
        document.querySelector('.active-app-button')?.ariaLabel ?? '';
      const { slug: appName, matched } = await resolveAppSlug(appLabel);

      const reviewContainer = target.closest('.review-container');
      if (reviewContainer) flashHighlight(reviewContainer);

      const avatar =
        reviewContainer?.querySelector<HTMLImageElement>('.review-avatar');
      const author =
        reviewContainer
          ?.querySelector<HTMLElement>('.author-display-name')
          ?.innerText?.trim() || 'Unknown Author';
      const dateEl =
        reviewContainer?.querySelector<HTMLElement>('.last-update-time');
      let dateStr = dateEl ? dateEl.innerText.trim() : 'Unknown Date';
      if (dateStr.includes(','))
        dateStr = dateStr.split(',').slice(0, 2).join(',').trim();
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

      const toast = document.createElement('div');
      toast.className = 'quote-ext-toast';
      toast.innerText = matched
        ? `✅ Copied quote by ${author}`
        : `✅ Copied quote by ${author} (auto slug "${appName}" — configure in options)`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    },
    { capture: true },
  );

  console.log('Play Console Utils: review parser shortcut active.');
}
