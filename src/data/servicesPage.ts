import type { IconName } from '@/components/common/icons';
import type { TimelineStep } from '@/components/common/ProcessTimeline.astro';
import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

/** Hizmetler sayfası metinleri — onaylı services-approved-reference.jpeg'den. */

export const servicesHero = ov('servicesPage.servicesHero', {
  title: 'Hizmetler',
  lead: 'Projelerinizin her aşamasında, daha verimli, daha sürdürülebilir ve daha yüksek değer üreten yapılar için bütüncül mühendislik danışmanlığı sunuyoruz.',
  annotations: [['Daha Verimli', 'Yapılar'], ['Daha Sürdürülebilir', 'Çözümler'], ['Daha Yüksek', 'Yatırım Değeri']],
});

export const servicesIntro = ov('servicesPage.servicesIntro', {
  eyebrow: 'Bütüncül Yaklaşım',
  title: 'Mühendislik Odaklı Danışmanlık Hizmetleri',
  body: 'AKORT Mühendislik olarak, yapıların tüm yaşam döngüsünde ihtiyaç duyulan teknik bilgi, deneyim ve dijital araçları bir araya getirerek, proje özelinde katma değer yaratan mühendislik danışmanlığı hizmetleri sunuyoruz. Tüm hizmetlerimiz, daha verimli, daha sürdürülebilir ve daha yaşanabilir yapılar hedefiyle, uluslararası iyi uygulamalarla uyumlu şekilde yürütülür.',
  slogan: ['Doğru Analiz', 'Doğru Tasarım', 'Daha İyi', 'Yaşam Alanları'],
});

export const servicesGrid = ov('servicesPage.servicesGrid', {
  eyebrow: 'Hizmetlerimiz',
  title: 'Danışmanlık Hizmetlerimiz',
  lead: 'Projelerinizin ihtiyaçlarına uygun, entegre ve disiplinler arası mühendislik danışmanlığı hizmetleri sunuyoruz.',
});

export const featuredService = ov('servicesPage.featuredService', {
  eyebrow: 'Öne Çıkan Hizmet',
  title: 'Mühendislik Danışmanlığı',
  text: 'Karmaşık yapıların teknik ihtiyaçlarını bütüncül bir bakış açısıyla ele alarak, tasarım, yapım ve işletme süreçlerinde size özel çözümler üretiyoruz.',
  checklist: ['Disiplinler arası uzmanlık', 'Uluslararası standartlara uyum', 'Ekonomik ve sürdürülebilir çözümler', 'Dijital araçlarla daha verimli süreçler'],
  cta: { label: 'Detaylı Bilgi', href: '/hizmetler/muhendislik-danismanligi' },
  calloutsLeft: [['Mimari', 'Koordinasyon'], ['Mekanik', 'Sistemler'], ['Elektrik', 'Sistemleri']],
  calloutsRight: [['BIM Tabanlı', 'Tasarım'], ['Enerji Verimliliği', 'Analizi'], ['Maliyet ve', 'Yaşam Döngüsü', 'Değerlendirmesi']],
});

export const servicesProcess = ov('servicesPage.servicesProcess', {
  eyebrow: 'Sürecimiz',
  title: 'Değer Katan Bir Süreç Yönetimi',
  steps: [
    { number: '01', title: 'İhtiyaç Analizi', description: 'Projenizin hedeflerini ve gereksinimlerini analiz ediyoruz.' },
    { number: '02', title: 'Strateji ve Planlama', description: 'En uygun çözüm yaklaşımını belirliyor, çalışma planını oluşturuyoruz.' },
    { number: '03', title: 'Teknik Çalışma', description: 'Uzman ekibimizle detaylı analiz, tasarım ve kontrol süreçlerini yürütüyoruz.' },
    { number: '04', title: 'Raporlama ve Teslim', description: 'Somut çıktılar ve açık raporlarla sonuçlandırıyoruz.' },
    { number: '05', title: 'Sürekli Destek', description: 'İşletme sürecinde de yanınızda olmaya devam ediyoruz.' },
  ] satisfies TimelineStep[],
});

export interface DifferenceItem {
  icon: IconName;
  title: string;
  text: Verifiable<string> | string;
  /** Doğrulanmamış metin yerine production'da kullanılacak sayısız ifade */
  fallbackText?: string;
}

export const servicesWhy = ov('servicesPage.servicesWhy', {
  eyebrow: 'Neden AKORT?',
  title: 'Fark Yaratan Danışmanlık Anlayışı',
  items: [
    { icon: '_pending/diamond', title: 'Bütüncül Yaklaşım', text: 'Tasarım, maliyet, enerji ve işletme süreçlerini birlikte ele alırız.' },
    {
      icon: 'services/owner-advisory',
      title: 'Deneyimli Uzman Ekip',
      // TODO-CONTENT: "15+ yıllık" doğrulanmadı.
      text: unverified('15+ yıllık tecrübe ile karmaşık projelerde güvenilir çözümler sunarız.'),
      fallbackText: 'Karmaşık projelerde güvenilir çözümler sunarız.',
    },
    { icon: 'services/energy', title: 'Sürdürülebilir Gelecek Odaklı', text: 'Daha verimli, daha düşük karbonlu ve daha yaşanabilir yapılar için çalışırız.' },
    { icon: 'services/building-performance', title: 'Ölçülebilir Katma Değer', text: 'Veriye dayalı analizlerle yatırımlarınızın değerini artırırız.' },
  ] satisfies DifferenceItem[],
});

export const servicesCta = ov('servicesPage.servicesCta', {
  title: 'Projeleriniz İçin Doğru Danışmanla Çalışın.',
  text: 'Yapılarınızın her aşamasında, deneyimli ekibimizle yanınızdayız.',
  button: { label: 'İletişime Geçin', href: '/iletisim' },
  features: [
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: '_pending/shield', label: 'Güvenilir İş Ortağı' },
    { icon: 'services/energy', label: 'Sürdürülebilir Çözümler' },
  ] satisfies { icon: IconName; label: string }[],
});
