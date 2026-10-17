import type { IconName } from '@/components/common/icons';

export type PillarKey = 'muhendislik' | 'bim' | 'enerji' | 'maliyet' | 'yazilim';

/**
 * Hizmet sayfası içerik kaydı. Her kayıt kendi sayfasına sahiptir: /hizmetler/<slug>
 *
 * İçerik ilkeleri (NO_FAKE_DATA): metinler konunun genel mühendislik tanımı, kapsamı ve tipik çıktılarıdır.
 * Firmaya ait rakam, referans, sertifika, müşteri veya "X yıllık deneyim" gibi doğrulanamayan iddia içermez.
 * Firma onayı: bkz. docs/TODO.md → "Hizmet içerikleri" (metinler yayın öncesi firma tarafından gözden geçirilmelidir).
 */
export interface ServiceEntry {
  slug: string;
  title: string;
  /** Menü / kart için kısa ad (yoksa title) */
  label?: string;
  kind: 'pillar' | 'hub' | 'topic';
  pillar: PillarKey;
  /** Üst hizmet (breadcrumb ve "alt hizmetler" listesi için) */
  parent?: string;
  /** Üst sayfadaki alt gruplama başlığı */
  group?: string;
  icon: IconName;
  /** 1 cümle; kart açıklaması, meta description ve arama özeti (≤ 160 karakter) */
  summary: string;
  /** Giriş paragrafları (konu nedir, neden önemlidir) */
  intro: string[];
  /** Kapsam maddeleri */
  scope: string[];
  /** Tipik çıktılar / teslimatlar */
  deliverables: string[];
  /** Ne zaman / kimler için */
  when: string[];
  /** İlgili standart ve çerçeveler (isteğe bağlı) */
  standards?: string[];
  faq: { q: string; a: string }[];
  /** İlgili hizmet slug'ları */
  related: string[];
}

export interface SectorEntry {
  slug: string;
  title: string;
  /** Proje filtresi anahtarı (src/data/sectors.ts) */
  sectorKey: string;
  icon: IconName;
  summary: string;
  intro: string[];
  /** Bu yapı tipinde öne çıkan mühendislik konuları */
  challenges: { title: string; text: string }[];
  /** AKORT'un bu sektörde sunabileceği hizmetler (slug) */
  services: string[];
  faq: { q: string; a: string }[];
}

export const pillarTitles: Record<PillarKey, string> = {
  muhendislik: 'Mühendislik Danışmanlığı',
  bim: 'BIM & Dijital Mühendislik',
  enerji: 'Enerji & Bina Performansı',
  maliyet: 'Maliyet & Teknik Danışmanlık',
  yazilim: 'Yazılım & Dijital Çözümler',
};
