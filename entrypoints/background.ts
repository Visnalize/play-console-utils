import { isConsoleUrl } from '@/utils/console-url';
import { migrateLocalSettingsToSync } from '@/utils/migration';

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

const SIDE_PANEL_PATH = 'sidepanel.html';

async function syncTab(tabId: number, url: string | undefined) {
  const onConsole = isConsoleUrl(url);

  await browser.action.setIcon({
    tabId,
    path: onConsole ? ACTIVE_ICON : INACTIVE_ICON,
  });

  await browser.sidePanel
    .setOptions(
      onConsole
        ? { tabId, path: SIDE_PANEL_PATH, enabled: true }
        : { tabId, enabled: false },
    )
    // The tab can close between the listener firing and this resolving.
    .catch(() => {});
}

async function disableGlobalSidePanel() {
  await browser.sidePanel.setOptions({ enabled: false }).catch(() => {});
}

export default defineBackground(() => {
  void migrateLocalSettingsToSync();
  void disableGlobalSidePanel();

  browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    void syncTab(tabId, tab.url);
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) => syncTab(tabId, tab.url))
      .catch(() => {});
  });

  void browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) void syncTab(tab.id, tab.url);
    }
  });
});
