/**
 * Site içi arama indeksi — build sırasında statik JSON olarak üretilir (/arama-index.json).
 * Yalnızca yayınlanmış içerik girer (taslaklar production'da indekse alınmaz). Bağımlılık yok;
 * ileride Pagefind'e geçilirse bu dosya kaldırılır.
 */
import { workSteps } from '@/data/workModel';
import type { APIRoute } from 'astro';
import { mainNav } from '@/data/navigation';
import { serviceCatalog, sectorCatalog, serviceHref, sectorHref, pillarTitles, navLabel } from '@/data/serviceCatalog';
import { getBlogPosts, postHref } from '@/utils/blog';
import { getPublished } from '@/utils/content';
import { site } from '@/data/site';

export interface SearchDoc {
  title: string;
  url: string;
  type: 'Sayfa' | 'Hizmet' | 'Uzmanlık' | 'Blog' | 'Proje';
  text: string;
}

const pageDescriptions: Record<string, string> = {
  '/': site.defaultDescription,
  '/hakkimizda': 'Misyonumuz, vizyonumuz, değerlerimiz ve mühendislik yaklaşımımız.',
  '/calisma-modeli': 'Çalışma modelimiz: ihtiyaç analizi, strateji, tasarım koordinasyonu, teknik kontrol ve işletme optimizasyonu.',
  '/hizmetler': 'Mühendislik danışmanlığı, BIM, MEP, enerji, maliyet ve teknik proje yönetimi hizmetlerimiz.',
  '/uzmanlik-alanlari': 'Sağlık, eğitim, karma kullanım, ticari, kampüs ve kamu yapılarında uzmanlık.',
  '/projeler': 'Mühendislik danışmanlığı, BIM ve enerji projelerimiz.',
  '/blog': 'BIM, MEP, enerji verimliliği ve teknik danışmanlık üzerine teknik yazılar.',
  '/iletisim': 'Hizmet talep formu ve iletişim.',
};

export const GET: APIRoute = async () => {
  const docs: SearchDoc[] = [];

  mainNav.forEach((n) => docs.push({ title: n.label, url: n.href, type: 'Sayfa', text: pageDescriptions[n.href] ?? '' }));

  docs.push({ title: 'Çalışma Modelimiz', url: '/calisma-modeli', type: 'Sayfa', text: `${pageDescriptions['/calisma-modeli']} ${workSteps.map((w) => `${w.title} ${w.summary} ${w.activities.join(' ')}`).join(' ')}` });

  serviceCatalog.forEach((s) =>
    docs.push({
      title: s.title,
      url: serviceHref(s.slug),
      type: 'Hizmet',
      text: `${s.summary} ${pillarTitles[s.pillar]} ${navLabel(s)} ${s.intro.join(' ')} ${s.scope.join(' ')} ${s.deliverables.join(' ')} ${s.faq.map((f) => f.q).join(' ')}`,
    }),
  );

  sectorCatalog.forEach((s) =>
    docs.push({
      title: s.title,
      url: sectorHref(s.slug),
      type: 'Uzmanlık',
      text: `${s.summary} ${s.intro.join(' ')} ${s.challenges.map((c) => `${c.title} ${c.text}`).join(' ')}`,
    }),
  );

  (await getBlogPosts()).forEach((p) =>
    docs.push({ title: p.data.title, url: postHref(p), type: 'Blog', text: `${p.data.description} ${p.data.category} ${p.data.tags.join(' ')}` }),
  );

  (await getPublished('projects')).forEach((p) =>
    docs.push({ title: p.data.title, url: `/projeler/${p.id}`, type: 'Proje', text: p.data.summary }),
  );

  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
