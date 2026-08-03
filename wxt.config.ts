import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { CONSOLE_URL_MATCH_PATTERN } from './utils/console-url';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    // Drives assets/ui.css (popup + options only — see the note in that file).
    plugins: [tailwindcss()],
    define: {
      // All components use <script setup> (Composition API only) and there's
      // no in-extension devtools use case, so strip both from the Vue build.
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
    },
  }),
  // A function, not an object, so the side-panel permission can be Chrome-only:
  // Firefox has no `sidePanel` permission (WXT maps the entrypoint to
  // `sidebar_action` there) and would flag it as unknown.
  manifest: ({ browser }) => ({
    name: 'ConsoleTurbo: Toolkit for Play Console',
    short_name: 'ConsoleTurbo',
    description: 'Productivity utilities and shortcuts for Google Play Console',
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'sidePanel'],
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
  }),
});
