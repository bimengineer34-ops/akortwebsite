import { ov } from '@/utils/overrides';
/**
 * AKORT Teknik Asistanı — metinler ve yapılandırma.
 * endpoint null iken asistan "yerel yönlendirme" modunda çalışır: LLM yok, soruyu sitedeki ilgili sayfalara yönlendirir.
 */
export const assistant = ov('assistant.assistant', {
  title: 'AKORT Teknik Asistanı',
  status: { local: 'Yönlendirme modu', remote: 'Çevrimiçi' },
  welcome:
    'Merhaba! BIM, MEP, enerji verimliliği ve teknik danışmanlık hizmetlerimiz hakkında sorunuzu yazın; sizi ilgili sayfalara yönlendireyim.',
  quickQuestions: [
    'BIM danışmanlığı neleri kapsar?',
    'Enerji verimliliği analizi',
    'Hakediş kontrolü hizmetiniz var mı?',
    'Teklif almak için ne gerekli?',
  ],
  /** Yerel mod yanıtları — cevap uydurulmaz, yalnızca sitedeki sayfalar önerilir */
  local: {
    found: 'Bu konuyla ilgili sayfalarımız:',
    notFound: 'Bu konuda sitemizde doğrudan bir içerik bulamadım. Sorunuzu uzman ekibimize iletmek için hizmet talep formunu kullanabilirsiniz.',
  },
  error: 'Şu anda yanıt veremiyorum. Lütfen daha sonra tekrar deneyin ya da iletişim formunu kullanın.',
  contact: { label: 'Uzman ekibe sorun', href: '/iletisim#hizmet-talep-formu' },
  privacy: 'Ön izleme sürümü: mesajlarınız sunucuya gönderilmez, yalnızca bu tarayıcı oturumunda tutulur.',
  inputPlaceholder: 'Sorunuzu yazın…',
  maxLength: 500,
  /** Bağlam olarak API'ye gönderilecek son mesaj sayısı */
  historyLimit: 8,
  /** Gelecek: Frontend → /api/assistant → RAG → Vector DB → LLM → AKORT Knowledge Base */
  endpoint: null as string | null,
  indexUrl: '/arama-index.json',
  storageKey: 'akort-assistant-v1',
});
