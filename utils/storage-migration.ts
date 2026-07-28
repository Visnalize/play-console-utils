import { storage, type StorageItemKey } from '@wxt-dev/storage';
import {
  autoTranslateReplyItem,
  parseReviewModifierItem,
  quickReplyShortcutItem,
} from './shortcuts';
import { appMappingsItem } from './app-mapping';

// Settings used to live in chrome.storage.local (per-device). They now live in
// chrome.storage.sync (roams with the user's Chrome profile). This copies any
// pre-existing local: value over to its sync: counterpart, once per device,
// without ever overwriting a sync value another device already migrated in.
const LEGACY_LOCAL_KEYS: Array<{
  legacyKey: StorageItemKey;
  item: { key: StorageItemKey; setValue(value: never): Promise<void> };
}> = [
  {
    legacyKey: 'local:quickReplyShortcut',
    item: quickReplyShortcutItem,
  },
  {
    legacyKey: 'local:parseReviewModifier',
    item: parseReviewModifierItem,
  },
  {
    legacyKey: 'local:autoTranslateReply',
    item: autoTranslateReplyItem,
  },
  {
    legacyKey: 'local:appMappings',
    item: appMappingsItem,
  },
];

export async function migrateLocalSettingsToSync(): Promise<void> {
  for (const { legacyKey, item } of LEGACY_LOCAL_KEYS) {
    const legacyValue = await storage.getItem(legacyKey);
    if (legacyValue === null) continue;

    const existingSyncValue = await storage.getItem(item.key);
    if (existingSyncValue !== null) continue;

    await item.setValue(legacyValue as never);
  }
}
