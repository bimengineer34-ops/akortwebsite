import { unverified, type Verifiable } from '@/utils/verified';
import { ov } from '@/utils/overrides';

export interface FaqItem {
  question: string;
  /** Cevaplar firma tarafından yazılmalı — TODO-CONTENT */
  answer: Verifiable<string>;
}

/** İletişim sayfası "Merak Ettikleriniz" — sorular onaylı referanstan, cevaplar bekleniyor. */
export const contactFaq: FaqItem[] = ov('faq.contactFaq', [
  { question: 'Proje danışmanlığı nasıl başlatılır?', answer: unverified('TODO-CONTENT: Cevap bekleniyor.') },
  { question: 'Keşif ve ön değerlendirme süreci nasıl ilerler?', answer: unverified('TODO-CONTENT: Cevap bekleniyor.') },
  { question: 'Hangi hizmet alanlarında destek veriyorsunuz?', answer: unverified('TODO-CONTENT: Cevap bekleniyor.') },
  { question: 'Teklif süresi ne kadar sürer?', answer: unverified('TODO-CONTENT: Cevap bekleniyor.') },
  {
    question: 'Farklı şehirler veya yurt dışı projeleri için de hizmet veriyor musunuz?',
    answer: unverified('TODO-CONTENT: Cevap bekleniyor.'),
  },
]);
