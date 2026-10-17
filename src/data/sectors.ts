import type { IconName } from '@/components/common/icons';

export type SectorKey =
  | 'saglik'
  | 'egitim'
  | 'kampus'
  | 'kamu'
  | 'ticari'
  | 'karma'
  | 'endustriyel'
  | 'mevcut';

export interface SectorData {
  key: SectorKey;
  title: string;
  /** Proje kartlarındaki büyük harfli etiket (ör. "SAĞLIK YAPILARI") */
  label: string;
  /** Pack'te karşılığı olmayan sektörler için ikon henüz yok (TODO-ASSET-ICON) */
  icon?: IconName;
}

/** Uzmanlık alanları / proje sektörleri (Master Prompt §16). */
export const sectors: SectorData[] = [
  { key: 'saglik', title: 'Sağlık Yapıları', label: 'Sağlık Yapıları', icon: 'expertise/health' },
  { key: 'egitim', title: 'Eğitim Yapıları', label: 'Eğitim Yapıları', icon: 'expertise/education' },
  { key: 'kampus', title: 'Kampüsler', label: 'Kampüs', icon: 'expertise/campus' },
  { key: 'kamu', title: 'Kamu Yapıları', label: 'Kamu Yapıları' },
  { key: 'ticari', title: 'Ticari Yapılar', label: 'Ticari Yapılar', icon: 'expertise/commercial' },
  { key: 'karma', title: 'Karma Kullanım', label: 'Karma Kullanım' },
  { key: 'endustriyel', title: 'Endüstriyel Yapılar', label: 'Endüstriyel Yapılar' },
  { key: 'mevcut', title: 'Mevcut Yapılar', label: 'Mevcut Yapılar', icon: 'expertise/analysis' },
];

export const sectorKeys = sectors.map((s) => s.key) as [SectorKey, ...SectorKey[]];
