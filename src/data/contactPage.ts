import type { IconName } from '@/components/common/icons';
import { servicePillars, type ServicePillar } from './services';
import { sectors } from './sectors';
import { ov } from '@/utils/overrides';

/** İletişim sayfası metinleri — onaylı contact-approved-reference.jpeg'den. */

export const contactHero = ov('contactPage.contactHero', {
  title: 'İletişim',
  lead: 'Projeleriniz için doğru mühendislik çözümleriyle birlikte çalışalım. Uzman ekibimizle iletişime geçin, ihtiyaçlarınıza en uygun çözümleri sunalım.',
  cta: { label: 'Hemen İletişime Geçin', href: '#hizmet-talep-formu' },
  // TODO-ASSET: "Ekibimizi Tanıyın" videosu — yoksa buton gösterilmez.
  annotations: [['Daha Verimli', 'Yapılar için', 'Ortak Akıl'], ['Sürdürülebilir', 'Gelecek için', 'Mühendislik'], ['Her Projede', 'Uzun Vadeli', 'Değer']],
});

export const contactIntro = ov('contactPage.contactIntro', {
  eyebrow: 'İletişim',
  title: 'Fikirlerinizi Dinlemeye Hazırız',
  body: 'Mühendislik projeleriniz, teknik danışmanlık ihtiyaçlarınız veya iş birliği fırsatları için bizimle iletişime geçin. Alanında uzman ekibimiz, size en uygun çözümleri sunmak için her zaman yanınızda. Daha verimli, daha sürdürülebilir ve daha yaşanabilir yapılar için birlikte değer katalım.',
  slogan: ['İnsan', 'Mekan', 'Teknoloji'],
  sloganAccent: 'Daha İyi Bir Yarın',
});

export interface SelectOption {
  value: string;
  label: string;
}

export const contactForm = ov('contactPage.contactForm', {
  id: 'hizmet-talep-formu',
  eyebrow: 'İletişime Geçin',
  title: 'Hizmet Talep Formu',
  lead: 'Projenizle ilgili bilgi verin, uzman ekibimiz en kısa sürede sizinle iletişime geçsin.',
  submit: 'Talebimi Gönder',
  // Referansta 'kapsamımıza' yazıyor; dilbilgisel doğru hali kullanıldı.
  consent: 'Kişisel verilerimin, {kvkk} kapsamında işlenmesine onay veriyorum.',
  consentLink: { label: 'KVKK Aydınlatma Metni', href: '/kvkk' },
  /** TODO: Form backend'i (Netlify Forms / Cloudflare-Vercel function / harici servis) seçilince doldurulacak. */
  endpoint: (import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined) || '/api/iletisim',
  messages: {
    pending:
      'Form gönderim altyapısı henüz aktif değil. Talebiniz kaydedilmedi; altyapı devreye alındığında bu form doğrudan ekibimize ulaşacak.',
    success: 'Teşekkürler! Talebiniz alındı, uzman ekibimiz en kısa sürede sizinle iletişime geçecek.',
    error: 'Talebiniz gönderilemedi. Lütfen daha sonra tekrar deneyin.',
    invalid: 'Lütfen işaretli alanları kontrol edin.',
  },
  serviceOptions: (Object.entries(servicePillars) as [ServicePillar, { title: string }][]).map(([value, p]) => ({ value, label: p.title })),
  projectTypeOptions: sectors.map((s) => ({ value: s.key, label: s.title })) satisfies SelectOption[],
});

/**
 * Lead qualification hazırlığı (Master Prompt §22).
 * `enabled: false` iken render edilmez. Açıldığında ilgili hizmet seçilince ek alanlar görünür.
 */
export interface QualificationField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox-group';
  options?: string[];
}

export const leadQualification: { enabled: boolean; groups: Partial<Record<ServicePillar, QualificationField[]>> } = ov('contactPage.leadQualification', {
  enabled: false,
  groups: {
    bim: [
      { name: 'bim_proje_turu', label: 'Proje türü', type: 'text' },
      { name: 'bim_alan', label: 'Toplam alan (m²)', type: 'number' },
      { name: 'bim_revit', label: 'Mevcut Revit modeli', type: 'select', options: ['Var', 'Yok', 'Kısmen'] },
      { name: 'bim_ifc', label: 'IFC teslimi', type: 'select', options: ['Gerekli', 'Gerekli değil'] },
      { name: 'bim_disiplinler', label: 'Disiplinler', type: 'checkbox-group', options: ['Mimari', 'Statik', 'Mekanik', 'Elektrik'] },
      { name: 'bim_lod', label: 'LOD seviyesi', type: 'select', options: ['LOD 200', 'LOD 300', 'LOD 350', 'LOD 400', 'LOD 500'] },
      { name: 'bim_clash', label: 'Clash detection ihtiyacı', type: 'select', options: ['Evet', 'Hayır'] },
      { name: 'bim_teslim', label: 'Teslim tarihi', type: 'date' },
    ],
    enerji: [
      { name: 'en_bina_tipi', label: 'Bina tipi', type: 'text' },
      { name: 'en_alan', label: 'Toplam alan (m²)', type: 'number' },
      { name: 'en_tuketim', label: 'Yıllık tüketim (kWh)', type: 'number' },
      { name: 'en_sayac', label: 'Sayaç altyapısı', type: 'select', options: ['Var', 'Yok', 'Kısmen'] },
      { name: 'en_faturalar', label: 'Mevcut faturalar paylaşılabilir mi?', type: 'select', options: ['Evet', 'Hayır'] },
      { name: 'en_eys', label: 'Enerji yönetim sistemi', type: 'select', options: ['Var', 'Yok'] },
    ],
  },
});

export interface ContactCardData {
  key: 'email' | 'phone' | 'address';
  icon: IconName;
  title: string;
  text: string;
  action: string;
}

export const contactInfo = ov('contactPage.contactInfo', {
  eyebrow: 'Bize Ulaşın',
  title: 'İletişim Bilgilerimiz',
  cards: [
    { key: 'email', icon: 'ui/mail', title: 'E-posta', text: 'Sorularınız ve proje talepleriniz için bize e-posta gönderin.', action: 'E-posta Gönder' },
    { key: 'phone', icon: 'ui/phone', title: 'Telefon', text: 'Doğrudan bizimle görüşmek için arayabilirsiniz.', action: 'Hemen Arayın' },
    { key: 'address', icon: 'ui/location', title: 'Adres', text: 'Bizi ofisimizde ziyaret edin.', action: 'Haritada Gör' },
  ] satisfies ContactCardData[],
});

export const contactMap = ov('contactPage.contactMap', {
  eyebrow: 'Ofis Konumumuz',
  title: 'Harita Üzerinde Bizi Bulun',
  openLabel: 'Google Haritalarda Aç',
  loadLabel: 'Haritayı Yükle',
  /** KVKK / performans: harita yalnızca kullanıcı isteyince yüklenir (üçüncü taraf çerez/istek). */
  consentNote: 'Harita, Google Haritalar üzerinden yüklenir ve Google tarafından çerez kullanılabilir.',
});

export const contactFaqSection = ov('contactPage.contactFaqSection', {
  eyebrow: 'Sıkça Sorulan Sorular',
  title: 'Merak Ettikleriniz',
  text: 'İletişim sürecimiz, hizmetlerimiz ve iş birliği modelimiz hakkında en sık gelen soruları burada bulabilirsiniz. Farklı bir sorunuz varsa bizimle iletişime geçmekten çekinmeyin.',
});

export const contactCta = ov('contactPage.contactCta', {
  eyebrow: 'Birlikte Daha Fazla Değer',
  title: 'Gelin, Projenizi Birlikte Hayata Geçirelim.',
  text: 'Daha verimli, daha sürdürülebilir ve daha yaşanabilir yapılar için uzman ekibimizle şimdi iletişime geçin.',
  button: { label: 'Proje Danışmanlığı Al', href: '#hizmet-talep-formu' },
  features: [
    { icon: '_pending/clock', label: 'Hızlı Geri Dönüş' },
    { icon: 'services/owner-advisory', label: 'Uzman Ekip' },
    { icon: '_pending/user', label: 'Size Özel Çözüm' },
  ] satisfies { icon: IconName; label: string }[],
});
