import { defineConfig } from 'vite';
import { SITE } from './src/config.js';

// Public base URL for absolute OG links (WhatsApp needs an absolute og:image).
const siteUrl = (SITE.url
  || process.env.URL                                   // Netlify
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL)
  || '').replace(/\/$/, '');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export default defineConfig({
  build: {
    assetsDir: 'static',
    target: 'es2019',
    cssCodeSplit: false,
  },
  plugins: [{
    name: 'site-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('%SITE_TITLE%', esc(SITE.title))
        .replaceAll('%SITE_DESCRIPTION%', esc(SITE.description))
        .replaceAll('%THEME_COLOR%', esc(SITE.themeColor))
        .replaceAll('%OG_IMAGE%', esc(siteUrl + '/og.jpg'));
    },
  }],
  server: { host: true },
});
