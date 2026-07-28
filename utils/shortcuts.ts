import { storage } from '@wxt-dev/storage';

export interface ModifierKeys {
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyShortcut extends ModifierKeys {
  key: string;
}

export const DEFAULT_QUICK_REPLY_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: true,
  shift: false,
  alt: false,
  key: 'Enter',
};

export const DEFAULT_PARSE_REVIEW_MODIFIER: ModifierKeys = {
  ctrlOrMeta: false,
  shift: false,
  alt: true,
};

export const DEFAULT_CANNED_REPLY_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: true,
  shift: false,
  alt: false,
  key: 'k',
};

export const DEFAULT_NEXT_REVIEW_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: false,
  shift: false,
  alt: true,
  key: 'ArrowDown',
};

export const DEFAULT_PREV_REVIEW_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: false,
  shift: false,
  alt: true,
  key: 'ArrowUp',
};

export const DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: false,
  shift: false,
  alt: true,
  key: 'ArrowRight',
};

export const DEFAULT_PREV_REVIEW_PAGE_SHORTCUT: KeyShortcut = {
  ctrlOrMeta: false,
  shift: false,
  alt: true,
  key: 'ArrowLeft',
};

export const quickReplyShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:quickReplyShortcut',
  { fallback: DEFAULT_QUICK_REPLY_SHORTCUT, version: 1 },
);

export const parseReviewModifierItem = storage.defineItem<ModifierKeys>(
  'sync:parseReviewModifier',
  {
    fallback: DEFAULT_PARSE_REVIEW_MODIFIER,
    version: 1,
  },
);

export const autoTranslateReplyItem = storage.defineItem<boolean>(
  'sync:autoTranslateReply',
  { fallback: true, version: 1 },
);

export const cannedReplyShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:cannedReplyShortcut',
  { fallback: DEFAULT_CANNED_REPLY_SHORTCUT, version: 1 },
);

export const nextReviewShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:nextReviewShortcut',
  { fallback: DEFAULT_NEXT_REVIEW_SHORTCUT, version: 1 },
);

export const prevReviewShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:prevReviewShortcut',
  { fallback: DEFAULT_PREV_REVIEW_SHORTCUT, version: 1 },
);

export const nextReviewPageShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:nextReviewPageShortcut',
  { fallback: DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT, version: 1 },
);

export const prevReviewPageShortcutItem = storage.defineItem<KeyShortcut>(
  'sync:prevReviewPageShortcut',
  { fallback: DEFAULT_PREV_REVIEW_PAGE_SHORTCUT, version: 1 },
);

export function hasAnyModifier(modifier: ModifierKeys): boolean {
  return modifier.ctrlOrMeta || modifier.shift || modifier.alt;
}

export function matchesKeyShortcut(
  e: KeyboardEvent,
  shortcut: KeyShortcut,
): boolean {
  return (
    (e.ctrlKey || e.metaKey) === shortcut.ctrlOrMeta &&
    e.shiftKey === shortcut.shift &&
    e.altKey === shortcut.alt &&
    e.key === shortcut.key
  );
}

export function matchesParseReviewModifier(
  e: MouseEvent,
  modifier: ModifierKeys,
): boolean {
  return (
    hasAnyModifier(modifier) &&
    (e.ctrlKey || e.metaKey) === modifier.ctrlOrMeta &&
    e.shiftKey === modifier.shift &&
    e.altKey === modifier.alt
  );
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
