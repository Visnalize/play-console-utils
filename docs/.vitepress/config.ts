import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Play Console Utils',
  description: 'Privacy policy for the Play Console Utils Chrome extension',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Privacy Policy', link: '/privacy' },
      { text: 'Changelog', link: '/changelog' },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/Visnalize/play-console-utils',
      },
    ],
  },
});
