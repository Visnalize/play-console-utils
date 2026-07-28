import { defineConfig } from 'wxt';
import { CONSOLE_URL_MATCH_PATTERN } from './utils/console-url';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    define: {
      // All components use <script setup> (Composition API only) and there's
      // no in-extension devtools use case, so strip both from the Vue build.
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
    },
  }),
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
