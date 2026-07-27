import { defineConfig } from 'wxt';
import { CONSOLE_URL_MATCH_PATTERN } from './utils/console-url';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Play Console Utils',
    description: 'Productivity utilities and shortcuts for Google Play Console',
    permissions: ['storage'],
    host_permissions: [CONSOLE_URL_MATCH_PATTERN],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
    action: {
      default_icon: {
        16: '/icons/gray/icon16.png',
        48: '/icons/gray/icon48.png',
        128: '/icons/gray/icon128.png',
      },
    },
  },
});
