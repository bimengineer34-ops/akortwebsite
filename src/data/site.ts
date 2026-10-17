import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

export interface SocialLink {
  label: 'LinkedIn' | 'YouTube' | 'Instagram';
  href: Verifiable<string>;
}

export const site = ov('site.site', {
  name: 'AKORT Mühendislik',
  shortName: 'AKORT',
  slogan: 'Uyumun Mühendisliği',
  locale: 'tr_TR',
  lang: 'tr',
  defaultTitle: 'AKORT Mühendislik — Uyumun Mühendisliği',
  defaultDescription:
    'AKORT Mühendislik: mühendislik danışmanlığı, BIM ve dijital mühendislik, enerji ve bina performansı, maliyet ve teknik danışmanlıkta çözüm ortağınız.',
  titleTemplate: '%s | AKORT Mühendislik',

  // TODO-CONTENT: Aşağıdaki iletişim bilgileri referans görsellerden alındı ve sayfalar arasında tutarsız.
  // Kullanıcı doğrulayana kadar production'da gösterilmez.
  contact: {
    email: unverified('info@akortmuhendislik.com'),
    phone: unverified('+90 216 123 45 67', 'Referanslarda 3 farklı numara var: 216 123 45 67 / 212 555 0197 / 212 555 01 99'),
    city: unverified('İstanbul, Türkiye'),
    address: unverified('Çamlıca Mah. Alemdağ Cad. No:123 Üsküdar / İstanbul'),
  },

  // TODO-CONTENT: Sosyal medya hesap URL'leri bekleniyor.
  social: [
    { label: 'LinkedIn', href: unverified('#') },
    { label: 'YouTube', href: unverified('#') },
    { label: 'Instagram', href: unverified('#') },
  ] satisfies SocialLink[],

  primaryCta: {
    label: 'Proje Danışmanlığı Al',
    href: '/iletisim',
  },
} as const);

export type Site = typeof site;
