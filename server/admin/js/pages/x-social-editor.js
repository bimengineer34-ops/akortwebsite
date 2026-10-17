// Social Studio gönderi düzenleyici (modal) + durum sabitleri — takvim, onay merkezi ve genel bakış sayfalarında ortak
import { api, session } from '../api.js';
import { h, icon, chip, toast, field, modal, confirmBox, fmtDate } from '../ui.js';
import { infoBox, needConn } from './x-common.js';

export const ST = { taslak: ['Taslak', ''], onay_bekliyor: ['Onay bekliyor', 'warn'], onaylandi: ['Onaylandı', 'info'], planlandi: ['Planlandı', 'ok'], yayimlandi: ['Yayımlandı', 'ok'], hata: ['Hata', 'danger'], revizyon: ['Revizyon', 'warn'] };
export const stChip = (s) => chip(ST[s]?.[0] ?? s, ST[s]?.[1] ?? '');
const NEXT = { taslak: [['onay_bekliyor', 'Onaya gönder']], revizyon: [['onay_bekliyor', 'Onaya gönder']], onay_bekliyor: [['onaylandi', 'Onayla'], ['revizyon', 'Revizyon iste']], onaylandi: [['planlandi', 'Planla'], ['revizyon', 'Revizyon iste']], planlandi: [['revizyon', 'Revizyon iste']], hata: [['planlandi', 'Yeniden planla']], yayimlandi: [] };

let platforms = [];
export const setPlatforms = (p) => { platforms = p; };

export const editor = (post, onDone, preset = {}) => {
  const p = post ?? { title: '', body: '', hashtags: '', media: '', category: '', campaign: '', platforms: [], scheduled_at: '', ...preset };
  const readOnly = p.status === 'yayimlandi';
  const title = h('input', { class: 'input', value: p.title, maxlength: 140, disabled: readOnly });
  const body = h('textarea', { class: 'textarea', rows: 7, disabled: readOnly }); body.value = p.body;
  const tags = h('input', { class: 'input', value: p.hashtags, placeholder: '#Mühendislik #BIM', disabled: readOnly });
  const media = h('input', { class: 'input', value: p.media, placeholder: '/medya/dosya.webp', disabled: readOnly });
  const cat = h('input', { class: 'input', value: p.category, placeholder: 'ör. Eğitim, Teknoloji', disabled: readOnly });
  const camp = h('input', { class: 'input', value: p.campaign, placeholder: 'Kampanya serisi', disabled: readOnly });
  const when = h('input', { class: 'input', type: 'datetime-local', value: p.scheduled_at ? String(p.scheduled_at).replace(' ', 'T').slice(0, 16) : '', disabled: readOnly });
  const checks = platforms.map((pl) => ({ pl, el: h('input', { type: 'checkbox', checked: p.platforms.includes(pl.id), disabled: readOnly }) }));
  const counts = h('div', { class: 'stack' });
  const upd = () => {
    const sel = checks.filter((c) => c.el.checked).map((c) => c.pl);
    const len = body.value.length + (tags.value ? tags.value.length + 1 : 0);
    counts.replaceChildren(...sel.map((pl) => h('div', { class: `counter${len > pl.limit ? ' over' : ''}` }, `${pl.label}: ${len}/${pl.limit}`)));
  };
  for (const el of [body, tags, ...checks.map((c) => c.el)]) el.addEventListener('input', upd);
  upd();
  const payload = () => ({ title: title.value, body: body.value, hashtags: tags.value, media: media.value, category: cat.value, campaign: camp.value, scheduled_at: when.value || null, platforms: checks.filter((c) => c.el.checked).map((c) => c.pl.id), source_ref: p.source_ref });
  const m = modal({
    title: post ? `Gönderi #${post.id}` : 'Yeni gönderi',
    wide: true,
    body: h('div', { class: 'stack' },
      post ? h('div', { class: 'row wrap' }, stChip(p.status), p.sealed ? chip('İçerik mühürlü (onaylı sürümle aynı)', 'ok') : p.approved_by ? chip('Onaylı sürümden sapma var', 'warn') : null, p.approved_by ? h('span', { class: 'small muted' }, `Onaylayan: ${p.approved_by} · ${fmtDate(p.approved_at)}`) : null) : null,
      p.review_note ? infoBox(`Not: ${p.review_note}`, 'warn') : null,
      field('Başlık (iç kullanım)', title), field('Metin', body), counts,
      h('div', { class: 'grid cols-2' }, field('Etiketler', tags), field('Görsel (medya yolu)', media), field('Kategori', cat), field('Kampanya', camp)),
      field('Planlanan zaman (Europe/Istanbul)', when),
      h('div', { class: 'stack' }, h('b', {}, 'Platformlar'), h('div', { class: 'row wrap' }, checks.map(({ pl, el }) => h('label', { class: 'switch' }, el, h('i'), h('span', {}, pl.label))))),
      post && p.platforms.length ? h('div', { class: 'small muted' }, `Yayın kayıtları: ${Object.keys(p.platform_post_ids).length ? Object.entries(p.platform_post_ids).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'yok'}`) : null,
      NEXT[p.status]?.length && post ? h('div', { class: 'row wrap' }, h('b', {}, 'İş akışı:'), NEXT[p.status].filter(([to]) => to !== 'onaylandi' || session.user.role === 'admin').map(([to, label]) => h('button', { class: `btn ${to === 'revizyon' ? 'secondary' : ''} sm`, onclick: async () => {
        const note = to === 'revizyon' ? prompt('Revizyon notu:') ?? '' : '';
        try { await api.put(`/x/sosyal/gonderiler/${post.id}`, payload()); await api.post(`/x/sosyal/gonderiler/${post.id}/gecis`, { to, note }); toast(`${label}: tamam`, 'ok'); m.close(); onDone(); } catch (e) { toast(e.errors ? e.message : e.message, 'err'); if (e.data?.errors) toast(e.data.errors.join(' · '), 'err'); }
      } }, label))) : null,
      post && (p.status === 'planlandi' || p.status === 'onaylandi') ? h('div', { class: 'row wrap' }, h('b', {}, 'Elle yayımladıysanız:'), p.platforms.filter((x) => !p.platform_post_ids[x]).map((x) => h('button', { class: 'btn secondary sm', onclick: async () => {
        if (!(await confirmBox({ title: 'Yayımlandı olarak işaretle?', message: `${x} platformunda bu gönderiyi kendiniz yayımladığınızı onaylıyorsunuz. Bu işlem geri alınamaz.`, confirmLabel: 'İşaretle' }))) return;
        try { await api.post(`/x/sosyal/gonderiler/${post.id}/elle-yayimlandi`, { platform: x, ref: 'elle' }); toast('İşaretlendi', 'ok'); m.close(); onDone(); } catch (e) { toast(e.message, 'err'); }
      } }, `${x} yayımlandı`))) : null,
      post && (p.status === 'planlandi' || p.status === 'onaylandi') ? (() => {
        const slot = h('div', { class: 'row wrap' });
        api.get('/x/sosyal/hesaplar').then(({ accounts }) => {
          const ready = accounts.filter((a) => a.publish && a.connected && !(a.options && !a.selected) && p.platforms.includes(a.id) && !p.platform_post_ids[a.id]);
          if (ready.length) slot.append(h('b', {}, 'Bağlı hesaba paylaş:'), ...ready.map((a) => h('button', { class: 'btn sm', onclick: async (e) => {
            const btn = e.currentTarget;
            if (!(await confirmBox({ title: 'Şimdi paylaşılsın mı?', message: `Onaylı metin ${a.label} hesabında (${a.selected?.label ?? a.account?.label}) herkese açık yayımlanır. Bu işlem geri alınamaz.`, confirmLabel: 'Paylaş' }))) return;
            btn.disabled = true;
            try { await api.post(`/x/sosyal/gonderiler/${post.id}/paylas`, { platform: a.id }); toast(`${a.label}: yayımlandı`, 'ok'); m.close(); onDone(); } catch (er) { toast(er.message, 'err'); btn.disabled = false; }
          } }, icon('share', 14), `${a.label}'a paylaş`)));
        }).catch(() => {});
        return slot;
      })() : null,
      needConn('Otomatik yayın yalnızca Entegrasyonlar sayfasından bağlanmış ve yayın desteği olan hesaplarda (metin gönderiler) açılır; diğerlerinde onaylı içeriği platformda kendiniz yayımlayıp işaretleyin.')),
    actions: readOnly ? [{ label: 'Kapat', class: 'secondary' }] : [
      post ? { label: 'Sil', class: 'danger secondary', onClick: async () => { if (!(await confirmBox({ title: 'Gönderi silinsin mi?', message: 'Kayıt kalıcı olarak silinir.', confirmLabel: 'Sil', danger: true }))) return false; await api.del(`/x/sosyal/gonderiler/${post.id}`); onDone(); } } : { label: 'Vazgeç', class: 'secondary' },
      { label: 'Kaydet', onClick: async () => { try { await api[post ? 'put' : 'post'](post ? `/x/sosyal/gonderiler/${post.id}` : '/x/sosyal/gonderiler', payload()); toast('Kaydedildi', 'ok'); onDone(); } catch (e) { toast(e.message, 'err'); return false; } } },
    ],
  });
};
