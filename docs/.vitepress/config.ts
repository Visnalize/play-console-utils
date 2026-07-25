import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Play Console Utils',
  description: 'Privacy policy for the Play Console Utils Chrome extension',
  themeConfig: {
    nav: [{ text: 'Privacy Policy', link: '/privacy/' }],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/Visnalize/play-console-utils',
      },
    ],
  },
});
