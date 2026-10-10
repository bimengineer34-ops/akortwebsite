# AKORT Teknik Asistanı — Mimari ve API Sözleşmesi

## Bugünkü durum (Faz 17)

- UI: `src/components/assistant/TechnicalAssistant.astro` (tüm sayfalarda, sağ alt).
- Metinler / ayarlar: `src/data/assistant.ts`.
- Taşıma katmanı: `src/components/assistant/transport.ts`.
- **Mod: Yönlendirme (LocalTransport).** LLM yok. Soru, site arama indeksinde (`/arama-index.json`, yalnızca yayınlanmış içerik)
  IDF ağırlıklı olarak eşleştirilir; **yalnızca sitede var olan sayfalar** kaynak olarak önerilir. Eşleşme yoksa hizmet talep formuna yönlendirir.
  Asistan cevap metni **uydurmaz** (NO_FAKE_DATA).
- Konuşma `sessionStorage`'da (`akort-assistant-v1`) tutulur: sayfa değişince korunur, sekme kapanınca silinir. Sunucuya hiçbir şey gönderilmez.

| Kontrol | Davranış |
|---|---|
| Launcher | Paneli açar/kapatır (`aria-expanded`), okunmamış yanıt varsa nokta gösterir |
| Küçült / Esc | Paneli gizler, konuşma korunur, odak launcher'a döner |
| Kapat | Konuşmayı sıfırlar ve paneli kapatır |
| Hızlı sorular | `assistant.quickQuestions` |

## Hedef mimari

```
Frontend (bu UI) → POST /api/assistant → RAG (retriever) → Vector DB → LLM → AKORT Knowledge Base
```

Geçiş: `src/data/assistant.ts` → `endpoint: '/api/assistant'`. UI `HttpTransport`'a otomatik geçer, başka değişiklik gerekmez.

### İstek — `POST /api/assistant`

```ts
interface AssistantRequest {
  question: string;               // ≤ 500 karakter
  history: { role: 'user' | 'assistant'; content: string }[]; // son 8 mesaj
  pageUrl: string;                // ör. "/hizmetler/bim-danismanligi" — bağlam önceliği
  locale: 'tr-TR';
}
```

### Yanıt — `200 application/json`

```ts
interface AssistantResponse {
  answer: string;                                          // düz metin (HTML değil; UI textContent ile basar)
  sources: { title: string; url: string; type?: string }[]; // yalnızca AKORT sitesi/knowledge base URL'leri
  handoff?: boolean;                                       // true → UI "Uzman ekibe sorun" linki gösterir
}
```

Hata durumunda (`!res.ok` / ağ hatası) UI `assistant.error` mesajını gösterir.

### Backend için gereksinimler (yapılacak)

- **Bilgi tabanı:** Yalnızca onaylı içerik (yayınlanmış hizmet/blog/proje sayfaları, onaylı dokümanlar). Doğrulanmamış rakam/sertifika içeren kaynak eklenmemeli.
- **Kaynak zorunluluğu:** Her yanıt en az bir kaynağa dayanmalı; dayanak yoksa `handoff: true`.
- **KVKK:** Mesaj kaydı tutulacaksa aydınlatma metni + panelde bilgilendirme (`assistant.privacy` güncellenmeli), saklama süresi, anonimleştirme.
- **Güvenlik:** Rate limit, prompt injection filtreleri, maksimum girdi uzunluğu (sunucu tarafında da), CORS yalnızca site origin'i.
- **Model:** Güncel Claude modelleri önerilir (ör. `claude-sonnet-5-5`); entegrasyon sırasında güncel model listesi doğrulanmalı.
