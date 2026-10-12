// Entegrasyonlar ve API bütçe merkezi: sır kasası, sağlayıcı testi, model/bütçe, özellik bayrakları
import { api, session } from '../api.js';
import { h, icon, chip, toast, spinner, errorBanner, field, confirmBox } from '../ui.js';
import { pageHead, infoBox, needConn } from './x-common.js';

const providerCard = (p, reload) => {
  const admin = session.user.role === 'admin';
  const key = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: p.connected ? `Kayıtlı: ${p.secret?.hint ?? ''} (değiştirmek için yeni anahtar yazın)` : 'API anahtarını yapıştırın', disabled: !admin });
  const model = h('input', { class: 'input', value: p.cfg.model, list: `models-${p.id}`, disabled: !admin });
  const dl = h('datalist', { id: `models-${p.id}` });
  const budget = h('input', { class: 'input', type: 'number', min: 0, value: p.cfg.monthlyTokenBudget || '', placeholder: '0 = sınırsız', disabled: !admin });
  const pin = h('input', { class: 'input', type: 'number', min: 0, step: '0.01', value: p.cfg.priceInPerM ?? '', placeholder: 'USD / 1M girdi tokenı', disabled: !admin });
  const pout = h('input', { class: 'input', type: 'number', min: 0, step: '0.01', value: p.cfg.priceOutPerM ?? '', placeholder: 'USD / 1M çıktı tokenı', disabled: !admin });
  const run = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, 'err'); } btn.disabled = false; };
  return h('div', { class: 'card card-pad stack' },
    h('div', { class: 'row' }, h('h3', { class: 'grow' }, p.label), p.connected ? chip('Bağlı', 'ok') : chip('Bağlantı gerekli', 'warn'), p.breakerOpen ? chip('Geçici devre dışı', 'danger') : null),
    h('div', { class: 'small muted' }, `Bu ay: ${p.month.calls} çağrı · ${p.month.inputTokens + p.month.outputTokens} token · ${p.month.costUsd == null ? 'maliyet: fiyat tanımsız' : `≈ $${p.month.costUsd.toFixed(4)}`}`),
    field('API anahtarı (şifreli saklanır, geri gösterilmez)', key), h('a', { href: p.docs, target: '_blank', rel: 'noopener noreferrer', class: 'small' }, 'Anahtarı nereden alırım? ↗'),
    admin ? h('div', { class: 'row wrap' },
      h('button', { class: 'btn sm', onclick: (e) => run(e.target, async () => { if (!key.value.trim()) return toast('Anahtar yazın', 'err'); await api.put(`/x/ai/${p.id}/anahtar`, { key: key.value.trim() }); toast('Anahtar kaydedildi', 'ok'); reload(); }) }, 'Kaydet'),
      h('button', { class: 'btn secondary sm', disabled: !p.connected, onclick: (e) => run(e.target, async () => { const r = await api.post(`/x/ai/${p.id}/test`); dl.replaceChildren(...r.models.map((m) => h('option', { value: m }))); toast(`Bağlantı başarılı — ${r.modelCount} model listelendi`, 'ok'); }) }, icon('check', 14), 'Bağlantıyı test et'),
      p.connected ? h('button', { class: 'btn danger secondary sm', onclick: async () => { if (await confirmBox({ title: 'Anahtar silinsin mi?', message: `${p.label} bağlantısı kaldırılır.`, confirmLabel: 'Sil', danger: true })) { await api.del(`/x/ai/${p.id}/anahtar`); reload(); } } }, 'Anahtarı sil') : null) : null,
    h('div', { class: 'grid cols-2' }, field('Model (test sonrası listeden seçebilirsiniz)', h('div', {}, model, dl)), field('Aylık token bütçesi', budget)),
    h('div', { class: 'grid cols-2' }, field('Girdi fiyatı', pin), field('Çıktı fiyatı', pout)),
    admin ? h('button', { class: 'btn secondary sm', style: 'justify-self:start', onclick: (e) => run(e.target, async () => { await api.put(`/x/ai/${p.id}/ayar`, { model: model.value, monthlyTokenBudget: budget.value === '' ? 0 : budget.value, priceInPerM: pin.value === '' ? null : pin.value, priceOutPerM: pout.value === '' ? null : pout.value }); toast('Ayarlar kaydedildi', 'ok'); reload(); }) }, 'Model ve bütçeyi kaydet') : null);
};

const otherCard = (o, reload) => {
  const admin = session.user.role === 'admin';
  const psiKey = o.psi ? h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: o.connected ? 'Kayıtlı (değiştirmek için yeni anahtar yazın)' : 'Google API anahtarı (isteğe bağlı)', disabled: !admin }) : null;
  return h('div', { class: 'card card-pad stack' },
    h('div', { class: 'row' }, h('b', { class: 'grow' }, o.name), o.connected ? chip('Bağlı', 'ok') : chip('Bağlantı gerekli', 'warn')),
    h('div', { class: 'small muted' }, o.how),
    psiKey ? h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, psiKey), h('button', { class: 'btn sm', disabled: !admin, onclick: async (e) => { if (!psiKey.value.trim()) return toast('Anahtar yazın', 'err'); e.target.disabled = true; try { await api.put('/x/anahtar/psi', { key: psiKey.value.trim() }); toast('Anahtar kaydedildi', 'ok'); reload(); } catch (er) { toast(er.message, 'err'); e.target.disabled = false; } } }, 'Kaydet'),
      o.connected ? h('button', { class: 'btn danger secondary sm', disabled: !admin, onclick: async () => { await api.del('/x/anahtar/psi'); reload(); } }, 'Sil') : null) : null,
    h('div', { class: 'row wrap' }, o.url ? h('a', { class: 'btn secondary sm', href: o.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 14), o.connected ? 'Yönetim sayfasını aç' : 'Bağlantı sayfasını aç') : null,
      ...(o.links ?? []).map(([label, href]) => h('a', { class: 'small', href, ...(href.startsWith('#') ? {} : { target: '_blank', rel: 'noopener noreferrer' }) }, label + (href.startsWith('#') ? '' : ' ↗')))));
};

export const renderIntegrations = async (ctx) => {
  ctx.setTitle('Entegrasyonlar');
  const root = h('div', { class: 'stack' });
  const load = async () => {
    root.replaceChildren(spinner());
    try {
      const d = await api.get('/x/entegrasyonlar');
      root.replaceChildren(
        infoBox('API anahtarları yalnızca sunucuda AES-256-GCM ile şifreli tutulur, bu ekrana geri gönderilmez, günlüklere yazılmaz. Anahtarları yalnızca yönetici ekleyebilir.'),
        h('h2', {}, 'Yapay zekâ sağlayıcıları'),
        h('div', { class: 'grid cols-2' }, d.providers.map((p) => providerCard(p, load))),
        h('h2', {}, 'Diğer entegrasyonlar'),
        h('p', { class: 'muted' }, 'Aşağıdaki hizmetler için resmî API yetkisi/anahtarı gerekir. Bağlanmayanlar gerçek durumlarıyla "Bağlantı gerekli" görünür; sahte veri üretilmez.'),
        h('div', { class: 'grid cols-2' }, d.other.map((o) => otherCard(o, load))),
        h('h2', {}, 'Modül anahtarları (özellik bayrakları)'),
        h('div', { class: 'card card-pad row wrap' }, d.flags.map((f) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: f.enabled, disabled: session.user.role !== 'admin', onchange: async (e) => { try { await api.put(`/x/bayrak/${f.key}`, { enabled: e.target.checked }); toast('Güncellendi', 'ok'); } catch (er) { toast(er.message, 'err'); e.target.checked = !e.target.checked; } } }), h('i'), h('span', {}, { seo: 'SEO', ai: 'AI Stüdyo', social: 'Social Studio', intel: 'Pazar/Rakip/Backlink' }[f.key])))));
    } catch (e) { root.replaceChildren(errorBanner(e)); }
  };
  load();
  return h('div', {}, pageHead('Entegrasyonlar ve API Bütçesi', 'Sağlayıcı bağlantıları, model seçimi, aylık token bütçesi ve modül anahtarları.'), root);
};
void needConn;
