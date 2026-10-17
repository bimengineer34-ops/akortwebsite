import type { SectorEntry } from './types';
import { ov } from '@/utils/overrides';

/**
 * Uzmanlık alanı (sektör) sayfaları: /uzmanlik-alanlari/<slug>
 * Metinler, yapı tipine özgü genel mühendislik gereksinimlerini anlatır; firmaya ait referans, rakam veya
 * sertifika içermez (NO_FAKE_DATA). Yayın öncesi firma tarafından gözden geçirilmelidir.
 */
export const sectorEntries: SectorEntry[] = ov('serviceContent.sectors.sectorEntries', [
  {
    slug: 'saglik-yapilari',
    title: 'Sağlık Yapıları',
    sectorKey: 'saglik',
    icon: 'expertise/health',
    summary: 'Hastane, tıp merkezi ve sağlık kampüslerinde hijyen, güvenlik ve kesintisiz işletme gereksinimlerine odaklanan mühendislik danışmanlığı.',
    intro: [
      'Sağlık yapıları, mühendislik açısından en karmaşık yapı tiplerinden biridir: aynı çatı altında ameliyathane, yoğun bakım, laboratuvar, görüntüleme ve hasta odaları gibi çok farklı hijyen, basınç ve süreklilik gereksinimleri bulunur.',
      'Bu yapılarda sistem arızası yalnızca konfor değil, hasta güvenliği sorunudur. Bu nedenle tasarım ve işletme kararları yedeklilik, hijyen ve bakım kolaylığı ışığında bağımsız olarak değerlendirilmelidir.',
    ],
    challenges: [
      { title: 'Hijyen ve hava kontrolü', text: 'Alanlara göre filtrasyon sınıfları, hava değişim sayıları ve basınç kademeleri (pozitif/negatif basınçlı odalar) doğru tasarlanmalı ve işletmede doğrulanmalıdır.' },
      { title: 'Süreklilik ve yedeklilik', text: 'Elektrik (jeneratör, UPS, ayrı besleme hatları), soğutma ve medikal gaz sistemlerinde kesintisiz hizmet için yedeklilik mimarisi gerekir.' },
      { title: 'Sistem yoğunluğu ve koordinasyon', text: 'Yoğun MEP altyapısı nedeniyle tavan arası ve şaftlarda disiplin koordinasyonu kritiktir; BIM tabanlı çakışma kontrolü önemli fayda sağlar.' },
      { title: 'Devreye alma ve işletme', text: 'Karmaşık sistemlerin teslim öncesinde test ve devreye alma ile doğrulanması, işletme ekibinin doğru dokümantasyon ve eğitimle devralması gerekir.' },
    ],
    services: ['mep-danismanligi', 'bim-coordination', 'commissioning-advisory', 'hvac-optimization', 'asset-information'],
    faq: [
      { q: 'Sağlık yapılarında hangi standartlar esas alınır?', a: 'Sağlık Bakanlığı ilgili yönetmelik ve rehberleri ile alana göre ASHRAE 170 gibi referans standartlar proje gereksinimine göre değerlendirilir.' },
      { q: 'Faaliyet halindeki hastanelerde iyileştirme çalışması yapılabilir mi?', a: 'Evet; hizmetin kesintisiz sürdürülmesi için aşamalı uygulama ve geçici çözümler planlanır.' },
      { q: 'Sağlık yapılarında BIM ve koordinasyon neden önemlidir?', a: 'Çok yoğun tesisat ve özel alanlar nedeniyle çakışma riski yüksektir; model tabanlı koordinasyon uygulama hatalarını ve gecikmeleri azaltmaya yardımcı olur.' },
      { q: 'Hangi hizmetler sağlık yapıları için uygundur?', a: 'MEP danışmanlığı ve koordinasyonu, commissioning, enerji verimliliği ve varlık bilgisi hizmetleri sağlık yapılarının ihtiyaçlarına uyarlanabilir.' },
      { q: 'İşletme sürekliliği tasarımda nasıl ele alınır?', a: 'Yedekleme, bakım erişimi ve arıza senaryoları tasarım aşamasında değerlendirilir; kritik sistemlerde kesintisiz işletme hedeflenir.' },
    ],
  },
  {
    slug: 'egitim-yapilari',
    title: 'Eğitim Yapıları',
    sectorKey: 'egitim',
    icon: 'expertise/education',
    summary: 'Okul, üniversite ve araştırma yapılarında konforlu, güvenli, enerji verimli ve esnek öğrenme ortamları için mühendislik danışmanlığı.',
    intro: [
      'Eğitim yapılarında yoğun kullanıcı profili, değişken doluluk ve yüksek iç hava kalitesi beklentisi öne çıkar. Sınıf, amfi, laboratuvar ve atölye gibi farklı alanların her biri farklı mekanik ve elektrik gereksinimleri taşır.',
      'Aynı zamanda bu yapıların işletme bütçeleri sınırlıdır; bu nedenle enerji verimliliği, bakım kolaylığı ve dayanıklı sistem seçimleri doğrudan yaşam döngüsü maliyetini belirler.',
    ],
    challenges: [
      { title: 'İç hava kalitesi ve konfor', text: 'Yüksek doluluklu sınıf ve amfilerde havalandırma debisi, CO₂ kontrolü ve akustik konfor tasarımın temel parametreleridir.' },
      { title: 'Değişken doluluk ve esneklik', text: 'Dönemsel kullanım değişimlerine uyum sağlayan, talep bazlı çalışan sistemler enerji tüketimini düşürür.' },
      { title: 'Laboratuvar ve özel alanlar', text: 'Çeker ocak, özel egzoz ve gaz sistemleri gibi laboratuvar gereksinimleri ayrıca değerlendirilmelidir.' },
      { title: 'İşletme bütçesi ve bakım', text: 'Sınırlı bakım kapasitesi olan kurumlar için sade, dayanıklı ve izlenebilir sistemler tercih edilmelidir.' },
    ],
    services: ['mep-danismanligi', 'enerji-verimliligi', 'kampus-enerji-yonetimi', 'smart-building', 'hvac-optimization'],
    faq: [
      { q: 'Yaz tatilinde yapılacak yenileme işleri nasıl planlanır?', a: 'Eğitim takvimine göre kısa kapalı dönemlerde tamamlanabilecek iş paketleri ve ön hazırlık/devreye alma planı oluşturulur.' },
      { q: 'Okullarda enerji tasarrufu en çok nerede sağlanır?', a: 'Genellikle kontrol ve zamanlama (boş saatlerde azaltılmış çalışma), aydınlatma ve kabuk iyileştirmelerinde; bina özelinde analizle belirlenir.' },
      { q: 'Eğitim yapılarında hangi mühendislik konuları öne çıkar?', a: 'İç hava kalitesi ve konfor, değişken doluluğa uygun sistemler, laboratuvar alanları ve işletme bütçesine uygun bakım kolaylığı öne çıkar.' },
      { q: 'Enerji verimliliği okullarda nasıl sağlanır?', a: 'Kabuk iyileştirmesi, doluluğa göre havalandırma ve aydınlatma kontrolü ile izleme sayesinde enerji tüketimi azaltılabilir.' },
      { q: 'Kampüs ölçeğinde nasıl bir yaklaşım izlenir?', a: 'Binalar arası ortak altyapı, merkezi izleme ve standart BIM uygulamasıyla bütüncül bir yaklaşım izlenir.' },
    ],
  },
  {
    slug: 'kampusler',
    title: 'Kampüsler',
    sectorKey: 'kampus',
    icon: 'expertise/campus',
    summary: 'Üniversite, hastane, sanayi ve iş kampüslerinde çok yapılı yerleşkelerin altyapı, enerji ve işletme planlaması için danışmanlık.',
    intro: [
      'Kampüsler; çok sayıda yapıyı, ortak altyapı şebekelerini (elektrik, ısı, soğutma, su, haberleşme) ve farklı kullanım profillerini birlikte yönetmeyi gerektirir. Bu ölçekte kararlar, tek tek binalardan çok bütüncül master plan çerçevesinde verilmelidir.',
      'Kampüs altyapısının kapasitesi ve gelişim aşamaları, ileride eklenecek yapıların kolay ve ekonomik biçimde bağlanabilmesi için baştan planlanmalıdır.',
    ],
    challenges: [
      { title: 'Altyapı master planı', text: 'Merkezi ısıtma-soğutma, orta gerilim dağıtımı ve veri altyapısı için aşamalı büyümeye uygun kapasite planı gerekir.' },
      { title: 'Enerji izleme ve yönetimi', text: 'Bina bazlı alt sayaçlar ve merkezi izleme, tasarruf fırsatlarının ve anormalliklerin görülmesini sağlar.' },
      { title: 'Çok yapılı koordinasyon', text: 'Farklı zamanlarda ve farklı tasarımcılarla yapılan binaların ortak standartlarla uyumlu olması gerekir (BIM standartları, ortak şartnameler).' },
      { title: 'İşletme ve varlık yönetimi', text: 'Yapıların ve ekipmanların envanteri ve bakım verisi, ölçekle birlikte karmaşıklaşır; yapılandırılmış varlık bilgisi önemlidir.' },
    ],
    services: ['kampus-enerji-yonetimi', 'energy-monitoring', 'bim-information-management', 'asset-information', 'digital-twin'],
    faq: [
      { q: 'Kampüs master planında enerji nasıl ele alınır?', a: 'Mevcut yük profilleri ve gelecekteki büyüme senaryoları birlikte değerlendirilir; merkezi ve dağıtık çözümler teknik-ekonomik olarak karşılaştırılır.' },
      { q: 'BIM standartları kampüs ölçeğinde neden önemlidir?', a: 'Farklı projelerden gelen modellerin tek bir kampüs varlık modelinde birleştirilebilmesi için ortak veri standartları gerekir.' },
      { q: 'Kampüs projelerinde danışmanlık hangi aşamada alınmalıdır?', a: 'Master plan aşamasında altyapı ve enerji stratejisi için; uygulama ve işletme aşamalarında da koordinasyon ve izleme için alınabilir.' },
      { q: 'Kampüs enerji izleme nasıl kurulur?', a: 'Binalara alt sayaç ve veri toplama altyapısı kurulur, veriler merkezi panoda toplanarak karşılaştırmalı izleme sağlanır.' },
      { q: 'Varlık bilgisi kampüslerde neden değerlidir?', a: 'Çok sayıda ekipman ve binanın bakımını planlamak için güncel ve yapılandırılmış varlık bilgisi işletmeye önemli katkı sağlar.' },
    ],
  },
  {
    slug: 'kamu-yapilari',
    title: 'Kamu Yapıları',
    sectorKey: 'kamu',
    icon: 'expertise/campus',
    summary: 'İdari binalar, kültür ve hizmet yapıları gibi kamu yatırımlarında uzun ömürlü, ekonomik ve sürdürülebilir çözümler için danışmanlık.',
    intro: [
      'Kamu yapıları uzun kullanım ömrü, yüksek erişilebilirlik ve şeffaf tedarik süreçleri gerektirir. Yatırım ve işletme bütçelerinin kamu kaynaklarıyla sağlanması, ihale, şartname ve hakediş süreçlerinin doğruluğunu daha da önemli kılar.',
      'Bu nedenle kamu projelerinde teknik şartnamenin netliği, tekliflerin eşit kapsamda değerlendirilmesi ve uygulama sürecinin bağımsız izlenmesi öne çıkar.',
    ],
    challenges: [
      { title: 'İhale ve şartname kalitesi', text: 'Net teknik şartname ve eksiksiz ihale dosyası, rekabeti ve uygulama kalitesini doğrudan etkiler.' },
      { title: 'Uzun ömür ve işletme maliyeti', text: 'Seçilen sistemlerin bakım kolaylığı ve işletme maliyeti yaşam döngüsü ölçeğinde değerlendirilmelidir.' },
      { title: 'Erişilebilirlik ve güvenlik', text: 'Herkes için erişilebilirlik, yangın güvenliği ve acil durum senaryoları tasarımın ayrılmaz parçalarıdır.' },
      { title: 'Enerji performansı', text: 'Kamu binalarında enerji verimliliği yükümlülükleri ve hedefleri mevzuatla belirlenir; tasarım ve işletme buna göre planlanmalıdır.' },
    ],
    services: ['teknik-sartname-ihale-danismanligi', 'hakedis-kontrolu', 'technical-audit', 'enerji-verimliligi', 'iso-50001'],
    faq: [
      { q: 'Kamu ihalelerinde hangi aşamalarda destek verilebilir?', a: 'Teknik şartname ve ihale dosyası hazırlığı, tekliflerin teknik değerlendirmesi, uygulama sürecinde teknik denetim ve hakediş kontrolü.' },
      { q: 'Danışmanlık idari ihale sürecinin yerine geçer mi?', a: 'Hayır; ihale usulü ve idari işlemler ilgili kurumun sorumluluğundadır. Hizmet teknik destekle sınırlıdır.' },
      { q: 'Kamu yapılarında teknik danışmanlık hangi riskleri azaltır?', a: 'Şartname belirsizliği, metraj ve hakediş hataları ile koordinasyon eksikliği gibi riskleri azaltmaya yardımcı olur.' },
      { q: 'Erişilebilirlik ve güvenlik nasıl ele alınır?', a: 'Erişilebilirlik ve güvenlik gereksinimleri tasarım kontrolünde mevzuat ve ilgili standartlar çerçevesinde incelenir.' },
      { q: 'Uzun ömürlü işletme için hangi yaklaşım izlenir?', a: 'Yaşam döngüsü maliyeti ve bakım kolaylığı tasarım kararlarında dikkate alınır; işletme dokümantasyonu eksiksiz teslim edilir.' },
    ],
  },
  {
    slug: 'ticari-yapilar',
    title: 'Ticari Yapılar',
    sectorKey: 'ticari',
    icon: 'expertise/commercial',
    summary: 'Ofis binaları, alışveriş merkezleri ve ticari yapılarda verimli, esnek ve işletme dostu sistem tasarımları için danışmanlık.',
    intro: [
      'Ticari yapılarda yatırımın geri dönüşü; kiralanabilir alan verimliliği, işletme maliyeti ve kiracı memnuniyetiyle doğrudan ilişkilidir. Esnek yerleşim, kiracıya özel sistem uyarlamaları ve düşük işletme maliyeti bu yapılarda başlıca hedeflerdir.',
      'Enerji maliyeti ve bakım giderleri, yatırımcı için net işletme gelirini belirler; bu yüzden sistem seçimlerinde yaşam döngüsü maliyeti ve ölçülebilir performans öne çıkar.',
    ],
    challenges: [
      { title: 'Alan verimliliği', text: 'Teknik alanların (şaft, makine dairesi) minimize edilerek kiralanabilir alanın artırılması tasarımla yönetilir.' },
      { title: 'Kiracı esnekliği', text: 'Kiracı değişimlerinde düşük maliyetle uyarlanabilen HVAC, elektrik ve otomasyon altyapısı gerekir.' },
      { title: 'İşletme maliyeti', text: 'Enerji izleme, bakım planlaması ve otomasyon ile işletme giderlerinin şeffaf yönetimi.' },
      { title: 'Sertifikasyon ve performans', text: 'Yeşil bina sertifikasyon hedefleri ve kurumsal sürdürülebilirlik beklentileri tasarımı etkiler.' },
    ],
    services: ['mep-danismanligi', 'energy-monitoring', 'building-performance', 'sustainability', 'cost-planning'],
    faq: [
      { q: 'Ticari yapılarda hangi aşamada danışmanlık alınmalı?', a: 'Kavramsal tasarım aşaması; alan verimliliği ve sistem seçimleri bu aşamada belirlenir.' },
      { q: 'Kiracıya özel uygulamalar nasıl yönetilir?', a: 'Kiracı uygulama (fit-out) rehberi ve teknik kriterler hazırlanarak altyapı ile uyumlu uygulama sağlanır.' },
      { q: 'Ofis ve ticari yapılarda hangi konular kritiktir?', a: 'Kiralanabilir alan verimliliği, kiracı esnekliği, işletme maliyeti ve çevresel performans kritik konulardır.' },
      { q: 'Sertifikasyon hedefi varsa nasıl destek verilir?', a: 'Sürdürülebilirlik hedeflerinin tasarıma yansıtılması ve gereksinimlerin takibi için teknik danışmanlık sağlanabilir; sertifikasyon kararı ilgili kuruluşlara aittir.' },
      { q: 'Kiracıya özel uygulamalar nasıl koordine edilir?', a: 'Kiracı değişiklikleri model ve şartname üzerinden kontrol edilerek ortak sistemlere etkisi değerlendirilir.' },
    ],
  },
  {
    slug: 'karma-kullanim',
    title: 'Karma Kullanım Projeleri',
    sectorKey: 'karma',
    icon: 'services/building-performance',
    summary: 'Konut, ofis, ticaret ve sosyal alanları birleştiren karma projelerde entegre mühendislik çözümleri için danışmanlık.',
    intro: [
      'Karma kullanımlı projeler; konut, ofis, otel, alışveriş ve sosyal alanları tek bir yerleşke veya kule içinde birleştirir. Farklı kullanıcı gruplarının farklı çalışma saatleri ve sistem beklentileri, tasarımda ortak altyapı ile ayrışma ihtiyacını birlikte yönetmeyi gerektirir.',
      'Bu projelerde ölçek ve disiplin sayısı arttıkça koordinasyon, yangın güvenliği ve işletme sorumluluklarının net tanımı belirleyici hale gelir.',
    ],
    challenges: [
      { title: 'Ortak ve ayrık sistemler', text: 'Hangi sistemlerin ortak (merkezi santral, jeneratör), hangilerinin işlev bazlı ayrı olacağı teknik-ekonomik analizle belirlenmelidir.' },
      { title: 'Yangın ve duman kontrol', text: 'Farklı kullanım türlerinin bir arada bulunduğu yapılarda yangın bölmeleri ve duman kontrol stratejileri özel dikkat gerektirir.' },
      { title: 'Ölçülü ve faturalandırılabilir tüketim', text: 'Farklı kullanıcıların tüketiminin alt sayaçlarla ayrı ölçülmesi, işletme maliyetinin adil paylaşımı için gereklidir.' },
      { title: 'Aşamalı inşaat ve işletme', text: 'Büyük projelerde bazı bölümler işletmeye alınırken diğerleri inşa halindedir; geçici sistemler ve aşamalı devreye alma planlanmalıdır.' },
    ],
    services: ['bim-coordination', 'mep-danismanligi', 'energy-monitoring', 'teknik-proje-yonetimi', 'commissioning-advisory'],
    faq: [
      { q: 'Karma projelerde BIM neden önemlidir?', a: 'Disiplin ve ekip sayısı çok olduğundan koordinasyon ve çakışma kontrolü için tek bir birleşik model büyük fayda sağlar.' },
      { q: 'İşletme sorumlulukları nasıl ayrıştırılır?', a: 'Sistem sınırları ve ölçüm noktaları tasarımda tanımlanarak işletme ve sorumluluk dağılımı netleştirilir.' },
      { q: 'Karma kullanımlı projelerde sistem ayrımı nasıl yapılır?', a: 'Ortak ve ayrık sistemler tasarım aşamasında tanımlanır; ölçüm ve faturalandırma ile işletme sorumlulukları netleştirilir.' },
      { q: 'Yangın güvenliği nasıl ele alınır?', a: 'Farklı kullanım türleri arasındaki yangın ve duman kontrol gereksinimleri mevzuat çerçevesinde tasarımda incelenir.' },
      { q: 'Aşamalı inşaat nasıl planlanır?', a: 'Bölümlerin farklı zamanlarda devreye alınmasına uygun altyapı ve geçici çözümler önceden planlanır.' },
    ],
  },
  {
    slug: 'endustriyel-yapilar',
    title: 'Endüstriyel Yapılar',
    sectorKey: 'endustriyel',
    icon: 'services/mep',
    summary: 'Üretim tesisleri, depolar ve endüstriyel yapılarda süreç gereksinimlerine uygun altyapı, enerji ve güvenlik danışmanlığı.',
    intro: [
      'Endüstriyel yapılarda bina sistemleri üretim sürecini destekler: proses soğutma, basınçlı hava, özel havalandırma, yüksek güç dağıtımı ve güvenlik gereksinimleri tasarımın merkezindedir. Süreç ile bina altyapısı arasındaki arayüzlerin doğru tanımlanması önemlidir.',
      'Enerji yoğun tesislerde enerji verimliliği doğrudan rekabet gücünü etkiler; ölçüm ve izleme altyapısı, tasarruf fırsatlarının belirlenmesinde belirleyicidir.',
    ],
    challenges: [
      { title: 'Süreç–bina arayüzü', text: 'Üretim hattının gerektirdiği besleme ve atık sistemlerinin bina altyapısıyla koordinasyonu erken aşamada yapılmalıdır.' },
      { title: 'Yüksek güç ve enerji yönetimi', text: 'Yüksek talep, reaktif güç yönetimi ve alt sayaçlı izleme maliyetin kontrolü için gereklidir.' },
      { title: 'Güvenlik ve yangın', text: 'Yanıcı/patlayıcı madde veya özel risk içeren üretimlerde ilgili güvenlik ve yangın gereksinimleri tasarımda dikkate alınmalıdır.' },
      { title: 'Büyüme esnekliği', text: 'Üretim kapasitesi artışlarına uyum için altyapının modüler ve genişletilebilir kurgulanması gerekir.' },
    ],
    services: ['celik-yapi-danismanligi', 'enerji-yonetimi', 'energy-monitoring', 'enerji-faturasi-analizi', 'elektrik-proje-danismanligi', 'saha-teknik-kontrol'],
    faq: [
      { q: 'Proses mühendisliği hizmetine dahil mi?', a: 'Hizmet bina ve altyapı sistemlerine odaklanır; proses tasarımı ilgili proses mühendisleriyle koordine edilir.' },
      { q: 'Çalışan tesiste enerji etüdü yapılabilir mi?', a: 'Evet; üretimi aksatmadan ölçüm ve analiz yapılacak şekilde çalışma planlanır.' },
      { q: 'Endüstriyel yapılarda bina ve proses arayüzü neden önemlidir?', a: 'Proses gereksinimleri bina sistemlerini (havalandırma, güç, yangın) doğrudan etkiler; arayüzün erken tanımlanması tasarım hatalarını azaltır.' },
      { q: 'Enerji yönetimi endüstriyel tesislerde nasıl yapılır?', a: 'Alt sayaç ve izleme ile tüketim kaynakları belirlenir; verimlilik ve talep yönetimi fırsatları değerlendirilir.' },
      { q: 'Tesis büyümesine nasıl hazırlanılır?', a: 'Altyapının genişlemeye uygun boyutlandırılması ve esnek tasarım, ileride yapılacak ek yatırımların maliyetini azaltır.' },
    ],
  },
  {
    slug: 'mevcut-yapilar',
    title: 'Mevcut Yapılar',
    sectorKey: 'mevcut',
    icon: 'expertise/analysis',
    summary: 'Mevcut binaların teknik durumunun, performansının ve iyileştirme potansiyelinin değerlendirilmesi; yenileme ve işletme optimizasyonu.',
    intro: [
      'Mevcut yapıların büyük bölümü eski sistemlerle, eksik veya güncel olmayan dokümantasyonla işletilmektedir. Yenileme veya işlev değişikliği kararları, yapının gerçek durumunun doğru bilinmesine dayanmalıdır.',
      'Mevcut yapı çalışmaları; durum tespiti, performans analizi, dijital dokümantasyon (Scan-to-BIM) ve önceliklendirilmiş iyileştirme planı adımlarından oluşur.',
    ],
    challenges: [
      { title: 'Eksik dokümantasyon', text: 'As-built çizimler güncel olmayabilir; saha tespiti ve gerektiğinde tarama ile güvenilir mevcut durum modeli oluşturulur.' },
      { title: 'Eski sistemler ve verimlilik', text: 'Verimi düşmüş ekipmanların ve kontrol mantıklarının enerji ve konfor üzerindeki etkisi analiz edilmelidir.' },
      { title: 'Kullanımda yenileme', text: 'Binanın kullanımı devam ederken yapılacak işlerin aşamalı ve kesintisiz planlanması gerekir.' },
      { title: 'Önceliklendirme', text: 'Sınırlı bütçeyle hangi iyileştirmelerin hangi sırayla yapılacağı teknik-ekonomik analizle belirlenmelidir.' },
    ],
    services: ['mevcut-yapi-teknik-degerlendirme', 'technical-due-diligence', 'scan-to-bim', 'retrofit-advisory', 'mevcut-sistem-performans-analizi'],
    faq: [
      { q: 'Mevcut yapı çalışması hangi çıktıyı verir?', a: 'Mevcut durum raporu, sistem bazlı sorun ve fırsat listesi ve önceliklendirilmiş bir iyileştirme planı.' },
      { q: 'Yapısal güvenlik değerlendirmesi dahil mi?', a: 'Taşıyıcı sistem analizi yetkili statik mühendisliği gerektirir ve ayrıca yürütülmelidir; çalışma bina sistemlerine ve performansa odaklanır.' },
      { q: 'Mevcut yapılarda çalışma nereden başlar?', a: 'Dokümantasyonun derlenmesi, saha tespiti ve gerekirse ölçüm veya tarama ile mevcut durumun belirlenmesiyle başlar.' },
      { q: 'Kullanımda olan yapıda yenileme nasıl yönetilir?', a: 'Kesinti ve güvenlik riskleri aşamalandırma ve geçici çözümlerle yönetilir; işletme ekibiyle koordinasyon yapılır.' },
      { q: 'Yenileme önceliği nasıl belirlenir?', a: 'Risk, enerji ve işletme etkisi ile maliyet birlikte değerlendirilerek öncelik sırası oluşturulur.' },
    ],
  },
]);
