import type { IconName } from '@/components/common/icons';
import type { FeatureBandItem } from '@/components/common/FeatureBand.astro';
import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

/** Hakkımızda metinleri — onaylı about-approved-reference.jpeg'den. */

export const aboutHero = ov('about.aboutHero', {
  title: 'Hakkımızda',
  lead: 'Daha verimli, daha uyumlu ve sürdürülebilir bir yapı geleceği için mühendislik bilgisi, dijital teknolojiler ve deneyimi bir araya getiriyoruz.',
  annotations: [['Mühendislik', 'Danışmanlığı'], ['BIM ve Dijital', 'Yapılar'], ['Enerji ve', 'Sürdürülebilirlik'], ['Teknik Proje', 'Yönetimi']],
});

export const aboutIntro = ov('about.aboutIntro', {
  eyebrow: 'AKORT Mühendislik',
  title: 'Uyumun Mühendisliği ile Daha İyi Bir Yarın',
  body: [
    'AKORT Mühendislik, karmaşık yapıların teknik ihtiyaçlarını bütüncül bir bakış açısıyla ele alan, bağımsız ve güvenilir bir mühendislik danışmanlığı şirketidir. Mühendislik disiplinlerini, dijital teknolojileri ve sürdürülebilirlik ilkelerini bir araya getirerek projelerinize daha fazla değer, daha yüksek performans ve daha düşük yaşam döngüsü maliyeti kazandırır.',
    'Kamu, özel sektör ve uluslararası yatırımcılar için; planlama aşamasından işletme dönemine kadar, tüm yaşam döngüsünde yanınızda olan güvenilir bir mühendislik danışmanı olarak çalışıyoruz.',
  ],
  ctaLabel: 'Hikayemiz',
  slogan: ['Daha', 'Verimli', 'Daha Uyumlu', 'Daha Sürdürülebilir', 'Yapılar İçin'],
});

export interface PrincipleCard {
  icon: IconName;
  title: string;
  text?: string;
  list?: string[];
}

export const aboutPrinciples = ov('about.aboutPrinciples', {
  eyebrow: 'İlkelerimiz',
  title: 'Misyonumuz, Vizyonumuz ve Değerlerimiz',
  cards: [
    {
      icon: '_pending/target',
      title: 'Misyonumuz',
      text: 'Bilgi, teknoloji ve deneyimimizi birleştirerek, daha verimli, daha uyumlu ve sürdürülebilir yapıların hayata geçmesine değer katan mühendislik danışmanlığı hizmetleri sunmak.',
    },
    {
      icon: '_pending/eye',
      title: 'Vizyonumuz',
      text: "Türkiye'de ve uluslararası arenada, mühendislik danışmanlığı, BIM, enerji ve teknik proje yönetimi alanlarında tercih edilen, güvenilir ve yenilikçi bir çözüm ortağı olmak.",
    },
    {
      icon: '_pending/diamond',
      title: 'Değerlerimiz',
      list: [
        'Bağımsız ve tarafsız yaklaşım',
        'Teknik mükemmeliyet',
        'Sürdürülebilir gelecek odaklılık',
        'Yenilikçilik ve sürekli gelişim',
        'Şeffaflık ve güven',
        'Müşteri ve proje odaklılık',
      ],
    },
  ] satisfies PrincipleCard[],
});

export const aboutWhy = ov('about.aboutWhy', {
  eyebrow: 'Neden AKORT?',
  title: 'Daha Fazla Değer Katan Mühendislik Danışmanlığı',
  items: [
    { icon: '_pending/gear', title: 'Bütüncül Yaklaşım', text: 'Tasarım, maliyet, enerji ve işletme süreçlerini birlikte ele alırız.' },
    { icon: 'expertise/commercial', highlight: 'Kanıtlanmış', title: 'Deneyim', text: 'Farklı ölçek ve tipolojilerde çok sayıda projede edindiğimiz tecrübe.' },
    { icon: '_pending/diamond', highlight: 'Bağımsız', title: 've Güvenilir', text: 'Tarafsız teknik bakış açısı ile objektif çözümler sunarız.' },
    { icon: 'services/owner-advisory', highlight: 'Dijital Dönüşüm', title: 'Yetkinliği', text: 'BIM ve dijital teknolojilerle daha verimli süreçler tasarlıyoruz.' },
    { icon: 'services/energy', highlight: 'Sürdürülebilir', title: 'Gelecek Odaklı', text: 'Daha düşük karbonlu, daha dayanıklı ve yaşanabilir yapılar için çalışıyoruz.' },
  ] satisfies FeatureBandItem[],
});

export interface Milestone {
  year: Verifiable<string>;
  title: string;
  text: string;
}

/**
 * TODO-CONTENT: Kuruluş yılı ve kilometre taşları referans görselden alındı, DOĞRULANMADI.
 * Doğrulanana kadar "Yolculuğumuz" bölümü production'da render edilmez.
 */
export const aboutMilestones = ov('about.aboutMilestones', {
  eyebrow: 'Yolculuğumuz',
  title: 'Önemli Dönem Taşlarımız',
  items: [
    { year: unverified('2014'), title: 'Kuruluş', text: 'AKORT Mühendislik, mühendislik danışmanlığı vizyonuyla kuruldu.' },
    { year: unverified('2016'), title: 'BIM Odaklı Büyüme', text: 'Dijital tasarım ve BIM alanındaki yetkinliklerimizi güçlendirdik.' },
    {
      year: unverified('2018'),
      title: 'Hizmet Alanlarının Genişlemesi',
      text: 'Enerji yönetimi, teknik proje yönetimi ve sürdürülebilirlik danışmanlığını hizmetlerimize ekledik.',
    },
    { year: unverified('2021'), title: 'Büyük Ölçekli Projeler', text: 'Kamu ve özel sektörde farklı ölçeklerde referans projeler gerçekleştirdik.' },
    { year: unverified('2024'), title: 'Daha Güçlü Bir Gelecek', text: 'Dijitalleşme, sürdürülebilirlik ve uluslararası projelerle büyümeye devam ediyoruz.' },
  ] satisfies Milestone[],
});

export const aboutApproach = ov('about.aboutApproach', {
  eyebrow: 'Yaklaşımımız',
  title: 'Uzmanlık, Teknoloji ve Deneyimle Değer Yaratıyoruz',
  body: [
    'AKORT, alanında uzman mühendislik kadrosu, dijital teknolojilere hakimiyeti ve çok disiplinli bakış açısıyla projelerinize özel, sürdürülebilir ve uygulanabilir çözümler geliştirir.',
    'Her projeyi, bulunduğu bağlamın ihtiyaçları, kullanıcıları ve geleceğin gereklilikleri doğrultusunda ele alır; teknik bilgi, deneyim ve yenilikçi yaklaşımla somut değere dönüştürürüz.',
  ],
  cta: { label: 'Çalışma Yaklaşımımız', href: '/calisma-modeli' },
  slogan: ['Bilgi', 'Teknoloji', 'Deneyim', 'Sürdürülebilirlik', 'Daha İyi Yapılar'],
});

export const aboutExpertise = ov('about.aboutExpertise', {
  eyebrow: 'Temel Yetkinliklerimiz',
  title: 'Uzmanlık Alanlarımız',
  items: [
    {
      icon: 'services/engineering-consulting',
      title: 'Mühendislik Danışmanlığı',
      text: 'Projelerinizi teknik, ekonomik ve sürdürülebilirlik odaklı bütüncül bir yaklaşımla ele alırız.',
      href: '/hizmetler/muhendislik-danismanligi',
    },
    {
      icon: 'services/bim-digital',
      title: 'BIM ve Dijital Yapılar',
      text: 'Dijital tasarım ve daha verimli ve daha öngörülebilir projeler için BIM ve dijital teknolojilerden yararlanırız.',
      href: '/hizmetler/bim-danismanligi',
    },
    {
      icon: 'services/energy',
      title: 'Enerji ve Sürdürülebilirlik',
      text: 'Daha düşük enerji tüketen, daha konforlu ve daha dayanıklı yapılar için enerji ve sürdürülebilirlik çözümleri sunarız.',
      href: '/hizmetler/enerji-verimliligi',
    },
    {
      icon: 'services/technical-spec',
      title: 'Teknik Proje Yönetimi',
      text: 'Planlama, koordinasyon ve teknik kontrol süreçlerinde projelerinizin hedeflerine zamanında ve etkin şekilde ulaşmasını sağlarız.',
      href: '/hizmetler/teknik-proje-yonetimi',
    },
  ] satisfies { icon: IconName; title: string; text: string; href: string }[],
});

export const aboutCta = ov('about.aboutCta', {
  eyebrow: 'Birlikte Daha Fazla Değer Yaratalım',
  title: 'Projeleriniz İçin Güvenilir Bir Mühendislik Ortağı',
  text: 'Mühendislik danışmanlığı, BIM, enerji ve teknik proje yönetimi alanlarında projelerinize özel çözümler için bizimle iletişime geçin.',
  button: { label: 'İletişime Geçin', href: '/iletisim' },
  features: [
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: '_pending/shield', label: 'Güvenilir İş Ortağı' },
    { icon: 'services/energy', label: 'Sürdürülebilir Çözümler' },
  ] satisfies { icon: IconName; label: string }[],
});
