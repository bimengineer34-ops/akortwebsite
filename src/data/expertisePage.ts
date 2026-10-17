import type { IconName } from '@/components/common/icons';
import type { SectorKey } from './sectors';
import { ov } from '@/utils/overrides';

/** Uzmanlık Alanları sayfası metinleri — onaylı expertise-approved-reference.jpeg'den. */

export const expertiseHero = ov('expertisePage.expertiseHero', {
  title: 'Uzmanlık Alanları',
  lead: 'AKORT Mühendislik olarak farklı yapı tipleri ve ölçeklerde, mühendislik disiplini, dijital teknolojiler ve sürdürülebilir yaklaşımlar ile bütüncül çözümler sunuyoruz.',
  cta: { label: 'Projeniz İçin Doğru Uzmanlığı Keşfedin', href: '#uzmanlik-alanlarimiz' },
  annotations: [['BIM Entegrasyonu', 'ile Daha İyi Tasarım'], ['Yaşam Döngüsü', 'Odaklı Çözümler'], ['Sürdürülebilir', 'Yapılar için', 'Mühendislik']],
});

export const expertiseIntro = ov('expertisePage.expertiseIntro', {
  eyebrow: 'Uzmanlık Alanlarımız',
  title: 'Daha İyi Yapılar İçin Uzman Mühendislik',
  body: 'Farklı sektörlerde edindiğimiz deneyim ve teknik bilgi birikimimizle, projelerinize özel, sürdürülebilir ve yüksek performanslı mühendislik çözümleri geliştiriyoruz. Yapıların tüm yaşam döngüsünde; tasarım, analiz, koordinasyon ve işletme süreçlerinde yanınızdayız.',
  cta: { label: 'Hakkımızda', href: '/hakkimizda' },
  iconPillars: [
    { icon: 'services/owner-advisory', label: ['Sektörel', 'Deneyim'] },
    { icon: 'services/bim-digital', label: ['Bütüncül', 'Mühendislik'] },
    { icon: 'expertise/commercial', label: ['Dijital', 'Teknolojiler'] },
    { icon: 'services/energy', label: ['Sürdürülebilir', 'Çözümler'] },
  ] satisfies { icon: IconName; label: string[] }[],
  slogan: ['Farklı', 'Yapı Tiplerinde', 'Ortak Hedef', 'Daha İyi Yaşam', 'Alanları'],
});

export interface SectorCardData {
  sector: SectorKey | 'enerji';
  title: string;
  text: string;
  icon: IconName;
  href: string;
  /** TODO-ASSET: sektör görseli */
  imageTodo: string;
}

export const expertiseSectors = ov('expertisePage.expertiseSectors', {
  eyebrow: 'Sektörel Uzmanlık',
  title: 'Uzmanlık Alanlarımız',
  lead: 'Her proje kendine özgü ihtiyaçlar barındırır. Farklı yapı tipleri için geliştirdiğimiz uzmanlık alanlarımızla, projelerinizde maksimum değer üretiyoruz.',
  primary: [
    {
      sector: 'saglik',
      title: 'Sağlık Yapıları',
      text: 'Hastaneler, tıp merkezleri ve sağlık kampüsleri için yüksek hijyen, güvenlik ve kesintisiz işletme odaklı mühendislik çözümleri.',
      icon: 'expertise/health',
      href: '/uzmanlik-alanlari/saglik-yapilari',
      imageTodo: 'sağlık yapısı görseli',
    },
    {
      sector: 'egitim',
      title: 'Eğitim Yapıları',
      text: 'Okullar, üniversiteler ve araştırma yapıları için konforlu, güvenli ve sürdürülebilir öğrenme ortamları.',
      icon: 'expertise/education',
      href: '/uzmanlik-alanlari/egitim-yapilari',
      imageTodo: 'eğitim yapısı görseli',
    },
    {
      sector: 'karma',
      title: 'Karma Kullanım Projeleri',
      text: 'Yaşam, çalışma ve sosyal alanları bir araya getiren karma projelerde entegre mühendislik çözümleri.',
      icon: 'expertise/commercial',
      href: '/uzmanlik-alanlari/karma-kullanim',
      imageTodo: 'karma kullanım görseli',
    },
    {
      sector: 'ticari',
      title: 'Ticari Yapılar',
      text: 'Ofis binaları, alışveriş merkezleri ve ticari yapılar için verimli, esnek ve işletme dostu sistem tasarımları.',
      icon: 'services/building-performance',
      href: '/uzmanlik-alanlari/ticari-yapilar',
      imageTodo: 'ticari yapı görseli',
    },
  ] satisfies SectorCardData[],
  secondary: [
    {
      sector: 'kamu',
      title: 'Kampüs ve Kamu Yapıları',
      text: 'Kamu kurumları, idari yapılar ve büyük ölçekli kampüs projeleri için uzun ömürlü ve sürdürülebilir çözümler.',
      icon: 'expertise/campus',
      href: '/uzmanlik-alanlari/kamu-yapilari',
      imageTodo: 'kampüs / kamu görseli',
    },
    {
      sector: 'mevcut',
      title: 'Mevcut Yapıların Teknik Analizi',
      text: 'Mevcut yapıların taranması, sayısallaştırılması ve teknik performans analizleri ile güvenli ve ekonomik çözümler.',
      icon: 'expertise/analysis',
      href: '/uzmanlik-alanlari/mevcut-yapilar',
      imageTodo: 'mevcut yapı / termal analiz görseli',
    },
    {
      sector: 'enerji',
      title: 'Enerji Verimliliği ve İşletme Optimizasyonu',
      text: 'Enerji analizi, performans simülasyonları ve optimizasyon çözümleri ile daha düşük işletme maliyetleri ve daha sürdürülebilir yapılar.',
      icon: 'expertise/optimization',
      href: '/hizmetler/enerji-verimliligi',
      imageTodo: 'enerji performans görseli',
    },
  ] satisfies SectorCardData[],
});

export const expertiseIntegrated = ov('expertisePage.expertiseIntegrated', {
  eyebrow: 'Entegre Uzmanlık',
  title: 'Disiplinler Arası Bakışla Güçlü Çözümler',
  items: [
    { icon: 'services/bim-digital', title: 'Tasarım Performansı', text: 'Doğru mühendislik ile daha verimli yapılar.' },
    { icon: 'services/cost', title: 'Maliyet Optimizasyonu', text: 'Yaşam döngüsü boyunca daha düşük maliyetler.' },
    { icon: 'services/energy', title: 'Sürdürülebilir İşletme', text: 'Daha düşük enerji tüketimi ve çevresel etki.' },
    { icon: 'services/clash-detection', title: 'Dijital Koordinasyon', text: 'BIM ile hatasız, uyumlu ve entegre projeler.' },
  ] satisfies { icon: IconName; title: string; text: string }[],
});

export const expertiseDisciplines = ov('expertisePage.expertiseDisciplines', {
  eyebrow: 'Çalışma Disiplinlerimiz',
  title: 'Uzman Kadromuzla Tüm Süreçlerde Yanınızdayız',
  lead: 'Projelerin tasarımından işletmesine kadar tüm aşamalarda, disiplinler arası uzmanlığımızla entegre çözümler sunuyoruz.',
  link: { label: 'Tüm Hizmetlerimiz', href: '/hizmetler' },
  items: [
    {
      icon: 'services/mep',
      title: 'Mekanik Mühendisliği',
      text: 'Isıtma, soğutma, havalandırma, sıhhi tesisat ve yangın sistemlerinde verimli tasarımlar.',
      href: '/hizmetler/mekanik-proje-danismanligi',
    },
    {
      icon: '_pending/lightning',
      title: 'Elektrik Mühendisliği',
      text: 'Güç, zayıf akım, aydınlatma ve bina otomasyon sistemleri için entegre çözümler.',
      href: '/hizmetler/elektrik-proje-danismanligi',
    },
    {
      icon: 'services/bim-digital',
      title: 'BIM ve Dijital Modelleme',
      text: '3B koordinasyon, disiplinler arası entegrasyon ve yaşam döngüsü odaklı BIM.',
      href: '/hizmetler/bim-danismanligi',
    },
    {
      icon: 'services/energy',
      title: 'Enerji Danışmanlığı',
      text: 'Enerji modelleme, performans analizi ve sürdürülebilir tasarım danışmanlığı.',
      href: '/hizmetler/enerji-verimliligi',
    },
    {
      icon: 'services/building-performance',
      title: 'Maliyet Kontrolü ve Planlama',
      text: 'Doğru metraj, bütçeleme ve yaşam döngüsü maliyet analizi ile ekonomik çözümler.',
      href: '/hizmetler/maliyet-kontrolu',
    },
    {
      icon: 'services/owner-advisory',
      title: 'Teknik Proje Yönetimi',
      text: 'Planlama, koordinasyon ve kalite kontrol ile projelerinizde güvenli ilerleme.',
      href: '/hizmetler/teknik-proje-yonetimi',
    },
  ] satisfies { icon: IconName; title: string; text: string; href: string }[],
});

export const expertiseCta = ov('expertisePage.expertiseCta', {
  eyebrow: 'Projeniz İçin Doğru Uzmanlık',
  title: 'Uzman Mühendislik Çözümleri İçin Bizimle İletişime Geçin.',
  text: 'Yapınızın ihtiyaçlarına özel, bütüncül ve sürdürülebilir mühendislik çözümleri sunalım.',
  button: { label: 'İletişime Geçin', href: '/iletisim' },
  features: [
    { icon: 'ui/search', label: 'Keşif ve Analiz' },
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: 'services/energy', label: 'Sürdürülebilir Çözümler' },
  ] satisfies { icon: IconName; label: string }[],
});
