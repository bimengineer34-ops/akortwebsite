import { ov } from '@/utils/overrides';
import { verified, unverified, type Verifiable } from '@/utils/verified';

/**
 * Yazılımda kullanılan teknolojiler (Yazılım hizmeti sayfasında "Kullandığımız Teknolojiler").
 *
 * NO_FAKE_DATA: Yalnızca AKORT web sitesi ve yönetim panelinde GERÇEKTEN kullanılan teknolojiler `verified` işaretlidir.
 * Firmanın diğer projelerde kullandığı teknolojiler bu listede olası örneklerdir ve `unverified` olarak gelir:
 * yayında GÖSTERİLMEZ. Firma doğruladıkça Panel › Genel ve Menü › Kullanılan teknolojiler belgesinden "Doğrulandı" işaretlenir
 * (veya yeni teknoloji eklenir/silinir).
 */
export interface TechGroup {
  title: string;
  /** İsteğe bağlı kısa açıklama */
  text?: string;
  items: Verifiable<string>[];
}

const fromSite = 'Bu sitede ve yönetim panelinde kullanılıyor';
const todo = 'Firma doğrulamalı: projelerde kullanılıyorsa "Doğrulandı" işaretleyin, kullanılmıyorsa silin';

export const techStack = ov('techStack.techStack', {
  eyebrow: 'Teknoloji',
  title: 'Kullandığımız Teknolojiler',
  lead: 'Her projede teknoloji, ihtiyaca ve işverenin altyapısına göre seçilir. Aşağıda yazılım çalışmalarımızda kullandığımız başlıca teknolojiler yer alır.',
  note: 'Teknoloji seçimi araç değil ihtiyaç odaklıdır; mümkün olduğunda açık standartlar (ör. IFC) ve sürdürülebilir, bakımı kolay çözümler tercih edilir.',
  groups: [
    {
      title: 'Web ve Arayüz',
      text: 'Hızlı, erişilebilir ve arama motoru dostu uygulamalar',
      items: [verified('Astro', fromSite), verified('TypeScript', fromSite), verified('Tailwind CSS', fromSite), unverified('React', todo)],
    },
    {
      title: 'Sunucu ve Veri',
      text: 'Güvenli, bakımı kolay sunucu tarafı ve veri katmanı',
      items: [verified('Node.js', fromSite), verified('SQLite', fromSite), verified('REST / JSON API', fromSite), verified('SQL', fromSite), unverified('PostgreSQL', todo), unverified('Docker', todo)],
    },
    {
      title: 'BIM ve 3B Geometri',
      text: 'Açık BIM standartlarıyla model görüntüleme ve veri işleme',
      items: [verified('IFC (açık BIM standardı)', fromSite), verified('web-ifc', fromSite), verified('That Open Company bileşenleri', fromSite), verified('three.js (WebGL)', fromSite), unverified('Revit API', todo), unverified('Dynamo', todo)],
    },
    {
      title: 'Veri Analitiği',
      text: 'Veriden karar destek göstergeleri',
      items: [unverified('Python', todo), unverified('Pandas / NumPy', todo), unverified('Power BI', todo)],
    },
    {
      title: 'Yapay Zeka',
      text: 'Mühendis kararını destekleyen, denetlenebilir yapay zeka çözümleri',
      items: [
        verified('Kural ve içerik tabanlı teknik asistan (kaynak gösteren, uydurma yanıt üretmeyen)', 'Bu sitedeki Teknik Asistan bu yaklaşımla çalışıyor'),
        unverified('Büyük dil modelleri (LLM) ve doküman arama (RAG)', todo),
        unverified('Makine öğrenmesi ve tahminleme', todo),
        unverified('Bilgisayarlı görü (görüntü analizi)', todo),
      ],
    },
    {
      title: 'Güvenlik ve Altyapı',
      text: 'Güvenlik tasarımın başından itibaren',
      items: [verified('HTTPS / TLS ve güvenlik başlıkları', fromSite), verified('Rol tabanlı yetkilendirme ve 2 adımlı doğrulama', fromSite), verified('Yedekleme ve geri alma', fromSite), unverified('Linux sunucu yönetimi', todo)],
    },
  ] satisfies TechGroup[],
});
