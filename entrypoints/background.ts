import { isConsoleUrl } from '@/utils/console-url';
import { migrateLocalSettingsToSync } from '@/utils/storage-migration';

const ACTIVE_ICON = {
  16: '/icons/icon16.png',
  48: '/icons/icon48.png',
  128: '/icons/icon128.png',
};

const INACTIVE_ICON = {
  16: '/icons/gray/icon16.png',
  48: '/icons/gray/icon48.png',
  128: '/icons/gray/icon128.png',
};

async function syncIcon(tabId: number, url: string | undefined) {
  await browser.action.setIcon({
    tabId,
    path: isConsoleUrl(url) ? ACTIVE_ICON : INACTIVE_ICON,
  });
}

export default defineBackground(() => {
  void migrateLocalSettingsToSync();

  browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    void syncIcon(tabId, tab.url);
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) => syncIcon(tabId, tab.url))
      .catch(() => {});
  });

  void browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) void syncIcon(tab.id, tab.url);
    }
  });
});
