import type { CollectionEntry } from 'astro:content';
import type { IconName } from '@/components/common/icons';
import { blogCategories } from '@/data/blog';
import { getPublished } from './content';
import { readingTime } from './readingTime';
import { slugify } from './slug';

export type BlogPost = CollectionEntry<'blog'>;
export type BlogCategory = (typeof blogCategories)[number];

export const BLOG_PAGE_SIZE = 6;

/** Yayınlanmış yazılar, en yeni önce (development'ta taslaklar dahil). */
export const getBlogPosts = async (): Promise<BlogPost[]> =>
  (await getPublished('blog')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

export const postHref = (post: BlogPost) => `/blog/${post.id}`;
export const postExcerpt = (post: BlogPost) => post.data.excerpt ?? post.data.description;
export const postReadingTime = (post: BlogPost) => readingTime(post.body);

export const categorySlug = (category: string) => slugify(category);
export const categoryHref = (category: string) => `/blog/kategori/${categorySlug(category)}`;
export const tagSlug = (tag: string) => slugify(tag);
export const tagHref = (tag: string) => `/blog/etiket/${tagSlug(tag)}`;
export const pageHref = (page: number) => (page <= 1 ? '/blog' : `/blog/sayfa/${page}`);

/** Kategori ikonları — yalnızca Asset Pack (+ onay bekleyen) ikonlar. */
export const categoryIcons: Record<BlogCategory, IconName> = {
  'BIM & Dijital Mühendislik': 'services/bim-digital',
  MEP: 'services/mep',
  Enerji: 'services/energy',
  'Bina Performansı': 'services/building-performance',
  'Teknik Danışmanlık': 'services/technical-spec',
  'Maliyet & Hakediş': 'services/cost',
  'Proje Yönetimi': 'services/project-management',
  Sürdürülebilirlik: 'expertise/optimization',
  'Teknik Rehberler': 'process/report',
};

/** Kategori → yazı sayısı (yalnızca en az 1 yazısı olanlar, Master Prompt §19 sırası). */
export const categoryCounts = (posts: BlogPost[]) =>
  blogCategories
    .map((category) => ({ category, count: posts.filter((p) => p.data.category === category).length }))
    .filter((c) => c.count > 0);

/** Etiket bulutu — kullanım sıklığına göre. */
export const tagCloud = (posts: BlogPost[]) => {
  const counts = new Map<string, number>();
  posts.forEach((p) => p.data.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr')).map(([tag]) => tag);
};

export const featuredPost = (posts: BlogPost[]) => posts.find((p) => p.data.featured) ?? posts[0];
export const popularPosts = (posts: BlogPost[], limit = 4) => posts.filter((p) => p.data.popular).slice(0, limit);
