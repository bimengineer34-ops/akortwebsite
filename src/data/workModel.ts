import type { IconName } from '@/components/common/icons';
import { ov } from '@/utils/overrides';

/**
 * Çalışma Modelimiz — 5 adımın ayrıntılı anlatımı (/calisma-modeli).
 * Metinler çalışma yönteminin genel tanımıdır; süre, rakam, referans veya garanti içermez (NO_FAKE_DATA).
 * Yayın öncesi firma tarafından gözden geçirilmelidir (docs/TODO.md).
 */
export interface WorkStep {
  id: string;
  number: string;
  title: string;
  icon: IconName;
  summary: string;
  intro: string;
  activities: string[];
  outputs: string[];
  /** Müşteriden beklenen girdiler */
  inputs: string[];
  services: string[];
}

export const workModelPage = ov('workModel.workModelPage', {
  title: 'Çalışma Modelimiz',
  lead: 'Fikirden işletmeye, projenizin her aşamasında şeffaf, planlı ve sonuç odaklı bir süreç yönetimi.',
  eyebrow: 'Fikirden İşletmeye, Yanınızdayız',
  intro:
    'Her proje farklıdır; ancak iyi yürüyen projeler benzer bir düzene sahiptir: ihtiyaç net tanımlanır, strateji ve plan oluşturulur, tasarım disiplinler arası koordine edilir, uygulama bağımsız olarak kontrol edilir ve yapı işletmeye doğru devredilir. Çalışma modelimiz bu beş adım üzerine kurulur. Her adımın kapsamı, çıktıları ve sizden beklenen girdiler aşağıda ayrıntılı olarak anlatılmıştır. Kapsam, projenizin ihtiyacına göre bir ya da birkaç adımı içerebilir.',
  note: 'Adımlar sırayla ilerler ancak projenin ihtiyacına göre tek bir adım da bağımsız bir hizmet olarak alınabilir.',
});

export const workSteps: WorkStep[] = ov('workModel.workSteps', [
  {
    id: 'ihtiyac-analizi',
    number: '01',
    title: 'İhtiyaç Analizi',
    icon: 'process/strategy',
    summary: 'Projenin hedefleri, kısıtları ve teknik gereksinimleri birlikte tanımlanır.',
    intro:
      'Her şey ihtiyacın doğru anlaşılmasıyla başlar. Bu adımda yapının amacı, kullanıcı profili, bütçe ve takvim çerçevesi, mevcut dokümanlar ve varsa mevcut yapı durumu birlikte değerlendirilir. Net tanımlanmamış bir ihtiyaç, ilerleyen aşamalarda maliyetli değişikliklere dönüşür.',
    activities: ['Proje hedeflerinin, öncelik ve kısıtların belirlenmesi', 'Mevcut doküman ve verilerin toplanması ve incelenmesi', 'İşletme ve kullanıcı gereksinimlerinin tanımlanması', 'Riskler ve belirsizliklerin ilk değerlendirmesi', 'Kapsam ve hizmet planının netleştirilmesi'],
    outputs: ['İhtiyaç ve kapsam özeti', 'Başlangıç risk listesi', 'Çalışma planı önerisi'],
    inputs: ['Proje amacı ve varsa ön tasarım bilgileri', 'Mevcut çizim, rapor ve sözleşmeler', 'Bütçe ve takvim beklentileri'],
    services: ['isveren-teknik-danismanligi', 'technical-due-diligence', 'mevcut-yapi-teknik-degerlendirme', 'eir'],
  },
  {
    id: 'strateji-ve-planlama',
    number: '02',
    title: 'Strateji ve Planlama',
    icon: 'process/report',
    summary: 'En uygun çözüm yaklaşımı belirlenir ve çalışma planı oluşturulur.',
    intro:
      'İhtiyaç netleştikten sonra, hedefe götürecek alternatifler karşılaştırılır ve bir yol haritası çıkarılır. Teknik seçimler, maliyet ve takvim etkileri birlikte değerlendirilir; kararlar gerekçeleriyle kayıt altına alınır.',
    activities: ['Alternatif çözümlerin teknik-ekonomik karşılaştırması', 'Çalışma kapsamı, rol ve sorumluluk dağılımı', 'Takvim, bütçe ve kilometre taşlarının belirlenmesi', 'Bilgi ve dijital süreçlerin planlanması (BIM stratejisi, BEP)', 'İletişim ve raporlama düzeninin kurulması'],
    outputs: ['Strateji ve yol haritası dokümanı', 'Proje yönetim ve takvim planı', 'BIM Uygulama Planı (gerekiyorsa)'],
    inputs: ['İhtiyaç analizi çıktıları', 'Karar vericilerin onay mekanizması', 'Mevcut kurumsal standartlar'],
    services: ['bim-stratejisi', 'bep', 'cost-planning', 'teknik-proje-yonetimi'],
  },
  {
    id: 'tasarim-ve-koordinasyon',
    number: '03',
    title: 'Tasarım ve Koordinasyon',
    icon: 'process/coordination',
    summary: 'Disiplinler arası tasarım koordine edilir; BIM odaklı süreçlerle çakışmalar erken çözülür.',
    intro:
      'Tasarım aşamasında mimari, yapı ve MEP disiplinlerinin birbirleriyle uyumlu olması, ilerleyen aşamalardaki maliyet ve gecikmeleri belirgin biçimde azaltır. Bu adımda tasarım, işveren gereksinimlerine, mevzuata ve uygulanabilirliğe göre bağımsız olarak doğrulanır.',
    activities: ['Tasarım inceleme ve doğrulama turları', 'Disiplinler arası koordinasyon toplantıları', 'BIM modellerinin birleştirilmesi ve çakışma kontrolü', 'Teknik şartname ve ihale dokümanlarının hazırlanması', 'Maliyet ve metraj uyum kontrolleri'],
    outputs: ['Tasarım inceleme raporları ve bulgu kayıtları', 'Koordinasyon ve çakışma raporları', 'Teknik şartname ve ihale dosyası'],
    inputs: ['Tasarım ekibinin çalışma modelleri ve projeleri', 'İşveren onay ve geri bildirimleri', 'Güncel kapsam ve gereksinim değişiklikleri'],
    services: ['tasarim-dogrulama', 'bim-coordination', 'clash-detection', 'teknik-sartname', 'mep-danismanligi'],
  },
  {
    id: 'teknik-kontrol-ve-danismanlik',
    number: '04',
    title: 'Teknik Kontrol ve Danışmanlık',
    icon: 'process/check',
    summary: 'Uygulama sürecinde bağımsız teknik kontrol ve danışmanlık sağlanır.',
    intro:
      'Uygulama aşamasında amaç, projede tanımlanan kalite, maliyet ve takvim hedeflerinden sapmaları erken fark etmektir. Saha kontrolleri, hakediş ve metraj doğrulaması, değişikliklerin yönetimi ve raporlama bu adımda birlikte yürütülür.',
    activities: ['Saha teknik kontrol ve uygunluk denetimleri', 'Malzeme ve ekipman onay süreçlerinin takibi', 'Hakediş, metraj ve maliyet kontrolü', 'Değişiklik ve farklı iş analizi', 'Dönemsel ilerleme ve risk raporlaması'],
    outputs: ['Saha denetim ve uygunsuzluk raporları', 'Hakediş kontrol raporları', 'Dönemsel proje durum raporları'],
    inputs: ['Sözleşme ve onaylı uygulama projeleri', 'Saha ve hakediş verileri', 'Yüklenici ve tedarikçi dokümanları'],
    services: ['saha-teknik-kontrol', 'hakedis-kontrolu', 'proje-kontrol', 'variation-analysis', 'model-qa-qc'],
  },
  {
    id: 'isletme-ve-optimizasyon',
    number: '05',
    title: 'İşletme ve Optimizasyon',
    icon: 'process/support',
    summary: 'Yapının yaşam döngüsü boyunca daha yüksek verim için destek sağlanır.',
    intro:
      'Yapının ömrünün büyük bölümü işletme döneminde geçer. Devreye alma testleriyle sistemlerin doğru çalıştığı doğrulanır, işletme verisi toplanır ve enerji, konfor ve bakım performansı izlenerek iyileştirme fırsatları belirlenir.',
    activities: ['Devreye alma (commissioning) testleri ve kabul desteği', 'As-built model ve varlık verisinin işletmeye devri', 'Enerji ve konfor performansının izlenmesi', 'Mevcut sistemlerin optimizasyonu ve iyileştirme önerileri', 'Kampüs ve portföy ölçeğinde işletme planlaması'],
    outputs: ['Devreye alma ve kabul raporları', 'İşletmeye devir dokümanları ve varlık veri seti', 'Performans ve iyileştirme raporları'],
    inputs: ['İşletme ve bakım kayıtları', 'Enerji ve sayaç verileri', 'İşletme ekibinin geri bildirimleri'],
    services: ['commissioning-advisory', 'as-built-bim', 'asset-information', 'hvac-optimization', 'energy-monitoring'],
  },
]);
