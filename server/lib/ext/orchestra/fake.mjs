// AI Orchestra TEST/GELİŞTİRME sahte modeli — yalnızca ORCH_FAKE_LLM=1 ve NODE_ENV!=production iken kullanılır (llm.mjs).
// Girdideki konuyu, kaynak adreslerini ve izin verilen kategori/sayfa listelerini okuyup şemaya uyan deterministik JSON üretir.
// Amaç: motoru, doğrulamaları ve arayüzü gerçek bir sağlayıcı olmadan sınamak. Gerçek içerik kalitesi hakkında hiçbir şey kanıtlamaz.

const section = (prompt, title) => {
  const m = new RegExp(`## ${title}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(prompt);
  return m ? m[1].trim() : '';
};
const topicOf = (p) => section(p, 'KONU').split('\n')[0].slice(0, 120) || 'Konu';
const urlsOf = (p) => [...p.matchAll(/^URL:\s*(\S+)/gm)].map((m) => m[1]);
const para = (n, t) => `${t} konusunda ${n}. paragraf: yöntem, kapsam ve uygulama sırasında dikkat edilecek noktalar mühendislik ekibinin ortak çalışmasıyla netleştirilir; kararlar proje verisine ve ilgili standartlara göre belgelenir.`;

export const fakeRespond = (key, prompt) => {
  const topic = topicOf(prompt);
  if (key === 'master') return JSON.stringify(fakePlan(prompt));
  if (key === 'research') {
    const urls = urlsOf(prompt);
    return JSON.stringify({
      brief: `${topic} için kaynaklı araştırma özeti: eldeki kaynaklar ve genel mühendislik bilgisi birlikte değerlendirildi.`,
      angle: `${topic}: uygulamada karşılaşılan pratik sorunlar`,
      key_points: [
        { point: `${topic} planlama aşamasında ele alınmalıdır`, source_urls: urls.slice(0, 1).concat(['https://sahte-kaynak.example/uydurma']), confidence: 'kaynakli' },
        { point: 'Disiplinler arası koordinasyon maliyeti düşürür', source_urls: [], confidence: 'genel_bilgi' },
      ],
      outline: ['Giriş', 'Neden önemli', 'Uygulama adımları', 'Sık yapılan hatalar', 'Sonuç'],
      gaps: urls.length ? [] : ['Pazar & Medya kaynaklarında eşleşen öğe yok'],
      sources: urls.slice(0, 2).map((u) => ({ url: u, title: 'Kaynak' })).concat([{ url: 'https://sahte-kaynak.example/uydurma', title: 'Uydurma' }]),
    });
  }
  if (key === 'content') {
    const cat = (section(prompt, 'İZİN VERİLEN KATEGORİLER').split('|')[0] || 'BIM').trim();
    const t = topic.charAt(0).toLocaleUpperCase('tr') + topic.slice(1);
    const body = ['## Giriş', para(1, t), para(2, t), '## Neden Önemli', para(3, t), para(4, t), '## Uygulama Adımları', para(5, t), para(6, t), '## Sık Yapılan Hatalar', para(7, t), para(8, t), '## Sonuç', para(9, t)].join('\n\n')
      + '\n\n<script>alert(1)</script> Ayrıntı için [dış kaynak](https://izinsiz-site.example/x) ve [iç sayfa](/hizmetler).';
    return JSON.stringify({ title: `${t}: Pratik Rehber ve Dikkat Edilecek Noktalar`, description: `${t} konusunda yöntem, kapsam ve uygulama adımlarını mühendislik bakışıyla özetleyen rehber; sık hatalar ve çözümleri.`, excerpt: `${t} için kısa rehber.`, category: cat, tags: ['rehber', 'mühendislik'], body, claims_needing_source: [] });
  }
  if (key === 'seo') {
    const pages = [...section(prompt, 'MEVCUT SİTE SAYFALARI').matchAll(/→ (\/\S*)/g)].map((m) => m[1]);
    const t = JSON.parse(section(prompt, 'TASLAK').split('\n')[0] || '{}');
    return JSON.stringify({
      title: String(t.title ?? 'Rehber').slice(0, 60), description: String(t.description ?? 'Açıklama').padEnd(125, ' ve ayrıntılar').slice(0, 158), slug: String(t.slug ?? 'rehber'), focus: topic.slice(0, 40), tags: ['seo'],
      internal_links: [...pages.slice(0, 2).map((u) => ({ url: u, anchor: 'ilgili sayfa' })), { url: '/uydurma-sayfa-yok', anchor: 'uydurma' }],
      checks: [], score: 0,
    });
  }
  if (key === 'qa') {
    const bad = /\[KRİTİK-TEST\]/.test(prompt);
    return JSON.stringify({ passed: !bad, summary: bad ? 'Kritik bir sorun bulundu.' : 'Taslak genel olarak tutarlı; kaynaksız kesin iddia görülmedi.', issues: bad ? [{ severity: 'kritik', text: 'Test amaçlı kritik bulgu' }] : [{ severity: 'bilgi', text: 'Başlık sorunsuz.' }] });
  }
  if (key === 'competitor') return JSON.stringify({ summary: 'Rakip kayıtları incelendi.', findings: [{ competitor: 'Örnek', observation: 'Son taramada değişiklik görülmedi.', source_url: urlsOf(prompt)[0] ?? 'https://sahte.example/x' }], opportunities: ['Yeni içerik fırsatı'], gaps: [] });
  if (key === 'mep') return JSON.stringify({ summary: 'Metin teknik olarak tutarlı görünüyor.', findings: [{ severity: 'bilgi', text: 'Terimler tutarlı.' }], uncertain: ['Standart numaraları bir uzmanca doğrulanmalı'] });
  if (key === 'analytics') return JSON.stringify({ summary: 'Sayaçlar incelendi; veri sınırlı.', observations: [{ text: 'Son 30 gün görüntüleme sayısı verilen sayaçtan alınmıştır.', metric: 'last30dViews' }], recommendations: ['Daha fazla veri biriktikçe yeniden değerlendirin'] });
  if (key === 'social') return JSON.stringify({ posts: [{ platform: 'linkedin', text: `${topic} hakkında yeni bir rehber yayına hazırlanıyor: yöntem, kapsam ve dikkat edilecek noktalar.`, hashtags: ['mühendislik', 'BIM'] }, { platform: 'x', text: `${topic}: pratik rehber hazırlanıyor.`, hashtags: ['BIM'] }] });
  return '{}';
};

const fakePlan = (prompt) => {
  const cmd = section(prompt, 'KOMUT').toLowerCase();
  const steps = [];
  const topicM = /([a-zçğıöşü0-9 .-]{3,60}?)\s+(?:konusunda|hakkında|ile ilgili)/i.exec(cmd);
  const topic = (topicM?.[1] ?? 'BIM koordinasyonu').trim();
  const unsupported = [];
  if (/blog|yazı/.test(cmd)) {
    steps.push({ ref: 'arastirma', kind: 'agent', agent: 'research', title: `Araştırma: ${topic}`, depends_on: [], input: { topic } });
    steps.push({ ref: 'yazi', kind: 'agent', agent: 'content', title: 'Blog taslağını yaz', depends_on: ['arastirma'], input: { topic } });
    steps.push({ ref: 'seo', kind: 'agent', agent: 'seo', title: 'SEO analizi ve iyileştirme', depends_on: ['yazi'], input: { topic } });
    steps.push({ ref: 'kalite', kind: 'agent', agent: 'qa', title: 'Kalite denetimi', depends_on: ['yazi', 'seo'], input: {} });
    steps.push({ ref: 'onay', kind: 'approval', agent: '', title: 'İnsan onayı: blog taslağı', depends_on: ['kalite'], input: {} });
    steps.push({ ref: 'taslak', kind: 'action', agent: 'action.blog_draft', title: 'Blog editöründe taslak oluştur', depends_on: ['onay', 'yazi', 'seo'], input: {} });
  }
  if (/rakip/.test(cmd)) steps.push({ ref: 'rakip', kind: 'agent', agent: 'competitor', title: 'Rakip içerik analizi', depends_on: [], input: { topic } });
  if (/linkedin|sosyal/.test(cmd)) {
    const dep = steps.some((s) => s.ref === 'seo') ? ['seo'] : [];
    steps.push({ ref: 'sosyal', kind: 'agent', agent: 'social', title: 'LinkedIn gönderisi hazırla', depends_on: dep, input: { topic } });
    steps.push({ ref: 'sosyal_onay', kind: 'approval', agent: '', title: 'İnsan onayı: sosyal gönderi', depends_on: ['sosyal'], input: {} });
    steps.push({ ref: 'sosyal_taslak', kind: 'action', agent: 'action.social_draft', title: 'Social Studio taslağı oluştur', depends_on: ['sosyal_onay', 'sosyal'], input: {} });
  }
  if (/teklif|e-?posta gönder/.test(cmd)) unsupported.push('Harici e-posta/teklif gönderimi bu sürümde yok');
  if (!steps.length) steps.push({ ref: 'arastirma', kind: 'agent', agent: 'research', title: `Sektör araştırması: ${topic}`, depends_on: [], input: { topic } });
  return { summary: `Komut ${steps.length} adıma ayrıldı.`, steps, unsupported };
};
