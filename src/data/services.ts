import type { IconName } from '@/components/common/icons';
import { ov } from '@/utils/overrides';

/** Dört ana hizmet sütunu (Master Prompt §10). */
export type ServicePillar = 'muhendislik' | 'bim' | 'enerji' | 'maliyet' | 'yazilim';

export const servicePillars: Record<ServicePillar, { title: string; items: string[] }> = ov('services.servicePillars', {
  muhendislik: {
    title: 'Mühendislik Danışmanlığı',
    items: [
      'Mekanik Proje Danışmanlığı',
      'Elektrik Proje Danışmanlığı',
      'MEP Danışmanlığı',
      'İşveren Teknik Danışmanlığı',
      'Teknik Proje Yönetimi',
      'Proje Kontrol',
      'Tasarım Doğrulama',
      'Saha Teknik Kontrol',
      'Teknik Şartname',
      'İhale Teknik Danışmanlığı',
      'Technical Due Diligence',
      'Existing Building Technical Assessment',
      'Commissioning Advisory',
    ],
  },
  bim: {
    title: 'BIM & Dijital Mühendislik',
    items: [
      'BIM Strategy',
      'BIM Consultancy',
      'BIM Information Management',
      'ISO 19650',
      'EIR',
      'BEP',
      'CDE',
      'BIM Execution Planning',
      '3D BIM',
      '4D BIM',
      '5D BIM',
      'BIM Coordination',
      'MEP Coordination',
      'Clash Detection',
      'Revit Modelling',
      'IFC',
      'Shop Drawing',
      'As-Built BIM',
      'Model QA/QC',
      'Model Checking',
      'Quantity Take-Off',
      'Asset Information',
      'Digital Twin',
      'Scan-to-BIM',
    ],
  },
  enerji: {
    title: 'Enerji & Bina Performansı',
    items: [
      'Enerji Yönetimi',
      'Enerji Verimliliği',
      'Building Performance',
      'Energy Performance Analysis',
      'Energy Monitoring',
      'Enerji Faturası Analizi',
      'Mevcut Sistem Performans Analizi',
      'HVAC Optimization',
      'Retrofit Advisory',
      'ISO 50001',
      'Kampüs Enerji Yönetimi',
      'Smart Building',
      'Sustainability',
    ],
  },
  maliyet: {
    title: 'Maliyet & Teknik Danışmanlık',
    items: [
      'Keşif',
      'Metraj',
      'Hakediş Kontrolü',
      'Maliyet Kontrolü',
      'Cost Planning',
      'Cost Verification',
      'Technical Audit',
      'Contract Technical Review',
      'Variation Analysis',
      'Teknik Şartname Kontrolü',
      'İhale Dosyası İnceleme',
    ],
  },
  yazilim: {
    title: 'Yazılım & Dijital Çözümler',
    items: [
      'Özel Yazılım Geliştirme',
      'BIM Eklentileri ve Otomasyon',
      'Hesap ve Raporlama Araçları',
      'Proje Takip Panoları',
      'Veri Analitiği ve Panolar',
      'Dijital İkiz Platformları',
      'Entegrasyon ve API',
      'Web Uygulaması Geliştirme',
      'Mobil Saha Uygulamaları',
      'Yapay Zeka Çözümleri',
      'Doküman ve Şartname Analizi',
      'Teknik Asistan ve Bilgi Tabanı',
      'Tahminleme ve Makine Öğrenmesi',
      'Görüntü Analizi',
    ],
  },
});

export interface ServiceCardData {
  slug: string;
  title: string;
  description: string;
  icon: IconName;
  pillar: ServicePillar;
  /** Ana Sayfa "Hizmetlerimiz" grid'inde (6 kart) gösterilsin mi */
  onHome: boolean;
}

/** Hizmet kartları — metinler onaylı Ana Sayfa / Hizmetler referanslarından. */
export const services: ServiceCardData[] = ov('services.services', [
  {
    slug: 'muhendislik-danismanligi',
    title: 'Mühendislik Danışmanlığı',
    description: 'Projeleriniz için teknik, ekonomik ve sürdürülebilir çözümler sunuyoruz.',
    icon: 'services/engineering-consulting',
    pillar: 'muhendislik',
    onHome: true,
  },
  {
    slug: 'bim-danismanligi',
    title: 'BIM & Dijital Mühendislik',
    description: 'Daha koordineli, hatasız ve verimli projeler için BIM odaklı süreçler.',
    icon: 'services/bim-digital',
    pillar: 'bim',
    onHome: true,
  },
  {
    slug: 'mep-danismanligi',
    title: 'Mekanik ve Elektrik Proje Danışmanlığı',
    description: 'Yapı sistemlerinde bütüncül, verimli ve standartlara uygun tasarım çözümleri.',
    icon: 'services/mep',
    pillar: 'muhendislik',
    onHome: true,
  },
  {
    slug: 'hakedis-kontrolu',
    title: 'Keşif – Metraj – Hakediş Kontrolü',
    description: 'Doğru maliyet yönetimi için bağımsız teknik kontrol hizmetleri.',
    icon: 'services/cost',
    pillar: 'maliyet',
    onHome: true,
  },
  {
    slug: 'enerji-verimliligi',
    title: 'Enerji Yönetimi ve Verimlilik',
    description: 'Daha düşük işletme maliyetleri için enerji analizi ve optimizasyon çözümleri.',
    icon: 'services/energy',
    pillar: 'enerji',
    onHome: true,
  },
  {
    slug: 'isveren-teknik-danismanligi',
    title: 'İşveren Teknik Danışmanlığı',
    description: 'Yatırımınızın her aşamasında güvenilir teknik destek ve proje yönetimi.',
    icon: 'services/owner-advisory',
    pillar: 'muhendislik',
    onHome: true,
  },
  {
    slug: 'teknik-sartname-ihale-danismanligi',
    title: 'Teknik Şartname ve İhale Danışmanlığı',
    description: 'Projelerinize özel teknik şartname, ihale dokümanı hazırlığı ve süreç danışmanlığı sağlıyoruz.',
    icon: 'services/technical-spec',
    pillar: 'muhendislik',
    onHome: false,
  },
  {
    slug: 'teknik-proje-yonetimi',
    title: 'Teknik Proje Yönetimi',
    description: 'Planlama, koordinasyon ve teknik kontrol ile projelerinizi hedeflerine güvenle ulaştırıyoruz.',
    icon: 'services/project-management',
    pillar: 'muhendislik',
    onHome: false,
  },
  {
    slug: 'yazilim-gelistirme',
    title: 'Yazılım & Dijital Çözümler',
    description: 'Mühendislik ve proje süreçlerine özel yazılım, otomasyon, yapay zeka, veri platformu ve web/mobil uygulama geliştiriyoruz.',
    icon: '_pending/code',
    pillar: 'yazilim',
    onHome: false,
  },
]);

export const homeServices = services.filter((s) => s.onHome);
export const serviceHref = (slug: string) => `/hizmetler/${slug}`;
