import { storage } from '@wxt-dev/storage';

export interface PageBookmark {
  id: string;
  label: string;
  url: string;
}

export const pageBookmarksItem = storage.defineItem<PageBookmark[]>(
  'sync:pageBookmarks',
  { fallback: [], version: 1 },
);

export function createPageBookmark(label: string, url: string): PageBookmark {
  return { id: crypto.randomUUID(), label: label.trim(), url };
}
