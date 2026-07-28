import { storage } from '@wxt-dev/storage';

export interface ModifierKeys {
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface QuickReplyShortcut extends ModifierKeys {
  key: string;
}

export const DEFAULT_QUICK_REPLY_SHORTCUT: QuickReplyShortcut = {
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

export const quickReplyShortcutItem = storage.defineItem<QuickReplyShortcut>(
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

export function hasAnyModifier(modifier: ModifierKeys): boolean {
  return modifier.ctrlOrMeta || modifier.shift || modifier.alt;
}

export function matchesQuickReplyShortcut(
  e: KeyboardEvent,
  shortcut: QuickReplyShortcut,
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
