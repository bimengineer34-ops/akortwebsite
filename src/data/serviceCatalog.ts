import { muhendislikServices } from './serviceContent/muhendislik';
import { bimServices } from './serviceContent/bim';
import { enerjiServices } from './serviceContent/enerji';
import { maliyetServices } from './serviceContent/maliyet';
import { yazilimServices } from './serviceContent/yazilim';
import { sectorEntries } from './serviceContent/sectors';
import { pillarTitles, type PillarKey, type SectorEntry, type ServiceEntry } from './serviceContent/types';

export { pillarTitles };
export type { PillarKey, SectorEntry, ServiceEntry };

/**
 * Hizmet kataloğu — her kayıt kendi sayfasına sahiptir (/hizmetler/<slug>).
 * Hiyerarşi: pillar (5 ana başlık) → hub (alt hizmet grupları) → topic (konu sayfaları).
 */
export const serviceCatalog: ServiceEntry[] = [...muhendislikServices, ...bimServices, ...enerjiServices, ...maliyetServices, ...yazilimServices];
export const sectorCatalog: SectorEntry[] = sectorEntries;

const bySlug = new Map(serviceCatalog.map((s) => [s.slug, s]));

// ---- Build zamanı tutarlılık denetimi: kopuk/yinelenen bağlantılar derlemeyi durdurur.
/** Her hizmet ve sektör sayfasında en az bu kadar sık sorulan soru bulunmalıdır (panelden soru silinirse derleme uyarır). */
const MIN_FAQ = 5;
{
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const s of serviceCatalog) {
    if (seen.has(s.slug)) problems.push(`yinelenen slug: ${s.slug}`);
    seen.add(s.slug);
    if (s.parent && !bySlug.has(s.parent)) problems.push(`${s.slug}: parent bulunamadı → ${s.parent}`);
    for (const r of s.related) if (!bySlug.has(r)) problems.push(`${s.slug}: related bulunamadı → ${r}`);
    if (s.summary.length > 175) problems.push(`${s.slug}: summary çok uzun (${s.summary.length})`);
    if (s.faq.length < MIN_FAQ) problems.push(`${s.slug}: en az ${MIN_FAQ} SSS gerekli (şu an ${s.faq.length})`);
  }
  for (const sec of sectorCatalog) {
    for (const r of sec.services) if (!bySlug.has(r)) problems.push(`sektör ${sec.slug}: servis bulunamadı → ${r}`);
    if (sec.faq.length < MIN_FAQ) problems.push(`sektör ${sec.slug}: en az ${MIN_FAQ} SSS gerekli (şu an ${sec.faq.length})`);
  }
  for (const k of Object.keys(pillarTitles) as PillarKey[]) {
    if (serviceCatalog.filter((s) => s.pillar === k && s.kind === 'pillar').length !== 1) problems.push(`pillar ${k}: tam 1 pillar kaydı olmalı`);
  }
  if (problems.length) throw new Error(`[serviceCatalog]\n - ${problems.join('\n - ')}`);
}

export const serviceHref = (slug: string) => `/hizmetler/${slug}`;
export const sectorHref = (slug: string) => `/uzmanlik-alanlari/${slug}`;
export const getService = (slug: string): ServiceEntry => {
  const s = bySlug.get(slug);
  if (!s) throw new Error(`[serviceCatalog] bulunamadı: ${slug}`);
  return s;
};
export const getSector = (slug: string) => sectorCatalog.find((s) => s.slug === slug);
export const childrenOf = (slug: string) => serviceCatalog.filter((s) => s.parent === slug);
export const pillarEntry = (pillar: PillarKey) => serviceCatalog.find((s) => s.pillar === pillar && s.kind === 'pillar')!;
export const navLabel = (s: ServiceEntry) => s.label ?? s.title;

/** Kök → s zinciri (breadcrumb): [pillar, hub, topic] */
export const chainOf = (slug: string): ServiceEntry[] => {
  const chain: ServiceEntry[] = [];
  let cur: ServiceEntry | undefined = bySlug.get(slug);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent ? bySlug.get(cur.parent) : undefined;
  }
  return chain;
};

export interface ServiceGroup {
  title: string;
  /** Grup başlığı bir sayfaya gidiyorsa (hub) */
  href?: string;
  items: ServiceEntry[];
}

/**
 * Bir ana başlığın alt hizmetleri, gruplanmış halde (mega menü, hizmetler dizini, üst sayfa listeleri).
 * - Hub'ları olan başlıkta (Mühendislik): her hub bir grup, altında kendi konuları.
 * - Diğerlerinde: `group` alanına göre gruplar.
 */
export const groupsOf = (pillar: PillarKey): ServiceGroup[] => {
  const root = pillarEntry(pillar);
  const direct = childrenOf(root.slug);
  const hubs = direct.filter((d) => d.kind === 'hub');
  if (hubs.length) {
    return hubs.map((h) => ({ title: navLabel(h), href: serviceHref(h.slug), items: childrenOf(h.slug) }));
  }
  const map = new Map<string, ServiceEntry[]>();
  for (const d of direct) {
    const g = d.group ?? 'Hizmetler';
    map.set(g, [...(map.get(g) ?? []), d]);
  }
  return [...map.entries()].map(([title, items]) => ({ title, items }));
};

/** Hub/pillar sayfasında gösterilecek alt hizmet grupları */
export const groupsForPage = (s: ServiceEntry): ServiceGroup[] => {
  if (s.kind === 'pillar') return groupsOf(s.pillar);
  const kids = childrenOf(s.slug);
  return kids.length ? [{ title: 'Alt Hizmetler', items: kids }] : [];
};

export const pillarOrder: PillarKey[] = ['muhendislik', 'bim', 'enerji', 'maliyet', 'yazilim'];
