import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Play Console Utils',
  description:
    'Productivity shortcuts for the Google Play Console review section',
  cleanUrls: true,
  head: [['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }]],
  themeConfig: {
    logo: '/icon.png',
    nav: [
      {
        text: 'Add to Chrome',
        link: 'https://chromewebstore.google.com/detail/nmhdlfiiadbnjnclabgonbapkmhkahkn',
      },
      { text: 'Privacy Policy', link: '/privacy' },
      { text: 'Changelog', link: '/changelog' },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/Visnalize/play-console-utils',
      },
    ],
    footer: {
      message:
        'Built with Claude Code by <a href="https://visnalize.com">Visnalize</a>',
    },
  },
});
