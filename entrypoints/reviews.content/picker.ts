import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { cannedReplyShortcutItem, matchesKeyShortcut } from '@/utils/shortcuts';
import {
  cannedRepliesItem,
  fillCannedReplyPlaceholders,
  type CannedReply,
} from '@/utils/canned-replies';
import {
  getActiveAppLabel,
  getFocusedReplyField,
  getReviewAuthor,
  getReviewContainerOf,
  getReviewDate,
  setReplyText,
} from '@/utils/dom';
import { watchValue } from '@/utils/watch';
import { showToast } from './toast';

const PANEL_CLASS = 'pcu-picker';
const HEADER_CLASS = 'pcu-picker__header';
const HINT_CLASS = 'pcu-picker__hint';
const ROW_CLASS = 'pcu-picker__row';
const KEY_CLASS = 'pcu-picker__key';
const KEY_EMPTY_CLASS = 'pcu-picker__key--empty';
const LABEL_CLASS = 'pcu-picker__label';

// Only the first nine rows get a number key — later templates stay listed and
// clickable, just unnumbered.
const NUMBERED_ROWS = 9;

let closeActivePicker: (() => void) | null = null;

function buildPlaceholderData(replyEl: HTMLElement): Record<string, string> {
  const container = getReviewContainerOf(replyEl);
  return {
    author: getReviewAuthor(container),
    date: getReviewDate(container),
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

  function close() {
    window.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onDocumentClick, true);
    panel.remove();
    closeActivePicker = null;
  }

  // Replaces the reply field's whole content — it doesn't insert at the cursor
  // or publish anything.
  function select(template: CannedReply) {
    setReplyText(
      replyEl,
      fillCannedReplyPlaceholders(
        template.content,
        buildPlaceholderData(replyEl),
      ),
    );
    close();
  }

  // Intercepts only Escape and the row digits; every other key passes through
  // so normal typing and Play Console's own bindings are unaffected.
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

  const header = document.createElement('div');
  header.className = HEADER_CLASS;
  header.textContent = 'Canned replies';
  const hint = document.createElement('span');
  hint.className = HINT_CLASS;
  hint.textContent = 'press a number key';
  header.appendChild(hint);
  panel.appendChild(header);

  templates.forEach((template, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = ROW_CLASS;

    // The digit renders as a key cap rather than a "1." text prefix so it reads
    // as a shortcut. Rows past NUMBERED_ROWS keep an empty cap of the same width
    // so every label stays on the same left edge.
    const key = document.createElement('span');
    const numbered = i < NUMBERED_ROWS;
    key.className = numbered ? KEY_CLASS : `${KEY_CLASS} ${KEY_EMPTY_CLASS}`;
    key.textContent = numbered ? String(i + 1) : '';
    if (numbered) {
      row.setAttribute('aria-keyshortcuts', String(i + 1));
    } else {
      key.setAttribute('aria-hidden', 'true');
    }

    const label = document.createElement('span');
    label.className = LABEL_CLASS;
    label.textContent = template.label;

    row.append(key, label);
    row.addEventListener('click', () => select(template));
    panel.appendChild(row);
  });

  document.body.appendChild(panel);
  positionPanel(panel, replyEl);
  window.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onDocumentClick, true);

  closeActivePicker = close;
}

export async function initPicker(ctx: ContentScriptContext) {
  const shortcut = await watchValue(ctx, cannedReplyShortcutItem);
  ctx.onInvalidated(() => closeActivePicker?.());

  ctx.addEventListener(window, 'keydown', async (e: KeyboardEvent) => {
    if (!matchesKeyShortcut(e, shortcut())) return;

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
}
