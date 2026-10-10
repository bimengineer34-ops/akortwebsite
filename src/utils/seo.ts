import { site } from '@/data/site';

export interface SeoProps {
  /** Sayfa başlığı; şablon otomatik eklenir. Ana sayfada boş bırakılır. */
  title?: string;
  description?: string;
  /** Varsayılan: geçerli URL */
  canonical?: string | URL;
  /** OG görseli (mutlak veya site-relative). TODO-ASSET: varsayılan OG görseli bekleniyor. */
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: Date;
  modifiedTime?: Date;
}

export const buildTitle = (title?: string): string =>
  title ? site.titleTemplate.replace('%s', title) : site.defaultTitle;

/** trailingSlash: 'never' + build.format: 'file' ile tutarlı canonical (.html ve sondaki / atılır). */
export const buildCanonical = (pathname: string, siteUrl: URL | undefined): URL | undefined => {
  if (!siteUrl) return undefined;
  const clean = pathname.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '');
  return new URL(clean || '/', siteUrl);
};
