import type { IconName } from '@/components/common/icons';
import type { SectorKey } from './sectors';
import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

/** Projeler sayfası metinleri — onaylı projects-approved-reference.jpeg'den. */

export const projectsHero = ov('projectsPage.projectsHero', {
  title: 'Projeler',
  lead: 'AKORT Mühendislik olarak, farklı ölçek ve fonksiyonlardaki projelerde bütüncül mühendislik danışmanlığı sunuyor, daha verimli, daha sürdürülebilir ve daha yaşanabilir yapılar için değer katıyoruz.',
  annotations: [['Daha Verimli', 'Yapılar'], ['Sürdürülebilir', 'Yaşam Alanları'], ['Geleceğe', 'Değer Katan', 'Projeler']],
});

export const projectsList = ov('projectsPage.projectsList', {
  eyebrow: 'Proje Kategorileri',
  title: 'Tüm Projelerimizi Keşfedin',
  lead: 'Kamu, sağlık, eğitim, ticari ve karma kullanım yapılarında edindiğimiz deneyimle, projeleriniz için doğru mühendislik çözümleri sunuyoruz.',
  searchPlaceholder: 'Proje ara...',
  /** Production'da doğrulanmış proje yokken gösterilen boş durum */
  empty: {
    title: 'Proje portföyümüz hazırlanıyor',
    text: 'Tamamlanan projelerimize ait doğrulanmış case study içerikleri yakında burada yayınlanacak. Projenizle ilgili bilgi almak için bizimle iletişime geçebilirsiniz.',
  },
  noResults: 'Seçilen kategori veya aramayla eşleşen proje bulunamadı.',
});

/** Filtre çipleri — referanstaki sıra. */
export const projectFilters: { key: SectorKey | 'tumu' | 'yazilim'; label: string; icon: IconName }[] = ov('projectsPage.projectFilters', [
  { key: 'tumu', label: 'Tümü', icon: '_pending/grid' },
  { key: 'saglik', label: 'Sağlık Yapıları', icon: 'expertise/health' },
  { key: 'egitim', label: 'Eğitim Yapıları', icon: 'expertise/education' },
  { key: 'kamu', label: 'Kamu Yapıları', icon: 'expertise/campus' },
  { key: 'ticari', label: 'Ticari Yapılar', icon: 'expertise/commercial' },
  { key: 'karma', label: 'Karma Kullanım', icon: '_pending/layers' },
  { key: 'yazilim', label: 'Yazılım Projeleri', icon: '_pending/code' },
]);

export const spotlightSection = ov('projectsPage.spotlightSection', {
  eyebrow: 'Öne Çıkan Proje',
  cta: 'Proje Detayını İncele',
  /** TODO-CONTENT: Öne çıkan proje açıklaması proje kaydından gelir; bu metin referanstaki örnek */
  annotations: [['BIM Koordinasyonu', 've Entegrasyonu'], ['Enerji Verimli', 'Tasarım Çözümleri'], ['Teknik Proje Yönetimi'], ['Yaşam Döngüsü', 'Maliyet Analizi']],
});

export interface Metric {
  icon: IconName;
  value: Verifiable<string>;
  label: string;
}

/**
 * TODO-CONTENT: "Rakamlarla AKORT" değerleri referans görselden — DOĞRULANMADI.
 * Her değer ayrı ayrı doğrulanınca görünür; hiçbiri doğrulanmamışsa bölüm production'da render edilmez.
 */
export const projectMetrics = ov('projectsPage.projectMetrics', {
  eyebrow: 'Rakamlarla AKORT',
  title: 'Deneyimimizle Daha Fazla Değer',
  lead: 'Farklı ölçek ve tipolojilerdeki projelerde edindiğimiz deneyimle, her zaman daha iyi çözümler için çalışıyoruz.',
  items: [
    { icon: 'expertise/commercial', value: unverified('50+'), label: 'Tamamlanan Proje' },
    { icon: '_pending/area', value: unverified('2M+ m²'), label: 'Toplam Proje Alanı' },
    { icon: '_pending/layers', value: unverified('5'), label: 'Ana Proje Kategorisi' },
    { icon: 'services/energy', value: unverified('%30+'), label: 'Ortalama Enerji Tasarrufu' },
  ] satisfies Metric[],
});

export const projectsCta = ov('projectsPage.projectsCta', {
  eyebrow: 'Projeniz İçin Doğru Teknik Ortak',
  title: 'Sizin Projeniz de Burada Yer Alabilir.',
  text: 'Projelerinizde daha verimli, daha sürdürülebilir ve daha yüksek değer yaratan çözümler için bizimle iletişime geçin.',
  button: { label: 'İletişime Geçin', href: '/iletisim' },
  features: [
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: '_pending/shield', label: 'Güvenilir İş Ortağı' },
    { icon: 'services/energy', label: 'Sürdürülebilir Çözümler' },
  ] satisfies { icon: IconName; label: string }[],
});
