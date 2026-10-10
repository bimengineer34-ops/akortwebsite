import { getCollection } from 'astro:content';

type PublishableCollection = 'blog' | 'projects';

/**
 * Koleksiyon girdilerini döndürür; production'da `draft: true` olanlar gizlenir (NO_FAKE_DATA: referans örnekleri yayınlanmaz).
 * Not: sayfa/metin içeriği için `src/utils/overrides.ts` (yönetim paneli köprüsü) kullanılır.
 */
export const getPublished = async <C extends PublishableCollection>(name: C) => {
  const entries = await getCollection(name);
  return import.meta.env.PROD ? entries.filter((e) => !e.data.draft) : entries;
};
