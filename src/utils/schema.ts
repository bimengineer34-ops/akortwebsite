/**
 * schema.org JSON-LD üreticileri. Doğrulanmamış alanlar (adres, telefon, logo, sosyal hesaplar)
 * production'da otomatik olarak dışarıda bırakılır.
 */
import { site } from '@/data/site';
import { publishable } from './verified';

type JsonLd = Record<string, unknown>;

const compact = (obj: JsonLd): JsonLd =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const organizationSchema = (siteUrl: URL): JsonLd => {
  const email = publishable(site.contact.email);
  const phone = publishable(site.contact.phone);
  const sameAs = site.social
    .map((s) => publishable(s.href))
    .filter((href): href is string => !!href && href !== '#');

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': new URL('/#organization', siteUrl).href,
    name: site.name,
    slogan: site.slogan,
    url: siteUrl.href,
    logo: new URL('/favicon/icon-512.png', siteUrl).href,
    email,
    telephone: phone,
    sameAs: sameAs.length ? sameAs : undefined,
  });
};

export const websiteSchema = (siteUrl: URL): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': new URL('/#website', siteUrl).href,
  name: site.name,
  url: siteUrl.href,
  inLanguage: 'tr-TR',
  publisher: { '@id': new URL('/#organization', siteUrl).href },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: new URL('/arama?q={search_term_string}', siteUrl).href },
    'query-input': 'required name=search_term_string',
  },
});

export interface Crumb {
  label: string;
  href: string;
}

export const breadcrumbSchema = (crumbs: Crumb[], siteUrl: URL): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.label,
    item: new URL(c.href, siteUrl).href,
  })),
});

export const serviceSchema = (opts: { name: string; description: string; url: URL; siteUrl: URL }): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: opts.name,
  description: opts.description,
  url: opts.url.href,
  provider: { '@id': new URL('/#organization', opts.siteUrl).href },
  areaServed: 'TR',
});

export const blogPostingSchema = (opts: {
  title: string;
  description: string;
  url: URL;
  image?: string;
  datePublished: Date;
  dateModified?: Date;
  author: string;
  siteUrl: URL;
}): JsonLd =>
  compact({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: opts.url.href,
    image: opts.image,
    datePublished: opts.datePublished.toISOString(),
    dateModified: (opts.dateModified ?? opts.datePublished).toISOString(),
    author: { '@type': 'Organization', name: opts.author },
    publisher: { '@id': new URL('/#organization', opts.siteUrl).href },
    inLanguage: 'tr-TR',
  });

export const faqSchema = (items: { question: string; answer: string }[]): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((q) => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: { '@type': 'Answer', text: q.answer },
  })),
});

export const creativeWorkSchema = (opts: { name: string; description: string; url: URL; siteUrl: URL }): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'CreativeWork',
  name: opts.name,
  description: opts.description,
  url: opts.url.href,
  creator: { '@id': new URL('/#organization', opts.siteUrl).href },
});
