/**
 * Site görselleri (ChatGPT ile üretilmiş dekoratif görseller; gerçek proje fotoğrafı DEĞİLDİR).
 * Dosya adları SEO uyumludur. Üretim kaynağı/ham dosyalar: docs/IMAGE_PACKAGE_PROMPT.md.
 * Proje kartları gerçek proje görseli gelene kadar yer tutucu kalır (NO_FAKE_DATA).
 *
 * Yönetim panelinden değiştirme: "Sayfa metinleri › Genel ve Menü › Site görselleri" belgesinde her yer için
 * medya kütüphanesinden görsel seçilebilir. Seçilen dosya sunucu tarafından `src/assets/images/uploads/` altına
 * kopyalanır ve derlemede Astro'nun görsel optimizasyonundan geçer. Boş bırakılan yer yerleşik görseli kullanır.
 */
import type { ImageMetadata } from 'astro';
import type { PillarKey } from '@/data/serviceContent/types';
import { ov } from '@/utils/overrides';

import heroHakkimizda from '@/assets/images/about/akort-muhendislik-danismanligi-firmasi-hakkimizda-hero.png';
import heroHizmetler from '@/assets/images/services/akort-muhendislik-danismanligi-hizmetleri-hero.png';
import heroUzmanlik from '@/assets/images/expertise/akort-yapi-tipleri-uzmanlik-alanlari-hero.png';
import heroProjeler from '@/assets/images/projects/akort-muhendislik-projeleri-referanslar-hero.png';
import heroBlog from '@/assets/images/blog/akort-bim-enerji-teknik-blog-hero.png';
import heroIletisim from '@/assets/images/contact/akort-muhendislik-danismanligi-iletisim-hero.png';
import heroCalismaModeli from '@/assets/images/shared/akort-calisma-modeli-proje-yonetimi-hero.png';
import introOfis from '@/assets/images/shared/akort-ofis-binasi-bim-modelleme-intro.png';
import introHastane from '@/assets/images/shared/akort-hastane-binasi-mep-tasarim-intro.png';
import introKarma from '@/assets/images/shared/akort-karma-kullanimli-yapi-koordinasyon-intro.png';
import ctaBanner from '@/assets/images/shared/akort-cta-bina-silueti-bim-banner.png';
import telKafesYaklasim from '@/assets/images/about/akort-bim-tel-kafes-bina-yaklasimimiz.png';
import telKafesOneCikan from '@/assets/images/services/akort-bim-tel-kafes-bina-one-cikan-hizmet.png';
import hizmetMuhendislik from '@/assets/images/services/akort-muhendislik-danismanligi-hizmet-gorseli.png';
import hizmetBim from '@/assets/images/services/akort-bim-dijital-muhendislik-hizmet-gorseli.png';
import hizmetEnerji from '@/assets/images/services/akort-enerji-bina-performansi-hizmet-gorseli.png';
import hizmetMaliyet from '@/assets/images/services/akort-maliyet-teknik-danismanlik-hizmet-gorseli.png';
import sektorSaglik from '@/assets/images/expertise/saglik-yapilari-hastane-muhendislik-danismanligi.png';

/** Panelden yüklenip src/assets/images/uploads altına kopyalanan görseller (dosya adına göre) */
const uploaded = import.meta.glob<ImageMetadata>('/src/assets/images/uploads/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const fromUploads = (ref: string | undefined): ImageMetadata | undefined => {
  if (!ref) return undefined;
  const name = ref.split('/').pop() ?? '';
  return uploaded[`/src/assets/images/uploads/${name}`];
};

/** Panelde medya kütüphanesinden seçilebilen yerler. Boş = yerleşik görsel. */
const slots = ov('images.siteImages', {
  heroHakkimizda: '',
  heroHizmetler: '',
  heroUzmanlik: '',
  heroProjeler: '',
  heroBlog: '',
  heroIletisim: '',
  heroCalismaModeli: '',
  introAnasayfa: '',
  introHakkimizda: '',
  introHizmetler: '',
  introUzmanlik: '',
  introIletisim: '',
  ctaBanner: '',
  telKafesYaklasim: '',
  telKafesOneCikan: '',
  hizmetMuhendislik: '',
  hizmetBim: '',
  hizmetEnerji: '',
  hizmetMaliyet: '',
  hizmetYazilim: '',
  sektorSaglikYapilari: '',
  sektorEgitimYapilari: '',
  sektorKarmaKullanim: '',
  sektorTicariYapilar: '',
  sektorKampusler: '',
  sektorKamuYapilari: '',
  sektorEndustriyelYapilar: '',
  sektorMevcutYapilar: '',
});
type Slot = keyof typeof slots;
const pick = (slot: Slot, fallback: ImageMetadata): ImageMetadata => fromUploads(slots[slot]) ?? fallback;

export const heroImages = {
  hakkimizda: pick('heroHakkimizda', heroHakkimizda),
  hizmetler: pick('heroHizmetler', heroHizmetler),
  uzmanlik: pick('heroUzmanlik', heroUzmanlik),
  projeler: pick('heroProjeler', heroProjeler),
  blog: pick('heroBlog', heroBlog),
  iletisim: pick('heroIletisim', heroIletisim),
  calismaModeli: pick('heroCalismaModeli', heroCalismaModeli),
};

/** Her sayfanın intro görseli ayrı seçilebilir; seçilmezse yerleşik üç görselden biri kullanılır. */
export const introImages = {
  ofis: introOfis,
  hastane: introHastane,
  karma: introKarma,
  anasayfa: pick('introAnasayfa', introKarma),
  hakkimizda: pick('introHakkimizda', introOfis),
  hizmetler: pick('introHizmetler', introHastane),
  uzmanlik: pick('introUzmanlik', introHastane),
  iletisim: pick('introIletisim', introOfis),
};
export const ctaImage: ImageMetadata = pick('ctaBanner', ctaBanner);
export const wireframeImages = {
  yaklasim: pick('telKafesYaklasim', telKafesYaklasim),
  oneCikanHizmet: pick('telKafesOneCikan', telKafesOneCikan),
};

/** Ana hizmet grubu görselleri (hizmet detay sayfası hero paneli) */
export const pillarImages: Record<PillarKey, { image: ImageMetadata; alt: string }> = {
  muhendislik: { image: pick('hizmetMuhendislik', hizmetMuhendislik), alt: 'Mimari, yapı ve MEP katmanlarıyla modelleme gösteren ofis binası' },
  bim: { image: pick('hizmetBim', hizmetBim), alt: 'Gerçek cepheyle birleşen BIM tel kafes modeli' },
  enerji: { image: pick('hizmetEnerji', hizmetEnerji), alt: 'Güneş kırıcılı enerji verimli bina cephesi' },
  maliyet: { image: pick('hizmetMaliyet', hizmetMaliyet), alt: 'Yapım aşamasındaki betonarme bina iskeleti' },
  // TODO-ASSET: yazılım hizmetine özel görsel gelene kadar BIM/dijital görseli kullanılır (panelden "Site görselleri › hizmetYazilim" ile değiştirilir)
  yazilim: { image: pick('hizmetYazilim', hizmetBim), alt: 'Bina modeli ve dijital yazılım çözümleri' },
};

/** Sektör görselleri — yalnızca görseli olan sektörler; diğerleri yer tutucu panel kullanır. */
const sectorDefs: { slug: string; slot: Slot; fallback?: ImageMetadata; alt: string }[] = [
  { slug: 'saglik-yapilari', slot: 'sektorSaglikYapilari', fallback: sektorSaglik, alt: 'Modern hastane binası dış cephesi ve BIM tel kafes katmanı' },
  { slug: 'egitim-yapilari', slot: 'sektorEgitimYapilari', alt: 'Eğitim yapısı ve kampüs dış görünümü' },
  { slug: 'karma-kullanim', slot: 'sektorKarmaKullanim', alt: 'Konut ve ticari işlevleri birleştiren karma kullanımlı yapı' },
  { slug: 'ticari-yapilar', slot: 'sektorTicariYapilar', alt: 'Camlı cepheli ofis ve ticari yapı' },
  { slug: 'kampusler', slot: 'sektorKampusler', alt: 'Birden çok binadan oluşan kampüs yerleşkesi' },
  { slug: 'kamu-yapilari', slot: 'sektorKamuYapilari', alt: 'Kamu binası dış görünümü' },
  { slug: 'endustriyel-yapilar', slot: 'sektorEndustriyelYapilar', alt: 'Endüstriyel üretim tesisi' },
  { slug: 'mevcut-yapilar', slot: 'sektorMevcutYapilar', alt: 'Yenileme ve enerji iyileştirmesi yapılan mevcut yapı' },
];
export const sectorImages: Partial<Record<string, { image: ImageMetadata; alt: string }>> = Object.fromEntries(
  sectorDefs.flatMap((d) => {
    const image = fromUploads(slots[d.slot]) ?? d.fallback;
    return image ? [[d.slug, { image, alt: d.alt }]] : [];
  }),
);
