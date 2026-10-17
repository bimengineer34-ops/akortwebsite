import { ov } from '@/utils/overrides';
export interface NavItem {
  label: string;
  href: string;
}

/** Ana navigasyon — referanslardaki sıra (Master Prompt §11). İleride "Kaynaklar" eklenebilir. */
export const mainNav: NavItem[] = ov('navigation.mainNav', [
  { label: 'Ana Sayfa', href: '/' },
  { label: 'Hakkımızda', href: '/hakkimizda' },
  { label: 'Hizmetler', href: '/hizmetler' },
  { label: 'Uzmanlık Alanları', href: '/uzmanlik-alanlari' },
  { label: 'Projeler', href: '/projeler' },
  { label: 'Blog', href: '/blog' },
  { label: 'İletişim', href: '/iletisim' },
]);

/** Aktif link tespiti: "/" yalnızca tam eşleşmede, diğerleri alt route'larda da aktif. */
export const isActivePath = (href: string, pathname: string): boolean => {
  const clean = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (href === '/') return clean === '/';
  return clean === href || clean.startsWith(`${href}/`);
};

/** Hakkımızda menüsü (açılır panel) — sayfa bölümleri + Çalışma Modelimiz adımları. */
export const aboutMenu = ov('navigation.aboutMenu', {
  corporate: [
    { label: 'Biz Kimiz?', href: '/hakkimizda' },
    { label: 'Misyon, Vizyon ve Değerlerimiz', href: '/hakkimizda#misyon-vizyon-degerler' },
    { label: 'Yaklaşımımız', href: '/hakkimizda#yaklasimimiz' },
    { label: 'Uzmanlık Alanlarımız', href: '/uzmanlik-alanlari' },
  ] satisfies NavItem[],
  workModel: {
    label: 'Çalışma Modelimiz',
    href: '/calisma-modeli',
    steps: [
      { label: '01 · İhtiyaç Analizi', href: '/calisma-modeli#ihtiyac-analizi' },
      { label: '02 · Strateji ve Planlama', href: '/calisma-modeli#strateji-ve-planlama' },
      { label: '03 · Tasarım ve Koordinasyon', href: '/calisma-modeli#tasarim-ve-koordinasyon' },
      { label: '04 · Teknik Kontrol ve Danışmanlık', href: '/calisma-modeli#teknik-kontrol-ve-danismanlik' },
      { label: '05 · İşletme ve Optimizasyon', href: '/calisma-modeli#isletme-ve-optimizasyon' },
    ] satisfies NavItem[],
  },
});