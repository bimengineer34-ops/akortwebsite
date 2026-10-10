// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { defineMdastPlugin } from 'satteri';

/** Editör hesabı ele geçirilse bile siteye kod enjekte edilemesin: ham HTML metne çevrilir, tehlikeli URL şemaları '#' olur. */
const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;
const safeMarkdown = defineMdastPlugin({
  name: 'akort-safe-markdown',
  html(node, ctx) {
    ctx.replaceNode(node, { type: 'text', value: node.value });
  },
  link(node, ctx) {
    if (UNSAFE_URL.test(node.url)) ctx.replaceNode(node, { ...node, url: '#' });
  },
  image(node, ctx) {
    if (/^\s*(javascript|vbscript):/i.test(node.url)) ctx.replaceNode(node, { ...node, url: '' });
  },
});

// TODO-CONTENT: Domain doğrulanmadı. Canlıya çıkmadan önce PUBLIC_SITE_URL ile gerçek domain verilmeli.
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://www.akortmuhendislik.com';

/** @param {'latin' | 'latin-ext'} subset */
const jakartaSrc = (subset) =>
  `@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-${subset}-wght-normal.woff2`;

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // Yönetim paneli "Yayınla" derlemesi geçici klasöre yapılır, başarılıysa dist ile atomik değiştirilir (server/lib/build.mjs)
  outDir: process.env.ASTRO_OUT_DIR ?? 'dist',
  trailingSlash: 'never',
  // Güvenlik: Markdown içindeki ham HTML (<script>, onerror=, <iframe>) ve javascript: bağlantıları çıktıya geçmez (aşağıdaki eklenti).
  markdown: { processor: satteri({ mdastPlugins: [safeMarkdown] }) },
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  integrations: [
    sitemap({
      // Etiket sayfaları noindex.
      // Arama ve onaylanmamış yasal metinler (TODO-CONTENT) de noindex.
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/blog/etiket/') &&
        !page.includes('/projeler/ornek-') &&
        !/\/(arama|bim|kvkk|gizlilik-politikasi|cerez-tercihleri)$/.test(page.replace(/\/$/, '')),
    }),
  ],
  // Geçici font seçimi: Plus Jakarta Sans (OFL). Kullanıcı onayı bekleniyor — değiştirmek için yalnızca bu blok güncellenir.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Plus Jakarta Sans',
      cssVariable: '--font-jakarta',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: [jakartaSrc('latin')],
            weight: '200 800',
            style: 'normal',
            display: 'swap',
            unicodeRange: [
              'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
            ],
          },
          {
            src: [jakartaSrc('latin-ext')],
            weight: '200 800',
            style: 'normal',
            display: 'swap',
            unicodeRange: [
              'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
            ],
          },
        ],
      },
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
