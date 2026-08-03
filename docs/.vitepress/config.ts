import { readFileSync } from 'node:fs';
import { defineConfig, type HeadConfig } from 'vitepress';

const HOSTNAME = 'https://pcu.visnalize.com';
const SITE_TITLE = 'ConsoleTurbo';
const SITE_DESCRIPTION =
  'A free Chrome extension that adds keyboard shortcuts to the Google Play Console: publish review replies instantly, auto-translate them on-device, insert canned reply templates, navigate reviews, copy any review as JSON, and bulk-fill regional prices by purchasing power parity.';
const WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/nmhdlfiiadbnjnclabgonbapkmhkahkn';
const REPO_URL = 'https://github.com/Visnalize/play-console-utils';
const OG_IMAGE = `${HOSTNAME}/og.png`;

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
);

/** Turns a page's `relativePath` into its canonical, `cleanUrls`-style URL. */
const canonicalUrl = (relativePath: string) =>
  `${HOSTNAME}/${relativePath}`.replace(/index\.md$/, '').replace(/\.md$/, '');

export default defineConfig({
  lang: 'en-US',
  title: SITE_TITLE,
  titleTemplate: `:title | ${SITE_TITLE}`,
  description: SITE_DESCRIPTION,
  cleanUrls: true,
  sitemap: { hostname: HOSTNAME },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/icon.png' }],
    ['meta', { name: 'theme-color', content: '#1f4dbe' }],
    ['meta', { name: 'author', content: 'Visnalize' }],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'Play Console, Google Play Console, Chrome extension, Play Store reviews, review replies, reply templates, keyboard shortcuts, auto-translate, productivity',
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: `${SITE_TITLE} — handle Play Store reviews from the keyboard`,
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
  ],
  transformPageData(pageData) {
    const url = canonicalUrl(pageData.relativePath);
    const isHome = pageData.frontmatter.layout === 'home';
    const title = isHome
      ? `${SITE_TITLE} — Keyboard shortcuts for the Google Play Console`
      : `${pageData.title} | ${SITE_TITLE}`;
    const description = pageData.frontmatter.description || SITE_DESCRIPTION;

    const head: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    ];

    if (isHome) {
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_TITLE,
          description: SITE_DESCRIPTION,
          url: HOSTNAME,
          applicationCategory: 'BrowserApplication',
          operatingSystem: 'Chrome, Firefox',
          softwareVersion: version,
          downloadUrl: WEB_STORE_URL,
          installUrl: WEB_STORE_URL,
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          author: {
            '@type': 'Organization',
            name: 'Visnalize',
            url: 'https://visnalize.com',
          },
          image: OG_IMAGE,
          screenshot: OG_IMAGE,
          codeRepository: REPO_URL,
        }),
      ]);
    }

    pageData.frontmatter.head = [...(pageData.frontmatter.head ?? []), ...head];
  },
  themeConfig: {
    logo: '/icon.png',
    nav: [
      { text: 'Add to Chrome', link: WEB_STORE_URL },
      { text: 'Privacy Policy', link: '/privacy' },
      { text: 'Changelog', link: '/changelog' },
    ],
    socialLinks: [{ icon: 'github', link: REPO_URL }],
    footer: {
      message:
        'Built with Claude Code by <a href="https://visnalize.com">Visnalize</a>',
    },
  },
});
