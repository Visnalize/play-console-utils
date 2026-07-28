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
  return matchesModifiers(e, shortcut) && e.key === shortcut.key;
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
  if (shortcut.key) parts.push(shortcut.key);
  return parts.join(' + ') || '(none)';
}
