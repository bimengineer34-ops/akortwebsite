import type { IconName } from '@/components/common/icons';
import { ov } from '@/utils/overrides';

/** Blog kategorileri (Master Prompt §19) — content.config.ts şeması da buradan beslenir. */
export const blogCategories = [
  'BIM & Dijital Mühendislik',
  'MEP',
  'Enerji',
  'Bina Performansı',
  'Teknik Danışmanlık',
  'Maliyet & Hakediş',
  'Proje Yönetimi',
  'Sürdürülebilirlik',
  'Teknik Rehberler',
] as const;

/** Blog sayfası metinleri — onaylı blog-approved-reference.jpeg'den. */
export const blogHero = ov('blog.blogHero', {
  title: 'Blog',
  subtitle: 'Mühendislikte Daha Fazla Değer İçin Güncel Bilgiler, Teknik İçgörüler ve Uzman Görüşleri',
  lead: 'AKORT Mühendislik uzman ekibi tarafından hazırlanan teknik yazılar, sektör analizleri ve proje deneyimleri ile mühendislik dünyasındaki gelişmeleri yakından takip edin.',
  annotations: [['Daha Verimli', 'Yapılar'], ['Sürdürülebilir', 'Yaşam Alanları'], ['Teknoloji Odaklı', 'Mühendislik']],
});

export const blogListing = ov('blog.blogListing', {
  featuredEyebrow: 'Öne Çıkan Yazı',
  eyebrow: 'Tüm Yazılar',
  title: 'Güncel İçgörüler ve Teknik Yazılar',
  lead: 'Mühendislik, proje yönetimi, sürdürülebilirlik ve dijital dönüşüm alanlarındaki en son gelişmeleri keşfedin.',
  searchPlaceholder: 'Blog yazılarında ara...',
  noResults: 'Aramanızla eşleşen yazı bulunamadı.',
  empty: {
    title: 'Teknik içeriklerimiz hazırlanıyor',
    text: 'BIM, MEP, enerji verimliliği ve teknik danışmanlık üzerine yazılarımız yakında burada yayınlanacak.',
  },
  sidebar: { categories: 'Kategoriler', all: 'Tüm Yazılar', popular: 'Popüler Yazılar', tags: 'Etiketler' },
});

export const newsletter = ov('blog.newsletter', {
  eyebrow: 'Bilgiden Daha Fazlası',
  // U+2011 (bölünmez tire): başlık 'E-' ve 'postanızda' arasında satır kırmasın
  title: 'Mühendislik İçgörülerini E‑postanızda Takip Edin',
  text: 'Sektördeki en güncel gelişmeler, teknik yazılar ve özel içerikler için bültenimize abone olun. Daha verimli, daha sürdürülebilir yapılar için bilgi daima yanınızda olsun.',
  formTitle: 'Teknik İçgörüler, Doğrudan Gelen Kutunuzda',
  placeholder: 'E-posta adresiniz',
  button: 'Abone Ol',
  consent: 'Kişisel verilerimin, {kvkk} kapsamında işlenmesini kabul ediyorum.',
  /** TODO: Bülten servisi / endpoint seçilince doldurulacak. null iken form gönderimi yapılmaz. */
  endpoint: (import.meta.env.PUBLIC_NEWSLETTER_ENDPOINT as string | undefined) || '/api/bulten',
  pendingMessage: 'Bülten aboneliği yakında aktif olacak. İlginiz için teşekkür ederiz.',
  icon: 'ui/mail' as IconName,
});
