import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  cannedReplyShortcutItem,
  matchesKeyShortcut,
  type KeyShortcut,
} from '@/utils/shortcuts';
import {
  cannedRepliesItem,
  fillCannedReplyPlaceholders,
  type CannedReply,
} from '@/utils/canned-replies';
import {
  extractAuthorFromContainer,
  extractDateFromContainer,
  getActiveAppLabel,
} from '@/utils/review-fields';
import { getFocusedReplyField, setReplyText } from './reply-field';
import { showToast } from './toast';

const PANEL_CLASS = 'pcu-canned-reply-picker';
const ROW_CLASS = 'pcu-canned-reply-picker__row';

let closeActivePicker: (() => void) | null = null;

function buildPlaceholderData(replyEl: HTMLElement): Record<string, string> {
  const container = replyEl.closest('.review-container');
  return {
    author: extractAuthorFromContainer(container),
    date: extractDateFromContainer(container),
    app: getActiveAppLabel(),
  };
}

function positionPanel(panel: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  panel.style.left = `${rect.left}px`;
  const estimatedHeight = panel.offsetHeight || 200;
  if (rect.bottom + estimatedHeight > window.innerHeight) {
    panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  } else {
    panel.style.top = `${rect.bottom + 4}px`;
  }
}

function openPicker(replyEl: HTMLElement, templates: CannedReply[]) {
  closeActivePicker?.();

  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;

  function select(template: CannedReply) {
    const filled = fillCannedReplyPlaceholders(
      template.content,
      buildPlaceholderData(replyEl),
    );
    setReplyText(replyEl, filled);
    close();
  }

  templates.forEach((template, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = ROW_CLASS;
    row.textContent = i < 9 ? `${i + 1}. ${template.label}` : template.label;
    row.addEventListener('click', () => select(template));
    panel.appendChild(row);
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const index = Number(e.key) - 1;
      if (index < templates.length) {
        e.preventDefault();
        e.stopPropagation();
        select(templates[index]);
      }
    }
  }

  function onDocumentClick(e: MouseEvent) {
    if (!panel.contains(e.target as Node)) close();
  }

  function close() {
    window.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onDocumentClick, true);
    panel.remove();
    closeActivePicker = null;
  }

  document.body.appendChild(panel);
  positionPanel(panel, replyEl);
  window.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onDocumentClick, true);

  closeActivePicker = close;
}

export async function initCannedReplyPicker(ctx: ContentScriptContext) {
  let shortcut: KeyShortcut = await cannedReplyShortcutItem.getValue();
  const unwatchShortcut = cannedReplyShortcutItem.watch((value) => {
    shortcut = value;
  });
  ctx.onInvalidated(() => unwatchShortcut());
  ctx.onInvalidated(() => closeActivePicker?.());

  ctx.addEventListener(window, 'keydown', async (e: KeyboardEvent) => {
    if (!matchesKeyShortcut(e, shortcut)) return;

    const active = getFocusedReplyField();
    if (!active) return;

    e.preventDefault();

    const templates = await cannedRepliesItem.getValue();
    if (templates.length === 0) {
      showToast('No canned replies yet — add some in the options page');
      return;
    }

    openPicker(active, templates);
  });

  console.log('Play Console Utils: canned reply picker active.');
}
