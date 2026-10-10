/**
 * AKORT Teknik Asistanı — taşıma katmanı (transport) sözleşmesi.
 *
 * Hedef mimari (Master Prompt §23):  Frontend → /api/assistant → RAG → Vector DB → LLM → AKORT Knowledge Base
 *
 * Bugün: `LocalTransport` — LLM yok. Soruyu site arama indeksinde (/arama-index.json) eşleştirir ve yalnızca
 * sitede GERÇEKTEN var olan sayfaları kaynak olarak döndürür. Cevap uydurmaz.
 * Yarın: `HttpTransport` aynı arayüzle `assistant.endpoint`'e bağlanır; UI değişmez.
 */
import { foldTr } from '@/utils/search';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** POST /api/assistant istek gövdesi */
export interface AssistantRequest {
  question: string;
  /** Son N mesaj (bağlam) */
  history: AssistantMessage[];
  /** Kullanıcının bulunduğu sayfa — RAG'de bağlam önceliği için */
  pageUrl: string;
  locale: 'tr-TR';
}

export interface AssistantSource {
  title: string;
  url: string;
  type?: string;
}

/** POST /api/assistant yanıt gövdesi */
export interface AssistantResponse {
  answer: string;
  sources: AssistantSource[];
  /** Asistan konuyu bilmiyor / insan desteği öneriyor */
  handoff?: boolean;
}

export interface AssistantTransport {
  readonly mode: 'local' | 'remote';
  send(req: AssistantRequest): Promise<AssistantResponse>;
}

interface SearchDoc {
  title: string;
  url: string;
  type: string;
  text: string;
}

/** Türkçe soru kalıplarındaki dolgu kelimeler — eşleştirmede yok sayılır. */
const STOP = new Set(
  'bir ve ile icin mi mu mı mü ne nedir nasil nedir? hakkinda bilgi var mi neler kapsar yapilir gerekli hizmetiniz hizmetleriniz sizin size bana olan olarak da de ki bu su'
    .split(' ')
    .map(foldTr),
);

export class LocalTransport implements AssistantTransport {
  readonly mode = 'local' as const;
  private index: SearchDoc[] | null = null;

  constructor(
    private readonly indexUrl: string,
    private readonly texts: { found: string; notFound: string },
  ) {}

  private async load(): Promise<SearchDoc[]> {
    if (!this.index) {
      const res = await fetch(this.indexUrl);
      this.index = res.ok ? ((await res.json()) as SearchDoc[]) : [];
    }
    return this.index;
  }

  async send(req: AssistantRequest): Promise<AssistantResponse> {
    const terms = foldTr(req.question)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t));
    if (!terms.length) return { answer: this.texts.notFound, sources: [], handoff: true };

    const docs = await this.load();
    // IDF ağırlığı: "danışmanlığı" gibi çoğu sayfada geçen kelimeler az, "BIM" gibi ayırt edici kelimeler çok puan alır.
    const folded = docs.map((d) => ({ d, title: foldTr(d.title), text: foldTr(d.text) }));
    const idf = new Map(
      terms.map((t) => {
        const df = folded.filter((f) => f.title.includes(t) || f.text.includes(t)).length;
        return [t, Math.log((folded.length + 1) / (df + 1)) + 0.1];
      }),
    );
    const scored = folded
      .map(({ d, title, text }) => {
        let score = 0;
        let matched = 0;
        for (const t of terms) {
          const w = idf.get(t) ?? 0;
          if (title.includes(t)) score += 3 * w;
          if (text.includes(t)) score += w;
          if (title.includes(t) || text.includes(t)) matched++;
        }
        // Tüm terimleri kapsayan sonuçlara ve hizmet sayfalarına küçük öncelik
        if (matched === terms.length) score *= 1.5;
        if (d.type === 'Hizmet') score *= 1.1;
        return { d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!scored.length) return { answer: this.texts.notFound, sources: [], handoff: true };
    return {
      answer: this.texts.found,
      sources: scored.map(({ d }) => ({ title: d.title, url: d.url, type: d.type })),
      handoff: false,
    };
  }
}

export class HttpTransport implements AssistantTransport {
  readonly mode = 'remote' as const;
  constructor(private readonly endpoint: string) {}

  async send(req: AssistantRequest): Promise<AssistantResponse> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`assistant ${res.status}`);
    const data = (await res.json()) as Partial<AssistantResponse>;
    return { answer: data.answer ?? '', sources: data.sources ?? [], handoff: data.handoff ?? false };
  }
}
