// Sistem sayfaları: kullanıcılar, etkinlik günlüğü, yedekler, hesabım, doğrulama bekleyenler
import { api, session } from '../api.js';
import { h, icon, chip, fmtDate, fmtSize, debounce, toast, confirmBox, errorBanner, modal, field, spinner } from '../ui.js';
import { humanize } from '../editor.js';
/** "items[1].text" → "Öğeler 2 › Metin" (teknik alan yolunu okunur Türkçeye çevirir) */
const pathTr = (p) => String(p).split('.').map((seg) => { const m2 = /^([^[]*)((?:\[\d+\])*)$/.exec(seg); if (!m2) return seg; const idx = [...m2[2].matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]) + 1).join('.'); return [m2[1] ? humanize(m2[1]) : '', idx].filter(Boolean).join(' '); }).filter(Boolean).join(' › ');

/* ---------------- kullanıcılar ---------------- */
let ROLE_LIST = [];
export const renderUsers = async (ctx) => {
  ctx.setTitle('Kullanıcılar');
  try { ROLE_LIST = (await api.get('/roller')).roles; } catch { ROLE_LIST = [{ id: 'editor', label: 'Editör', desc: '' }, { id: 'admin', label: 'Yönetici', desc: '' }]; }
  const body = h('div');
  const load = async () => {
    const { users } = await api.get('/kullanicilar');
    body.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ['Kullanıcı', 'Rol', 'Durum', 'Son giriş', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, users.map((u) => h('tr', {},
        h('td', {}, h('b', {}, u.name), u.id === session.user.id ? chip('Siz', 'info') : null, h('div', { class: 'muted small' }, u.email)),
        h('td', {}, u.role === 'admin' ? chip('Yönetici', 'info') : chip((ROLE_LIST.find((r) => r.id === u.role)?.label) ?? u.role), ' ', u.totp_enabled ? chip('2FA açık', 'ok') : chip('2FA yok', 'warn')),
        h('td', {}, u.active ? chip('Aktif', 'ok') : chip('Pasif', 'danger')),
        h('td', { class: 'small muted' }, fmtDate(u.last_login)),
        h('td', {}, h('div', { class: 'row' },
          h('button', { class: 'btn secondary sm', onclick: () => editUser(u) }, 'Düzenle'),
          u.id !== session.user.id ? h('button', { class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: async () => {
            if (!(await confirmBox({ title: 'Kullanıcı silinsin mi?', message: `${u.email} kalıcı olarak silinecek.`, confirmLabel: 'Sil', danger: true }))) return;
            try { await api.del(`/kullanicilar/${u.id}`); toast('Silindi', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
          } }, icon('trash', 15)) : null)))))))));
  };
  const editUser = (u) => {
    const isNew = !u;
    const name = h('input', { class: 'input', value: u?.name ?? '' });
    const email = h('input', { class: 'input', type: 'email', value: u?.email ?? '', disabled: !isNew });
    const role = h('select', { class: 'select' }, ROLE_LIST.map((r) => h('option', { value: r.id, selected: r.id === (u?.role ?? 'editor') }, `${r.label} — ${r.desc}`)));
    const active = h('input', { type: 'checkbox', checked: u ? !!u.active : true });
    const pass = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: isNew ? 'En az 10 karakter, harf + rakam' : 'Değiştirmek için doldurun' });
    const err = h('div');
    modal({
      title: isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle',
      body: h('div', { class: 'stack' }, field('Ad Soyad', name), field('E-posta', email), field('Rol', role),
        u ? h('label', { class: 'switch' }, active, h('i'), h('span', {}, 'Hesap aktif')) : null,
        field(isNew ? 'Parola' : 'Yeni parola (isteğe bağlı)', pass, u ? 'Parola değişirse kullanıcının açık oturumları kapatılır.' : null),
        u?.totp_enabled ? h('div', {}, h('button', { type: 'button', class: 'btn danger secondary sm', onclick: async () => {
          if (!(await confirmBox({ title: '2 adımlı doğrulama sıfırlansın mı?', message: `${u.email} için 2 adımlı doğrulama kapatılır ve açık oturumları sonlandırılır. Kullanıcı telefonunu kaybettiyse kullanın.`, confirmLabel: 'Sıfırla', danger: true }))) return;
          try { await api.patch(`/kullanicilar/${u.id}`, { reset2fa: true }); toast('2 adımlı doğrulama sıfırlandı', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
        } }, '2 adımlı doğrulamayı sıfırla')) : null, err),
      actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', close: false, onClick: async (close) => {
        err.replaceChildren();
        try {
          if (isNew) await api.post('/kullanicilar', { name: name.value, email: email.value, role: role.value, password: pass.value });
          else await api.patch(`/kullanicilar/${u.id}`, { name: name.value, role: role.value, active: active.checked, ...(pass.value ? { password: pass.value } : {}) });
          toast('Kaydedildi', 'ok');
          close();
          load();
        } catch (e) { err.replaceChildren(errorBanner(e)); return false; }
      } }],
    });
  };
  await load();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Kullanıcılar'), h('p', {}, 'Panele erişebilen kişiler. Editörler içerik ve talepleri yönetir; yöneticiler ayrıca kullanıcı, günlük ve yedek işlemlerini yapar.')),
      h('button', { class: 'btn', onclick: () => editUser(null) }, icon('plus', 16), 'Yeni kullanıcı')), body);
};

/* ---------------- günlük ---------------- */
export const renderAudit = async (ctx) => {
  ctx.setTitle('Etkinlik günlüğü');
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Kullanıcı, işlem veya hedef ara…' });
  const body = h('tbody');
  const info = h('span', { class: 'muted small' });
  let offset = 0;
  const more = h('button', { class: 'btn secondary', onclick: () => { offset += 100; load(true); } }, 'Daha fazla');
  const load = async (append = false) => {
    if (!append) { offset = 0; body.replaceChildren(); }
    try {
      const r = await api.get(`/gunluk?ara=${encodeURIComponent(search.value)}&limit=100&offset=${offset}`);
      info.textContent = `${r.total} kayıt`;
      for (const a of r.rows) body.append(h('tr', {}, h('td', { class: 'small muted', style: undefined }, fmtDate(a.ts)), h('td', {}, a.user_email), h('td', {}, h('b', {}, a.action)), h('td', { class: 'small' }, `${a.target ?? ''}${a.detail ? ' — ' + a.detail : ''}`), h('td', { class: 'small muted mono' }, a.ip ?? '')));
      more.classList.toggle('hidden', offset + 100 >= r.total);
      if (!r.total) body.append(h('tr', {}, h('td', { colspan: 5, class: 'empty' }, 'Kayıt yok.')));
    } catch (e) { body.append(h('tr', {}, h('td', { colspan: 5 }, errorBanner(e)))); }
  };
  search.addEventListener('input', debounce(() => load(), 250));
  await load();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Etkinlik günlüğü'), h('p', {}, 'Girişler, içerik değişiklikleri, yayınlar ve yönetim işlemlerinin kaydı.'))),
    h('div', { class: 'card card-pad row wrap' }, h('div', { class: 'grow' }, search), info),
    h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Zaman', 'Kullanıcı', 'İşlem', 'Hedef', 'IP'].map((t) => h('th', {}, t)))), body))),
    h('div', {}, more));
};

/* ---------------- yedekler ---------------- */
export const renderBackups = async (ctx) => {
  ctx.setTitle('Yedekler');
  const body = h('div');
  const load = async () => {
    const { backups } = await api.get('/yedekler');
    body.replaceChildren(h('div', { class: 'card' }, backups.length
      ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, backups.map((b) => h('tr', {}, h('td', {}, h('b', { class: 'mono' }, b.name)), h('td', { class: 'small muted' }, fmtDate(b.at)), h('td', { class: 'small' }, fmtSize(b.size)),
          h('td', {}, h('a', { class: 'btn secondary sm', href: `/api/admin/yedekler/${b.name}` }, icon('download', 15), 'İndir')))))))
      : h('div', { class: 'empty' }, 'Henüz yedek yok.')));
  };
  await load();
  const btn = h('button', { class: 'btn', onclick: async () => {
    btn.disabled = true;
    try { const r = await api.post('/yedekler'); toast(`Yedek oluşturuldu: ${r.name}`, 'ok'); await load(); } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; }
  } }, icon('archive', 16), 'Şimdi yedek al');
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Yedekler'), h('p', {}, 'Veritabanı (kullanıcılar, formlar, taslaklar, medya kayıtları), yayınlanmış içerik ve yüklenen medya tek .zip dosyasında. Son 15 yedek saklanır; düzenli olarak indirip sunucu dışında saklayın.')), btn),
    h('div', { class: 'banner info' }, icon('alert'), h('div', {}, h('b', {}, 'Geri yükleme: '), 'zip içindeki ', h('span', { class: 'mono' }, 'akort.db'), ' dosyasını sunucudaki ', h('span', { class: 'mono' }, 'data/akort.db'), ' ile, ', h('span', { class: 'mono' }, 'media/'), ' ve ', h('span', { class: 'mono' }, 'content/'), ' klasörlerini ', h('span', { class: 'mono' }, 'data/'), ' altına kopyalayıp sunucuyu yeniden başlatın. Ayrıntı: docs/DEPLOY.md')),
    body);
};

/* ---------------- hesabım ---------------- */
/** 2 adımlı doğrulama kartı (kurulum, kurtarma kodları, kapatma) */
const twoFactorCard = async () => {
  const box = h('div', { class: 'card card-pad stack' });
  const draw = async () => {
    const st = await api.get('/2fa');
    box.replaceChildren(h('h3', {}, '2 adımlı doğrulama'));
    if (st.enabled) {
      const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
      const code = h('input', { class: 'input', placeholder: '6 haneli kod', inputmode: 'numeric' });
      const err = h('div');
      box.append(
        h('div', { class: 'banner ok' }, icon('shield'), h('div', {}, h('b', {}, 'Açık.'), ` Giriş sırasında doğrulama uygulamasındaki kod istenir. Kalan kurtarma kodu: ${st.recoveryLeft}.`)),
        h('details', {}, h('summary', {}, 'Kapat'), h('div', { class: 'stack', style: undefined }, field('Parolanız', pw), field('Doğrulama kodu', code), err,
          h('div', {}, h('button', { class: 'btn danger secondary', onclick: async () => {
            err.replaceChildren();
            try { await api.post('/2fa/kapat', { password: pw.value, code: code.value }); toast('2 adımlı doğrulama kapatıldı', 'ok'); draw(); } catch (e) { err.replaceChildren(errorBanner(e)); }
          } }, '2 adımlı doğrulamayı kapat')))));
    } else {
      box.append(
        h('div', { class: 'banner warn' }, icon('alert'), h('div', {}, h('b', {}, 'Kapalı.'), ' Hesabınızı korumak için açmanız önerilir (özellikle yönetici hesapları). Telefonunuzda bir doğrulama uygulaması (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) gerekir.')),
        h('div', {}, h('button', { class: 'btn', onclick: async () => {
          const s = await api.post('/2fa/baslat');
          const code = h('input', { class: 'input', placeholder: '6 haneli kod', inputmode: 'numeric', autocomplete: 'one-time-code' });
          const err = h('div');
          const m = modal({
            title: '2 adımlı doğrulamayı kur',
            body: h('div', { class: 'stack' },
              h('p', {}, '1) Doğrulama uygulamanızda "Hesap ekle → Anahtarı elle gir" seçin ve aşağıdaki anahtarı yazın:'),
              h('input', { class: 'input mono', readOnly: true, value: s.secret, onfocus: (e) => e.target.select() }),
              h('p', { class: 'small muted' }, 'Tür: zaman tabanlı (TOTP) · 6 hane · 30 sn. Telefonunuzda bu bağlantıyı açarak da ekleyebilirsiniz:'),
              h('a', { href: s.uri, class: 'small mono', style: undefined }, 'otpauth bağlantısı'),
              h('p', {}, '2) Uygulamanın gösterdiği güncel kodu girip onaylayın:'), code, err),
            actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Etkinleştir', close: false, onClick: async () => {
              err.replaceChildren();
              try {
                const r = await api.post('/2fa/etkinlestir', { code: code.value });
                m.close();
                modal({
                  title: 'Kurtarma kodlarınız',
                  body: h('div', { class: 'stack' }, h('div', { class: 'banner warn' }, icon('alert'), h('div', {}, h('b', {}, 'Bu kodları şimdi kaydedin.'), ' Bir daha gösterilmezler. Telefonunuzu kaybederseniz her biri bir kez giriş yapmanızı sağlar.')),
                    h('pre', { class: 'log' }, r.recoveryCodes.join('\n'))),
                  actions: [{ label: 'Kaydettim', onClick: () => draw() }],
                });
              } catch (e) { err.replaceChildren(errorBanner(e)); return false; }
            } }],
          });
        } }, icon('shield', 16), '2 adımlı doğrulamayı kur')));
    }
  };
  await draw();
  return box;
};

export const renderAccount = async (ctx) => {
  ctx.setTitle('Hesabım');
  const tfCard = await twoFactorCard();
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const next2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const err = h('div');
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Hesabım'), h('p', {}, `${session.user.name} · ${session.user.email} · ${session.user.role === 'admin' ? 'Yönetici' : 'Editör'}`))),
    h('div', { class: 'card card-pad stack', style: undefined },
      h('h3', {}, 'Parolayı değiştir'),
      field('Mevcut parola', cur), field('Yeni parola', next, 'En az 10 karakter; en az bir harf ve bir rakam.'), field('Yeni parola (tekrar)', next2), err,
      h('div', {}, h('button', { class: 'btn', onclick: async () => {
        err.replaceChildren();
        if (next.value !== next2.value) return err.replaceChildren(errorBanner(new Error('Yeni parolalar eşleşmiyor')));
        try { await api.post('/parola', { current: cur.value, next: next.value }); toast('Parola değiştirildi; diğer oturumlar kapatıldı', 'ok'); cur.value = next.value = next2.value = ''; } catch (e) { err.replaceChildren(errorBanner(e)); }
      } }, 'Parolayı güncelle'))),
    tfCard);
};

/* ---------------- doğrulama bekleyenler ---------------- */
export const renderVerification = async (ctx) => {
  ctx.setTitle('Doğrulama bekleyenler');
  const { rows } = await api.get('/dogrulama');
  const byDoc = new Map();
  for (const r of rows) {
    if (!byDoc.has(r.key)) byDoc.set(r.key, { label: r.label, items: [] });
    byDoc.get(r.key).items.push(r);
  }
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Doğrulama bekleyenler'), h('p', {}, 'Referans tasarımlardan alınan veya henüz doğrulanmamış rakam, tarih ve iddialar. İlgili belgede "Doğrulandı" kutusunu işaretleyip yayınlayana kadar canlı sitede GÖSTERİLMEZ.'))),
    rows.length
      ? h('div', { class: 'stack' }, [...byDoc.entries()].map(([key, g]) => h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, g.label), chip(`${g.items.length} alan`, 'warn'), h('a', { class: 'btn secondary sm', href: `#/icerik/${key}` }, 'Belgeyi aç')),
          h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, g.items.map((i) => h('tr', {}, h('td', { class: 'small muted' }, pathTr(i.path)), h('td', {}, i.value))))))))
        )
      : h('div', { class: 'card empty' }, h('b', {}, 'Doğrulama bekleyen alan yok.')),
    h('div', { class: 'hint' }, 'Not: Projeler için doğrulama durumu proje editöründe yönetilir.'));
};

/* ---------------- yönlendirmeler ---------------- */
export const renderRedirects = async (ctx) => {
  ctx.setTitle('Yönlendirmeler');
  const body = h('div');
  const edit = (r) => {
    const from = h('input', { class: 'input mono', value: r?.from_path ?? '', placeholder: '/eski-adres' });
    const to = h('input', { class: 'input mono', value: r?.to_path ?? '', placeholder: '/yeni-adres veya https://…' });
    const code = h('select', { class: 'select' }, [[301, '301 — Kalıcı taşındı (SEO için önerilen)'], [302, '302 — Geçici']].map(([v, l]) => h('option', { value: v, selected: v === (r?.code ?? 301) }, l)));
    const note = h('input', { class: 'input', value: r?.note ?? '', placeholder: 'İsteğe bağlı not' });
    const err = h('div');
    modal({
      title: r ? 'Yönlendirmeyi düzenle' : 'Yeni yönlendirme',
      body: h('div', { class: 'stack' }, field('Kaynak adres (eski)', from, 'Sitenin kök adresinden itibaren, ör. /hizmetler/eski-sayfa'), field('Hedef adres (yeni)', to), field('Tür', code), field('Not', note), err),
      actions: [{ label: 'Vazgeç', class: 'secondary' }, { label: 'Kaydet', close: false, onClick: async (close) => {
        err.replaceChildren();
        try {
          const payload = { from: from.value, to: to.value, code: Number(code.value), note: note.value };
          if (r) await api.put(`/yonlendirmeler/${r.id}`, payload);
          else await api.post('/yonlendirmeler', payload);
          toast('Kaydedildi', 'ok');
          close();
          load();
        } catch (e) { err.replaceChildren(errorBanner(e)); return false; }
      } }],
    });
  };
  const load = async () => {
    const { rows } = await api.get('/yonlendirmeler');
    body.replaceChildren(h('div', { class: 'card' }, rows.length
      ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Kaynak', 'Hedef', 'Tür', 'İsabet', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map((r) => h('tr', {},
            h('td', { class: 'mono' }, r.from_path), h('td', { class: 'mono' }, r.to_path, r.note ? h('div', { class: 'muted small' }, r.note) : null),
            h('td', {}, chip(String(r.code), r.code === 301 ? 'ok' : 'warn')), h('td', { class: 'small muted' }, String(r.hits)),
            h('td', {}, h('div', { class: 'row' },
              h('button', { class: 'btn secondary sm', onclick: () => edit(r) }, 'Düzenle'),
              h('button', { class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox({ title: 'Yönlendirme silinsin mi?', message: r.from_path, confirmLabel: 'Sil', danger: true })) { await api.del(`/yonlendirmeler/${r.id}`); load(); } } }, icon('trash', 15)))))))))
      : h('div', { class: 'empty' }, 'Henüz yönlendirme yok.')));
  };
  await load();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Yönlendirmeler'), h('p', {}, 'Adresi değişen veya kaldırılan sayfalar için eski adresi yeni sayfaya yönlendirin; arama motoru sıralaması ve ziyaretçi kaybı korunur. Yönlendirmeler yayın gerektirmeden anında çalışır.')),
      h('button', { class: 'btn', onclick: () => edit(null) }, icon('plus', 16), 'Yeni yönlendirme')), body);
};

/* ---------------- ziyaret istatistikleri ---------------- */
export const renderStats = async (ctx) => {
  ctx.setTitle('İstatistikler');
  let days = 30;
  const box = h('div', { class: 'stack' });
  const draw = async () => {
    const s = await api.get(`/istatistik?gun=${days}`);
    const max = Math.max(1, ...s.daily.map((d) => d.views));
    const chart = h('div', { class: 'chart', role: 'img', 'aria-label': `Son ${days} gün günlük sayfa görüntüleme` },
      s.daily.map((d) => {
        const bar = h('div', { class: 'bar', title: `${d.day}: ${d.views}` });
        bar.style.height = `${Math.max(2, Math.round((d.views / max) * 100))}%`;
        return bar;
      }));
    const table = (rows, a, b) => h('table', { class: 'tbl' }, h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, h('td', { class: 'mono small' }, r[a]), h('td', { class: 'small', style: undefined }, String(r.views)))) : h('tr', {}, h('td', { class: 'empty' }, 'Henüz veri yok'))));
    box.replaceChildren(
      h('div', { class: 'grid cols-3' },
        h('div', { class: 'card stat' }, h('b', {}, String(s.total)), h('span', {}, `Son ${days} gün sayfa görüntüleme`)),
        h('div', { class: 'card stat' }, h('b', {}, String(Math.round(s.total / days))), h('span', {}, 'Günlük ortalama')),
        h('div', { class: 'card stat' }, h('b', {}, String(Math.max(...s.daily.map((d) => d.views)))), h('span', {}, 'En yoğun gün'))),
      h('div', { class: 'card card-pad stack' }, h('h3', {}, 'Günlük görüntüleme'), chart),
      h('div', { class: 'grid cols-2' },
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'En çok görüntülenen sayfalar')), table(s.topPages, 'path')),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Nereden geldiler (dış siteler)')), table(s.referrers, 'host'))),
      h('div', { class: 'hint' }, 'Bu sayaç çerez kullanmaz ve IP, tarayıcı bilgisi veya kimlik tutmaz; yalnızca gün ve sayfa başına toplam sayıyı tutar. Botlar, "Do Not Track" gönderenler ve panele giriş yapmış kullanıcılar sayılmaz. Arama motoru görünürlüğü için Google Arama Konsolu önerilir.'));
  };
  const sel = h('select', { class: 'select', onchange: (e) => { days = Number(e.target.value); draw(); } }, [[7, 'Son 7 gün'], [30, 'Son 30 gün'], [90, 'Son 90 gün'], [365, 'Son 1 yıl']].map(([v, l]) => h('option', { value: v, selected: v === days }, l)));
  await draw();
  return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Ziyaret istatistikleri'), h('p', {}, 'Çerezsiz ve kişisel veri tutmayan basit ziyaret sayacı.')), h('div', {}, sel)), box);
};

/* ---------------- ayarlar (e-posta bildirimi) ---------------- */
export const renderSettings = async (ctx) => {
  ctx.setTitle('Ayarlar');
  const { smtp, recipients } = await api.get('/ayarlar');
  const list = h('textarea', { class: 'textarea', rows: 3, placeholder: 'ornek@firma.com, diger@firma.com' });
  list.value = recipients.join(', ');
  const err = h('div');
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Ayarlar'), h('p', {}, 'Yeni form talebi geldiğinde e-posta bildirimi gönderilecek adresler ve gönderim (SMTP) durumu.'))),
    smtp.configured
      ? h('div', { class: 'banner ok' }, icon('check'), h('div', {}, h('b', {}, 'SMTP ayarlı.'), ` ${smtp.host}:${smtp.port} (${smtp.secure ? 'SSL/TLS' : 'STARTTLS'}) · Gönderen: ${smtp.from}`))
      : h('div', { class: 'banner warn' }, icon('alert'), h('div', {}, h('b', {}, 'SMTP henüz ayarlanmadı; e-posta bildirimi gönderilmez.'), h('div', { class: 'small' }, 'Sunucudaki .env dosyasına SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ve SMTP_FROM değişkenlerini ekleyip sunucuyu yeniden başlatın (parola panele veya veritabanına yazılmaz). Ayrıntı: docs/DEPLOY.md'))),
    h('div', { class: 'card card-pad stack' },
      h('h3', {}, 'Bildirim alıcıları'),
      field('E-posta adresleri', list, 'Virgülle ayırın (en fazla 10). Boşsa bildirim gönderilmez; talepler yine panelde görünür.'),
      err,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: async () => {
          err.replaceChildren();
          try { await api.put('/ayarlar', { recipients: list.value }); toast('Kaydedildi', 'ok'); } catch (e) { err.replaceChildren(errorBanner(e)); }
        } }, 'Kaydet'),
        h('button', { class: 'btn secondary', disabled: !smtp.configured, onclick: async () => {
          err.replaceChildren();
          try { const r = await api.post('/ayarlar/test'); toast(`Test e-postası gönderildi: ${r.to.join(', ')}`, 'ok'); } catch (e) { err.replaceChildren(errorBanner(e)); }
        } }, icon('mail', 16), 'Test e-postası gönder'))));
};

void spinner;
