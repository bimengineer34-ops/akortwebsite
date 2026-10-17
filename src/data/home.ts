import type { IconName } from '@/components/common/icons';
import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

/** Ana Sayfa metinleri — onaylı home-approved-reference.jpeg'den. */

export const homeHero = ov('home.homeHero', {
  eyebrow: ['Mühendislik Danışmanlığı', 'BIM', 'Enerji', 'Teknik Proje Yönetimi'],
  titleLines: ['Daha Verimli, Daha Uyumlu', 've Sürdürülebilir Yapılar için'],
  titleAccent: 'Mühendislik Danışmanlığı',
  lead: 'AKORT Mühendislik, BIM odaklı dijital mühendislik, enerji verimliliği ve teknik proje yönetimi alanlarında, yaşam döngüsü boyunca değer katan çözüm ortağınızdır.',
  primary: { label: 'Hizmetlerimizi Keşfedin', href: '/hizmetler' },
  // TODO-ASSET: Tanıtım videosu yok — buton yalnızca development'ta görünür.
  video: { label: 'Tanıtım Videomuz' },
  annotations: [
    ['BIM Koordinasyonu', 've Entegrasyon'],
    ['Enerji Analizi', 've Optimizasyon'],
    ['Teknik Proje Yönetimi'],
    ['Yaşam Döngüsü', 'Değer Yaratımı'],
  ],
});

export const homeIntro = ov('home.homeIntro', {
  eyebrow: 'AKORT Mühendislik',
  title: 'Uyumun Mühendisliği',
  body: 'AKORT Mühendislik, karmaşık yapıların teknik ihtiyaçlarını bütüncül bir bakış açısıyla ele alan, bağımsız ve güvenilir bir mühendislik danışmanlığı şirketidir. BIM, enerji, mekanik ve elektrik sistemleri ile teknik proje yönetiminde, projelerinizin her aşamasında doğru kararlar almanız için yanınızdayız.',
  cta: { label: 'Hakkımızda', href: '/hakkimizda' },
  pillars: [
    { title: 'Sürdürülebilir', text: 'Daha İyi Yapılar' },
    { title: 'Dijital', text: 'Daha Yüksek Verim' },
    { title: 'Entegre Uzmanlık', text: 'Daha Fazla Değer' },
  ],
  slogan: ['İnsan', 'Mekan', 'Teknoloji'],
  sloganAccent: 'Daha İyi Bir Yarın',
});

export interface WhyItem {
  icon: IconName;
  /** Büyük ilk satır (ör. "360°", "Yüksek") */
  highlight: Verifiable<string> | string;
  /** Doğrulanmamış highlight yerine production'da kullanılacak metin (onaylı referanslardan) */
  fallbackHighlight?: string;
  title: string;
  fallbackTitle?: string;
  text: string;
}

export const homeWhy = ov('home.homeWhy', {
  eyebrow: 'Neden AKORT?',
  title: 'Daha Fazla Değer Katan Mühendislik Yaklaşımı',
  items: [
    {
      icon: '_pending/diamond',
      highlight: '360°',
      title: 'Bütüncül Yaklaşım',
      text: 'Tasarım, maliyet, enerji ve işletme süreçlerini birlikte ele alırız.',
    },
    {
      icon: 'services/owner-advisory',
      // TODO-CONTENT: "15+" doğrulanmadı. Production'da Hizmetler referansındaki "Deneyimli Uzman Ekip" ifadesi kullanılır.
      highlight: unverified('15+'),
      fallbackHighlight: 'Deneyimli',
      title: 'Yıllık Deneyim',
      fallbackTitle: 'Uzman Ekip',
      text: 'Farklı ölçek ve tipolojilerde çok sayıda projede uzmanlık.',
    },
    {
      icon: 'services/building-performance',
      highlight: 'Yüksek',
      title: 'Teknik Yetkinlik',
      text: 'BIM, enerji ve sistem tasarımında güncel bilgi ve araçlar.',
    },
    {
      icon: 'services/energy',
      highlight: 'Sürdürülebilir',
      title: 'Gelecek Odaklı',
      text: 'Daha verimli, daha düşük karbonlu ve daha yaşanabilir yapılar.',
    },
  ] satisfies WhyItem[],
});

export const homeSections = ov('home.homeSections', {
  services: {
    eyebrow: 'Hizmetlerimiz',
    title: 'Projeleriniz İçin Bütüncül Mühendislik Danışmanlığı',
    lead: 'Planlamadan işletmeye kadar tüm süreçlerde, teknik bilgi, dijital araçlar ve sektörel deneyimimizle projelerinize değer katıyoruz.',
    link: { label: 'Tüm Hizmetler', href: '/hizmetler' },
  },
  projects: {
    eyebrow: 'Öne Çıkan Projeler',
    title: 'Uzmanlığımızla Değer Kattığımız Projeler',
    lead: 'Farklı sektör ve ölçeklerdeki projelerde edindiğimiz deneyimle, her zaman daha iyi çözümler için çalışıyoruz.',
    link: { label: 'Tüm Projeler', href: '/projeler' },
  },
  process: {
    eyebrow: 'Çalışma Modelimiz',
    title: 'Fikirden İşletmeye, Yanınızdayız',
    lead: 'Projelerinizin tüm yaşam döngüsünde, şeffaf, planlı ve sonuç odaklı bir süreç yönetimi sunuyoruz.',
    link: { label: 'Süreç Hakkında', href: '/calisma-modeli' },
  },
  blog: {
    eyebrow: 'Blog',
    title: 'Güncel İçgörüler ve Teknik Yazılar',
    lead: 'Mühendislik, BIM, enerji verimliliği ve proje yönetimi üzerine uzman görüşlerimizi paylaşıyoruz.',
    link: { label: 'Tüm Yazılar', href: '/blog' },
  },
});

export const homeCta = ov('home.homeCta', {
  eyebrow: 'Projeniz İçin Doğru Teknik Ortak',
  title: 'Gelin, Projenizi Birlikte İleri Taşıyalım.',
  text: 'Projelerinizde daha verimli, daha sürdürülebilir ve daha yüksek değer yaratan çözümler için bizimle iletişime geçin.',
  button: { label: 'İletişime Geçin', href: '/iletisim' },
  features: [
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: '_pending/shield', label: 'Güvenilir İş Ortağı' },
    { icon: 'services/energy', label: 'Sürdürülebilir Çözümler' },
  ] satisfies { icon: IconName; label: string }[],
});
