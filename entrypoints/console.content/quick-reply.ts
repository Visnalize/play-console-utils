import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  matchesQuickReplyShortcut,
  quickReplyShortcutItem,
  type QuickReplyShortcut,
} from '@/utils/shortcuts';

export async function initQuickReply(ctx: ContentScriptContext) {
  let shortcut: QuickReplyShortcut = await quickReplyShortcutItem.getValue();
  const unwatch = quickReplyShortcutItem.watch((value) => {
    shortcut = value;
  });
  ctx.onInvalidated(() => unwatch());

  ctx.addEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (!matchesQuickReplyShortcut(e, shortcut)) return;

    const active = document.activeElement;
    if (
      !active ||
      !(
        active.tagName === 'TEXTAREA' ||
        (active as HTMLElement).isContentEditable
      )
    ) {
      return;
    }

    e.preventDefault();
    const buttons = Array.from(document.querySelectorAll('button'));
    const publishBtn = buttons.find((btn) => {
      const txt = btn.textContent?.trim().toLowerCase() ?? '';
      return (
        txt.includes('publish reply') ||
        txt.includes('publish') ||
        txt.includes('enviar') ||
        txt.includes('responder')
      );
    });

    if (!publishBtn || publishBtn.disabled) return;
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
