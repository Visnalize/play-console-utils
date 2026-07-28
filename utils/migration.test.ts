import { describe, expect, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '@wxt-dev/storage';
import { migrateLocalSettingsToSync } from './migration';
import {
  DEFAULT_QUICK_REPLY_SHORTCUT,
  quickReplyShortcutItem,
} from './shortcuts';
import { appMappingsItem } from './apps';

describe('migrateLocalSettingsToSync', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('copies a pre-existing local: value over to sync: when sync is unset', async () => {
    const legacyShortcut = {
      ctrlOrMeta: true,
      shift: true,
      alt: false,
      key: 'k',
    };
    await storage.setItem('local:quickReplyShortcut', legacyShortcut);

    await migrateLocalSettingsToSync();

    expect(await quickReplyShortcutItem.getValue()).toEqual(legacyShortcut);
  });

  it('does nothing when there is no legacy local: value', async () => {
    await migrateLocalSettingsToSync();

    expect(await quickReplyShortcutItem.getValue()).toEqual(
      DEFAULT_QUICK_REPLY_SHORTCUT,
    );
  });

  it('never overwrites a sync: value another device already migrated in', async () => {
    const legacyMappings = [{ label: 'Old Device Label', slug: 'old-device' }];
    const alreadySynced = [
      { label: 'Other Device Label', slug: 'other-device' },
    ];
    await storage.setItem('local:appMappings', legacyMappings);
    await appMappingsItem.setValue(alreadySynced);

    await migrateLocalSettingsToSync();

    expect(await appMappingsItem.getValue()).toEqual(alreadySynced);
  });
});
