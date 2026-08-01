import { storage } from '@wxt-dev/storage';

export interface ModifierKeys {
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyShortcut extends ModifierKeys {
  key: string;
}

const NO_MODIFIERS: ModifierKeys = {
  ctrlOrMeta: false,
  shift: false,
  alt: false,
};

export const DEFAULT_QUICK_REPLY_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  ctrlOrMeta: true,
  key: 'Enter',
};

export const DEFAULT_CANNED_REPLY_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  ctrlOrMeta: true,
  key: 'k',
};

export const DEFAULT_NEXT_REVIEW_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  alt: true,
  key: 'ArrowDown',
};

export const DEFAULT_PREV_REVIEW_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  alt: true,
  key: 'ArrowUp',
};

export const DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  alt: true,
  key: 'ArrowRight',
};

export const DEFAULT_PREV_REVIEW_PAGE_SHORTCUT: KeyShortcut = {
  ...NO_MODIFIERS,
  alt: true,
  key: 'ArrowLeft',
};

export const DEFAULT_PARSE_REVIEW_MODIFIER: ModifierKeys = {
  ...NO_MODIFIERS,
  alt: true,
};

function defineShortcut(key: string, fallback: KeyShortcut) {
  return storage.defineItem<KeyShortcut>(`sync:${key}`, {
    fallback,
    version: 1,
  });
}

export const quickReplyShortcutItem = defineShortcut(
  'quickReplyShortcut',
  DEFAULT_QUICK_REPLY_SHORTCUT,
);

export const cannedReplyShortcutItem = defineShortcut(
  'cannedReplyShortcut',
  DEFAULT_CANNED_REPLY_SHORTCUT,
);

export const nextReviewShortcutItem = defineShortcut(
  'nextReviewShortcut',
  DEFAULT_NEXT_REVIEW_SHORTCUT,
);

export const prevReviewShortcutItem = defineShortcut(
  'prevReviewShortcut',
  DEFAULT_PREV_REVIEW_SHORTCUT,
);

export const nextReviewPageShortcutItem = defineShortcut(
  'nextReviewPageShortcut',
  DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
);

export const prevReviewPageShortcutItem = defineShortcut(
  'prevReviewPageShortcut',
  DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
);

export const parseReviewModifierItem = storage.defineItem<ModifierKeys>(
  'sync:parseReviewModifier',
  { fallback: DEFAULT_PARSE_REVIEW_MODIFIER, version: 1 },
);

export const autoTranslateReplyItem = storage.defineItem<boolean>(
  'sync:autoTranslateReply',
  { fallback: true, version: 1 },
);

export function hasAnyModifier(modifier: ModifierKeys): boolean {
  return modifier.ctrlOrMeta || modifier.shift || modifier.alt;
}

// The physical key, independent of what the modifiers turned it into.
//
// `e.key` is not stable for letter shortcuts: on macOS Option is a compose key,
// so Option+P reports 'π', and Shift+K reports 'K'. A shortcut stored as 'p'
// and matched on `e.key` alone therefore never fires on a Mac — which is how
// Alt+P shipped broken. `e.code` names the key's *position* and is unaffected
// by modifiers, so letters and digits go through it instead.
//
// Known gap: `code` is US-layout-relative, so a Cyrillic layout matches the key
// where 'p' sits on a US board. Chrome's own `commands` API behaves the same.
//
// Returns null for non-letter/digit keys (Enter, ArrowDown, …), where `e.key`
// is already stable.
function physicalKey(e: KeyboardEvent): string | null {
  const code = e.code ?? '';
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];
  return null;
}

/**
 * What to persist when recording a shortcut, so a Mac user pressing Alt+P
 * stores 'p' rather than 'π' and the options page displays something legible.
 */
export function shortcutKeyOf(e: KeyboardEvent): string {
  return physicalKey(e) ?? e.key;
}

function matchesKey(e: KeyboardEvent, key: string): boolean {
  const wanted = key.toLowerCase();
  // The `e.key` arm is kept for shortcuts recorded before this normalisation
  // existed (a stored 'π' still matches), and for named keys like ArrowDown.
  return e.key?.toLowerCase() === wanted || physicalKey(e) === wanted;
}

// Modifier matching is exact on every flag, so distinct configured combos
// can't collide with each other.
function matchesModifiers(
  e: KeyboardEvent | MouseEvent,
  modifier: ModifierKeys,
): boolean {
  return (
    (e.ctrlKey || e.metaKey) === modifier.ctrlOrMeta &&
    e.shiftKey === modifier.shift &&
    e.altKey === modifier.alt
  );
}

export function matchesKeyShortcut(
  e: KeyboardEvent,
  shortcut: KeyShortcut,
): boolean {
  return matchesModifiers(e, shortcut) && matchesKey(e, shortcut.key);
}

export function matchesParseReviewModifier(
  e: MouseEvent,
  modifier: ModifierKeys,
): boolean {
  return hasAnyModifier(modifier) && matchesModifiers(e, modifier);
}

export function formatShortcut(
  shortcut: ModifierKeys & { key?: string },
): string {
  const parts: string[] = [];
  if (shortcut.ctrlOrMeta) parts.push('Ctrl/⌘');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  // Letters are stored lowercase (see shortcutKeyOf) but read better as caps
  // on a key cap — "Alt + P", not "Alt + p". Named keys keep their own casing.
  if (shortcut.key) {
    parts.push(
      shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
    );
  }
  return parts.join(' + ') || '(none)';
}
