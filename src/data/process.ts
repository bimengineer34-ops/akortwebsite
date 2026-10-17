import type { IconName } from '@/components/common/icons';
import { ov } from '@/utils/overrides';

export interface ProcessStepData {
  number: string;
  title: string;
  description: string;
  icon: IconName;
}

/** "Fikirden İşletmeye, Yanınızdayız" — Ana Sayfa çalışma modeli (onaylı referans metinleri). */
export const process: ProcessStepData[] = ov('process.process', [
  {
    number: '01',
    title: 'İhtiyaç Analizi',
    description: 'Hedeflerinizi, teknik gereksinimleri ve beklentileri birlikte tanımlarız.',
    icon: 'process/strategy',
  },
  {
    number: '02',
    title: 'Strateji ve Planlama',
    description: 'En doğru çözüm için yol haritasını oluştururuz.',
    icon: 'process/report',
  },
  {
    number: '03',
    title: 'Tasarım ve Koordinasyon',
    description: 'BIM odaklı, entegre ve verimli tasarım süreçleri yürütürüz.',
    icon: 'process/coordination',
  },
  {
    number: '04',
    title: 'Teknik Kontrol ve Danışmanlık',
    description: 'Uygulama sürecinde bağımsız teknik kontrol ve danışmanlık sağlarız.',
    icon: 'process/check',
  },
  {
    number: '05',
    title: 'İşletme ve Optimizasyon',
    description: 'Yapının yaşam döngüsü boyunca daha yüksek verim için destek oluruz.',
    icon: 'process/support',
  },
]);
