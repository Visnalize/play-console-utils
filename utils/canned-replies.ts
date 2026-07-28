import { storage } from '@wxt-dev/storage';

export interface CannedReply {
  id: string;
  label: string;
  content: string;
}

export const cannedRepliesItem = storage.defineItem<CannedReply[]>(
  'sync:cannedReplies',
  { fallback: [], version: 1 },
);

export function createCannedReply(label: string, content: string): CannedReply {
  return { id: crypto.randomUUID(), label: label.trim(), content };
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function fillCannedReplyPlaceholders(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(PLACEHOLDER_RE, (match, key: string) =>
    key in data ? data[key] : match,
  );
}
