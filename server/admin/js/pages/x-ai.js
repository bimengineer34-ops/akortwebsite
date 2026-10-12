// AI İçerik Stüdyosu: seçili metin işlemleri, çok modelli karşılaştırma (isteğe bağlı), kabul/red, kullanım geçmişi
import { api } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, fmtDate } from '../ui.js';
import { pageHead, infoBox, needConn, empty } from './x-common.js';
import { kpiCard, barChart, donut, panel } from '../charts.js';

export const renderAiStudio = async (ctx) => {
  ctx.setTitle('AI İçerik Stüdyosu');
  let d;
  try { d = await api.get('/x/ai'); } catch (e) { return errorBanner(e); }
  const connected = d.providers.filter((p) => p.connected);
  const root = h('div', { class: 'stack' });
  if (!connected.length) {
    return h('div', {}, pageHead('AI İçerik Stüdyosu', 'GPT, Claude ve Gemini ile metin üretimi ve düzenleme.'),
      needConn('Henüz hiçbir yapay zekâ sağlayıcısına bağlanılmadı. Entegrasyonlar sayfasından en az bir API anahtarı ekleyin.'),
      h('div', { class: 'spacer' }), h('a', { class: 'btn', href: '#/entegrasyonlar' }, icon('gear', 16), 'Entegrasyonlara git'));
  }
  const task = h('select', { class: 'select' }, d.tasks.map((t) => h('option', { value: t.key }, t.label)));
  const text = h('textarea', { class: 'textarea', rows: 10, placeholder: 'Konu veya düzenlenecek metni yapıştırın…', maxlength: 24000 });
  const focus = h('input', { class: 'input', placeholder: 'Odak sorgu (isteğe bağlı)' });
  const tone = h('input', { class: 'input', placeholder: 'Ton notu (isteğe bağlı, ör. daha teknik)' });
  const provBoxes = connected.map((p, i) => ({ p, el: h('input', { type: 'checkbox', checked: i === 0 }) }));
  const consent = h('input', { type: 'checkbox' });
  const out = h('div', { class: 'stack' });
  const counter = h('div', { class: 'counter' });
  text.addEventListener('input', () => { counter.textContent = `${text.value.length}/24000`; });

  const card = (r, p) => {
    const box = h('div', { class: 'card card-pad stack' });
    const ta = h('textarea', { class: 'textarea', rows: 10 }); ta.value = r.output; // metin olarak; HTML olarak asla işlenmez
    box.append(
      h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, `${p.label} · ${r.model}`), r.usage.input != null ? chip(`${r.usage.input}+${r.usage.output} token`) : null, r.usage.costUsd != null ? chip(`≈ $${r.usage.costUsd.toFixed(4)}`) : null),
      r.unverifiedClaims ? infoBox('Metinde [KAYNAK GEREKLİ] işaretleri var: bu iddialar doğrulanmadan yayımlanmamalıdır.', 'warn') : null,
      ta,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn sm', onclick: async () => { await navigator.clipboard.writeText(ta.value); await api.post(`/x/ai/calisma/${r.id}/kabul`); toast('Kopyalandı ve "kabul" olarak kaydedildi. İçeriğe elle yapıştırın; insan denetimi olmadan yayımlamayın.', 'ok'); } }, icon('copy', 14), 'Kabul et ve kopyala'),
        h('button', { class: 'btn secondary sm', onclick: async () => { await api.post(`/x/ai/calisma/${r.id}/red`); box.remove(); toast('Reddedildi'); } }, 'Reddet')));
    return box;
  };
  const go = async (btn) => {
    const chosen = provBoxes.filter((x) => x.el.checked).map((x) => x.p);
    if (!chosen.length) return toast('En az bir sağlayıcı seçin', 'err');
    if (!text.value.trim()) return toast('Metin boş', 'err');
    if (!consent.checked) return toast('Metnin harici bir yapay zekâ sağlayıcısına gönderileceğini onaylayın (korumalı proje belgelerini göndermeyin)', 'err');
    btn.disabled = true;
    out.replaceChildren(spinner('Üretiliyor…'));
    const cards = [];
    await Promise.all(chosen.map(async (p) => {
      try { cards.push(card(await api.post('/x/ai/uret', { provider: p.id, task: task.value, text: text.value, focus: focus.value, tone: tone.value }), p)); } catch (e) { cards.push(h('div', {}, errorBanner(e))); }
    }));
    out.replaceChildren(...cards);
    btn.disabled = false;
    loadHistory();
  };
  const hist = h('div');
  const loadHistory = async () => {
    try { d = await api.get('/x/ai'); } catch { return; }
    let gr = null;
    try { gr = await api.get('/x/grafik?gun=30'); } catch { /* grafik opsiyonel */ }
    const month = d.providers.reduce((a, p) => ({ calls: a.calls + p.month.calls, tok: a.tok + p.month.inputTokens + p.month.outputTokens }), { calls: 0, tok: 0 });
    hist.replaceChildren(h('div', { class: 'kpis' }, kpiCard({ ic: 'spark', label: 'Bu ay çağrı', value: month.calls, color: '#8b5cf6', goodUp: false }), kpiCard({ ic: 'doc', label: 'Bu ay token', value: month.tok, color: '#3b82f6', goodUp: false, target: d.providers.reduce((a, p) => a + (p.cfg.monthlyTokenBudget || 0), 0) || null }), kpiCard({ ic: 'plug', label: 'Bağlı sağlayıcı', value: d.providers.filter((p) => p.connected).length, unit: '/ 3', color: '#10b981' })),
      h('div', { class: 'dash-grid', style: 'margin-top:14px' }, h('div', { class: 'span-8' }, panel('Günlük token kullanımı (30 gün)', gr ? barChart({ labels: gr.labels, series: [{ name: 'Token', color: '#8b5cf6', values: gr.aiTokens }], height: 180 }) : empty('Veri yok'), { ic: 'spark' })), h('div', { class: 'span-4' }, panel('Sağlayıcıya göre token', donut({ items: d.providers.map((p, i) => ({ label: p.label, value: p.month.inputTokens + p.month.outputTokens, color: ['#10b981', '#f59e0b', '#3b82f6'][i] })).filter((x) => x.value), sub: 'token', empty: 'Henüz kullanım yok' }), { ic: 'plug' }))),
      h('div', { style: 'height:14px' }),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Son kullanım')),
      d.usage.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Zaman', 'Sağlayıcı / model', 'Görev', 'Token', 'Sonuç'].map((x) => h('th', {}, x)))), h('tbody', {}, d.usage.slice(0, 12).map((u) => h('tr', {}, h('td', {}, fmtDate(u.ts)), h('td', {}, `${u.provider} · ${u.model}`), h('td', {}, u.task), h('td', {}, u.input_tokens != null ? `${u.input_tokens}+${u.output_tokens}` : '—'), h('td', {}, u.ok ? chip('Başarılı', 'ok') : chip(u.error ?? 'Hata', 'danger'))))))) : empty('Henüz kullanım yok.')));
  };
  root.append(
    infoBox('Üretilen metin yalnızca düz metin olarak gösterilir (HTML çalıştırılmaz) ve siz kabul edip elle yapıştırana kadar hiçbir içeriğe kaydedilmez. Teknik/mevzuat iddiaları kaynak gerektirir; yayımlamadan önce insan incelemesi zorunludur.'),
    h('div', { class: 'grid cols-2' },
      h('div', { class: 'card card-pad stack' },
        field('Görev', task), field('Metin / konu', text), counter, field('Odak sorgu', focus), field('Ton', tone),
        h('div', { class: 'stack' }, h('b', {}, 'Sağlayıcı (birden fazla seçerseniz karşılaştırılır; her biri ayrı maliyettir)'), provBoxes.map(({ p, el }) => h('label', { class: 'switch' }, el, h('i'), h('span', {}, `${p.label} · ${p.cfg.model}`)))),
        h('label', { class: 'switch' }, consent, h('i'), h('span', {}, 'Bu metni harici AI sağlayıcısına göndermeyi onaylıyorum (korumalı proje belgesi içermiyor)')),
        h('button', { class: 'btn', onclick: (e) => go(e.target) }, icon('rocket', 16), 'Üret')),
      out),
    hist);
  loadHistory();
  return h('div', {}, pageHead('AI İçerik Stüdyosu', 'Seçili metni yeniden yazın, kısaltın, genişletin, çevirin; SEO başlık/meta önerileri alın.'), root);
};
