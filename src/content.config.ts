import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { sectorKeys } from '@/data/sectors';
import { blogCategories } from '@/data/blog';


/**
 * NO_FAKE_DATA: Sayısal / iddia içeren her alan doğrulama bayrağı taşır.
 * `verified: false` olan değerler production'da render edilmez (bkz. src/utils/verified.ts).
 */
const verifiable = <T extends z.ZodType>(schema: T) =>
  z.object({
    value: schema,
    verified: z.boolean().default(false),
    note: z.string().optional(),
  });

const seoOverrides = z
  .object({
    title: z.string().max(70).optional(),
    description: z.string().max(170).optional(),
    noindex: z.boolean().default(false),
  })
  .optional();

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(110),
      /** Meta description (≤170) */
      description: z.string().min(50).max(170),
      /** Kartlarda gösterilen daha uzun özet (verilmezse description kullanılır) */
      excerpt: z.string().max(260).optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.enum(blogCategories),
      tags: z.array(z.string()).default([]),
      cover: image().optional(), // TODO-ASSET: kapak görselleri bekleniyor
      coverAlt: z.string().optional(),
      author: z.string().default('AKORT Mühendislik'),
      /** Blog sayfası 'Öne Çıkan Yazı' */
      featured: z.boolean().default(false),
      /** Yan paneldeki 'Popüler Yazılar' — analitik yokken editör seçimi */
      popular: z.boolean().default(false),
      draft: z.boolean().default(true),
      relatedServices: z.array(reference('services')).default([]),
      seo: seoOverrides,
    }).refine((d) => !d.cover || !!d.coverAlt, {
      message: 'cover verildiğinde coverAlt zorunludur (erişilebilirlik).',
      path: ['coverAlt'],
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().max(240),
      sector: z.enum(sectorKeys),
      location: verifiable(z.string()).optional(),
      year: verifiable(z.string()).optional(), // "2022 – 2024" gibi aralıklar için string
      area: verifiable(z.string()).optional(), // "358.000 m²"
      capacity: verifiable(z.string()).optional(), // ör. yatak kapasitesi
      role: z.string().optional(), // AKORT rolü
      services: z.array(reference('services')).default([]),
      problem: z.string().optional(),
      challenge: z.string().optional(),
      approach: z.string().optional(),
      solution: z.string().optional(),
      bimScope: z.string().optional(),
      energyScope: z.string().optional(),
      costScope: z.string().optional(),
      results: z.array(verifiable(z.string())).default([]),
      cover: image().optional(), // TODO-ASSET
      coverAlt: z.string().optional(),
      gallery: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      outputs: z.array(z.string()).default([]),
      /** BIM Viewer hazırlığı (Faz 18) — enabled olmadıkça "BIM Modelini İncele" gösterilmez. */
      bimModel: z
        .object({
          enabled: z.boolean().default(false),
          ifcUrl: z.url().optional(),
          fragmentsUrl: z.url().optional(),
        })
        .default({ enabled: false }),
      /** Ana Sayfa "Öne Çıkan Projeler" */
      featured: z.boolean().default(false),
      /** Projeler sayfası koyu "Öne Çıkan Proje" bandı (tek proje) */
      spotlight: z.boolean().default(false),
      /** Projenin ait olduğu hizmet grubu — ilgili hizmet sayfasında (ör. Yazılım) proje olarak listelenir */
      serviceGroup: z.enum(['muhendislik', 'bim', 'enerji', 'maliyet', 'yazilim']).optional(),
      draft: z.boolean().default(true),
      order: z.number().default(0),
      seo: seoOverrides,
    }),
});

/** Hizmet landing sayfalarının uzun SEO metinleri. Kart verisi src/data/services.ts içindedir. */
const services = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    pillar: z.enum(['muhendislik', 'bim', 'enerji', 'maliyet']),
    draft: z.boolean().default(true),
    seo: seoOverrides,
  }),
});

/**
 * Yasal metinler (KVKK, Gizlilik, Çerez). Metinler hukuki olduğundan firma / hukuk danışmanı tarafından sağlanır.
 * `approved: false` iken sayfa "hazırlanıyor" durumu gösterir ve noindex'tir (TODO-CONTENT).
 */
const legal = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    updatedDate: z.coerce.date().optional(),
    approved: z.boolean().default(false),
  }),
});

export const collections = { blog, projects, services, legal };
