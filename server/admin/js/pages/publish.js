// Yayın: bekleyen değişiklikler, canlı derleme günlüğü, geçmiş ve geri alma
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, toast, confirmBox, errorBanner, modal, spinner } from '../ui.js';

const stChip = (s) => (s === 'basarili' ? chip('Başarılı', 'ok') : s === 'running' ? chip('Sürüyor', 'info') : s === 'basarisiz' ? chip('Başarısız', 'danger') : chip(s));

export const renderPublish = async (ctx) => {
  ctx.setTitle('Yayın');
  const [{ docs }, st, { builds }] = await Promise.all([api.get('/icerik'), api.get('/yayin'), api.get('/yayinlar')]);
  const labelOf = Object.fromEntries(docs.map((d) => [d.key, `${d.group} › ${d.label}`]));
  const root = h('div', { class: 'stack' });
  let timer = null;

  const stopPoll = () => timer && (clearInterval(timer), (timer = null));
  ctx.setLeaveGuard(() => (stopPoll(), true));

  const draw = (state, history) => {
    root.replaceChildren();
    const pendingN = state.pending.length + (state.entriesDirty ? 1 : 0);
    const logBox = h('pre', { class: `log${state.log ? '' : ' hidden'}`, id: 'buildlog' }, state.log ?? '');
    const publishBtn = h('button', { class: 'btn', disabled: state.running || !pendingN, onclick: async () => {
      try {
        await api.post('/yayinla');
        toast('Yayın başladı', 'ok');
        refresh(true);
      } catch (e) { toast(e.message, 'err'); }
    } }, icon('rocket', 16), pendingN ? `${pendingN} değişikliği yayınla` : 'Yayınlanacak değişiklik yok');
    const rebuild = h('button', { class: 'btn secondary', disabled: state.running, onclick: async () => {
      if (!(await confirmBox({ title: 'Site yeniden derlensin mi?', message: 'Bekleyen taslak olmasa da site mevcut içerikle baştan derlenir (görsel/kod güncellemelerinden sonra yararlıdır).', confirmLabel: 'Yeniden derle' }))) return;
      try { await api.post('/yeniden-derle'); toast('Derleme başladı', 'ok'); refresh(true); } catch (e) { toast(e.message, 'err'); }
    } }, 'Yeniden derle');

    root.append(
      h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Yayınla'), h('p', {}, 'Kaydedilen taslaklar ve blog/proje değişiklikleri "Yayınla" ile siteye yansır. Derleme başarısız olursa canlı site değişmez.'))),
      state.running
        ? h('div', { class: 'card card-pad stack' }, h('div', { class: 'row' }, h('span', { class: 'spinner' }), h('b', {}, 'Site derleniyor… (genellikle 15–60 sn)')), h('div', { class: 'progress' }, h('i')))
        : state.status === 'basarili' && state.finishedAt && Date.now() - new Date(state.finishedAt.replace(' ', 'T') + 'Z') < 120000
          ? h('div', { class: 'banner ok' }, icon('check'), h('div', {}, h('b', {}, 'Yayın tamamlandı.'), ' Değişiklikler canlıda.'))
          : state.status === 'basarisiz' ? h('div', { class: 'banner danger' }, icon('alert'), h('div', {}, h('b', {}, 'Son yayın başarısız oldu.'), ' Canlı site değişmedi; aşağıdaki günlüğe bakın.')) : null,

      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Bekleyen değişiklikler'), chip(`${pendingN}`)),
        pendingN
          ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {},
              state.pending.map((p) => h('tr', { class: 'clickable', onclick: () => ctx.nav(`/icerik/${p.key}`) }, h('td', {}, h('b', {}, labelOf[p.key] ?? p.key)), h('td', { class: 'muted small' }, `${fmtDate(p.updated_at)} · ${p.updated_by ?? ''}`), h('td', {}, chip('Metin taslağı', 'warn')))),
              state.entriesDirty ? h('tr', {}, h('td', {}, h('b', {}, 'Blog / proje / yasal metin değişiklikleri')), h('td', { class: 'muted small' }, 'Dosyaya kaydedildi'), h('td', {}, chip('Yayın bekliyor', 'warn'))) : null)))
          : h('div', { class: 'empty' }, 'Bekleyen değişiklik yok.'),
        h('div', { class: 'card-pad row wrap' }, publishBtn, rebuild, h('span', { class: 'grow' }),
          session.user.role === 'admin' ? h('button', { class: 'btn danger secondary', disabled: state.running, onclick: async () => {
            if (!(await confirmBox({ title: 'Önceki yayına dönülsün mü?', message: 'Canlı site bir önceki derlemeye geri alınır. Taslaklar ve içerik belgeleri değişmez; yalnızca görünen site eski hâline döner.', confirmLabel: 'Geri al', danger: true }))) return;
            try { await api.post('/yayin-geri-al'); toast('Önceki yayına dönüldü', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
          } }, icon('undo', 16), 'Önceki yayına dön') : null)),

      logBox.textContent ? h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Derleme günlüğü'), logBox) : null,

      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Yayın geçmişi')),
        history.length
          ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Durum', 'Kapsam', 'Kim', 'Başlangıç', ''].map((t) => h('th', {}, t)))), h('tbody', {}, history.map((b) =>
              h('tr', {}, h('td', { class: 'mono' }, `#${b.id}`), h('td', {}, stChip(b.status)), h('td', { class: 'small' }, b.summary ?? ''), h('td', { class: 'small muted' }, b.user_email ?? ''), h('td', { class: 'small muted' }, fmtDate(b.started_at)),
                h('td', {}, h('button', { class: 'btn ghost sm', onclick: async () => {
                  const body = h('div', {}, spinner());
                  modal({ title: `Yayın #${b.id} günlüğü`, wide: true, body });
                  try { const r = await api.get(`/yayinlar/${b.id}`); body.replaceChildren(h('pre', { class: 'log' }, r.log || '(boş)')); } catch (e) { body.replaceChildren(errorBanner(e)); }
                } }, 'Günlük')))))))
          : h('div', { class: 'empty' }, 'Henüz yayın yapılmadı.')));
    const log = root.querySelector('#buildlog');
    if (log) log.scrollTop = log.scrollHeight;
  };

  const refresh = async (poll = false) => {
    try {
      const [state, { builds: hist }] = await Promise.all([api.get('/yayin'), api.get('/yayinlar')]);
      draw(state, hist);
      ctx.refreshBadges();
      if (state.running) {
        if (!timer) timer = setInterval(() => refresh(), 1500);
      } else stopPoll();
    } catch (e) {
      stopPoll();
      root.replaceChildren(errorBanner(e));
    }
  };

  draw(st, builds);
  if (st.running) timer = setInterval(() => refresh(), 1500);
  return root;
};
