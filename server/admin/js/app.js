// Yönetim paneli — başlatıcı: oturum, düzen, yönlendirme
import { api, session } from './api.js';
import { h, icon, clear, toast, spinner, errorBanner } from './ui.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderDocList, renderDocEditor } from './pages/content.js';
import { renderEntryList, renderEntryEditor } from './pages/entries.js';
import { renderPublish } from './pages/publish.js';
import { renderForms, renderSubscribers } from './pages/forms.js';
import { renderMedia } from './pages/media.js';
import { renderUsers, renderAudit, renderBackups, renderAccount, renderVerification, renderRedirects, renderSettings } from './pages/system.js';

const app = document.getElementById('app');
const state = { badges: { forms: 0, pending: 0, verify: 0 }, siteUrl: '' };
let shell, view, topTitle, publishBtn, navLinks;

/* ---------------- giriş / kurulum ---------------- */
const authScreen = (setup) => {
  clear(app);
  const email = h('input', { class: 'input', type: 'email', required: true, autocomplete: 'username', placeholder: 'ornek@firma.com' });
  const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ad Soyad' });
  const pass = h('input', { class: 'input', type: 'password', required: true, autocomplete: setup ? 'new-password' : 'current-password', minlength: setup ? 10 : undefined });
  const msg = h('div', { role: 'alert' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (setup) await api.setup({ email: email.value, name: name.value, password: pass.value });
      else {
        const r = await api.login(email.value, pass.value);
        if (r.need2fa) return twoFactorScreen(r.ticket);
      }
      await boot();
    } catch (err) {
      msg.replaceChildren(errorBanner(err));
      btn.disabled = false;
      pass.select();
    }
  } },
    setup ? h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Ad Soyad'), name) : null,
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'E-posta'), email),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Parola'), pass, setup ? h('span', { class: 'hint' }, 'En az 10 karakter; en az bir harf ve bir rakam içermeli.') : null),
    msg,
    h('button', { type: 'submit', class: 'btn' }, setup ? 'Yönetici hesabını oluştur' : 'Giriş yap'));
  app.append(h('div', { class: 'auth' }, h('div', { class: 'card' },
    h('img', { class: 'logo', src: '/favicon/favicon-48.png', alt: '' }),
    h('h1', {}, setup ? 'İlk kurulum' : 'AKORT Yönetim Paneli'),
    h('p', { class: 'muted' }, setup ? 'Henüz hiç kullanıcı yok. Sitenin ilk yönetici hesabını oluşturun.' : 'Devam etmek için giriş yapın.'),
    form)));
  (setup ? name : email).focus();
};

/** Parola doğrulandıktan sonra 2 adımlı doğrulama kodu ekranı */
const twoFactorScreen = (ticket) => {
  clear(app);
  const code = h('input', { class: 'input', type: 'text', inputmode: 'text', autocomplete: 'one-time-code', required: true, placeholder: '123456', maxlength: 13 });
  const msg = h('div', { role: 'alert' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api.login2fa(ticket, code.value);
      await boot();
    } catch (err) {
      msg.replaceChildren(errorBanner(err));
      btn.disabled = false;
      if (err.status === 401 && /süresi|geçersiz/i.test(err.message) || err.status === 429) setTimeout(() => authScreen(false), 1800);
      code.select();
    }
  } },
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Doğrulama kodu'), code, h('span', { class: 'hint' }, 'Telefonunuzdaki doğrulama uygulamasındaki 6 haneli kodu girin. Telefona erişemiyorsanız kurtarma kodunuzu (xxxxxx-xxxxxx) yazın.')),
    msg,
    h('button', { type: 'submit', class: 'btn' }, 'Doğrula ve giriş yap'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => authScreen(false) }, 'Vazgeç'));
  app.append(h('div', { class: 'auth' }, h('div', { class: 'card' },
    h('img', { class: 'logo', src: '/favicon/favicon-48.png', alt: '' }),
    h('h1', {}, '2 adımlı doğrulama'),
    h('p', { class: 'muted' }, 'Hesabınız ek bir doğrulama kodu ile korunuyor.'),
    form)));
  code.focus();
};

/* ---------------- düzen ---------------- */
const NAV = [
  { h: null, items: [{ to: '/', label: 'Pano', ic: 'home' }] },
  { h: 'İçerik', items: [
    { to: '/icerik', label: 'Sayfa metinleri', ic: 'doc', match: '/icerik' },
    { to: '/blog', label: 'Blog yazıları', ic: 'blog', match: '/blog' },
    { to: '/projeler', label: 'Projeler', ic: 'project', match: '/projeler' },
    { to: '/yasal', label: 'Yasal metinler', ic: 'scale', match: '/yasal' },
    { to: '/medya', label: 'Medya kütüphanesi', ic: 'image', match: '/medya' },
    { to: '/dogrulama', label: 'Doğrulama bekleyenler', ic: 'shield', badge: 'verify', soft: true },
  ] },
  { h: 'Etkileşim', items: [
    { to: '/formlar', label: 'Form talepleri', ic: 'mail', badge: 'forms', match: '/formlar' },
    { to: '/aboneler', label: 'Bülten aboneleri', ic: 'users', match: '/aboneler' },
  ] },
  { h: 'Yayın', items: [{ to: '/yayin', label: 'Yayınla ve geçmiş', ic: 'rocket', badge: 'pending' }, { to: '/yonlendirmeler', label: 'Yönlendirmeler', ic: 'chevron' }] },
  { h: 'Sistem', admin: true, items: [
    { to: '/kullanicilar', label: 'Kullanıcılar', ic: 'users' },
    { to: '/gunluk', label: 'Etkinlik günlüğü', ic: 'log' },
    { to: '/yedekler', label: 'Yedekler', ic: 'archive' },
    { to: '/ayarlar', label: 'Ayarlar (e-posta)', ic: 'gear' },
  ] },
];

const buildShell = () => {
  clear(app);
  navLinks = [];
  const navEl = h('nav', { class: 'nav', 'aria-label': 'Ana menü' });
  for (const g of NAV) {
    if (g.admin && session.user.role !== 'admin') continue;
    if (g.h) navEl.append(h('h6', {}, g.h));
    for (const it of g.items) {
      const badge = it.badge ? h('span', { class: `badge${it.soft ? ' soft' : ''} hidden`, dataset: { badge: it.badge } }) : null;
      const a = h('a', { href: `#${it.to}`, onclick: () => shell.classList.remove('nav-open') }, icon(it.ic), h('span', {}, it.label), badge);
      a.dataset.to = it.match ?? it.to;
      navLinks.push(a);
      navEl.append(a);
    }
  }
  topTitle = h('div', { class: 'grow' });
  publishBtn = h('a', { class: 'btn', href: '#/yayin' }, icon('rocket', 16), 'Yayınla');
  view = h('main', { class: 'content', id: 'main', tabindex: '-1' });
  shell = h('div', { class: 'shell' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: '/favicon/favicon-48.png', alt: '' }), h('div', {}, h('b', {}, 'AKORT'), h('span', {}, 'Yönetim Paneli'))),
      navEl,
      h('div', { class: 'sidebar-foot' },
        h('div', {}, h('b', { style: undefined }, session.user.name), ' · ', session.user.role === 'admin' ? 'Yönetici' : 'Editör'),
        h('div', { class: 'row', style: undefined }, h('a', { href: '#/hesabim' }, 'Hesabım'), ' · ', h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'Siteyi aç'), ' · ',
          h('a', { href: '#', onclick: async (e) => { e.preventDefault(); await api.logout().catch(() => {}); session.user = null; boot(); } }, 'Çıkış')))),
    h('div', { class: 'main' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn ghost icon menu-btn', 'aria-label': 'Menü', onclick: () => shell.classList.toggle('nav-open') }, icon('menu')),
        topTitle, publishBtn),
      view));
  app.append(shell);
};

export const ctx = {
  get view() { return view; },
  setTitle: (t) => { document.title = `${t} · AKORT Yönetim`; },
  nav: (to) => { location.hash = `#${to}`; },
  refreshBadges: () => refreshBadges(),
  siteUrl: () => state.siteUrl,
  setLeaveGuard: (fn) => { leaveGuard = fn; },
};

const refreshBadges = async () => {
  if (!session.user) return;
  try {
    const d = await api.get('/pano');
    state.badges = { forms: d.forms.fresh, pending: d.drafts.length + (d.entriesDirty ? 1 : 0), verify: d.unverifiedCount };
    for (const b of document.querySelectorAll('[data-badge]')) {
      const n = state.badges[b.dataset.badge];
      b.textContent = String(n);
      b.classList.toggle('hidden', !n);
    }
    publishBtn?.replaceChildren(icon('rocket', 16), state.badges.pending ? `Yayınla (${state.badges.pending})` : 'Yayınla');
    publishBtn?.classList.toggle('secondary', !state.badges.pending);
  } catch {
    /* oturum bitmişse api.js logout olayı tetikler */
  }
};

/* ---------------- yönlendirme ---------------- */
const routes = [
  [/^\/$/, () => renderDashboard(ctx)],
  [/^\/icerik$/, () => renderDocList(ctx)],
  [/^\/icerik\/([\w.-]+)$/, (m) => renderDocEditor(ctx, m[1])],
  [/^\/(blog|projeler|yasal)$/, (m) => renderEntryList(ctx, m[1])],
  [/^\/(blog|projeler|yasal)\/yeni$/, (m) => renderEntryEditor(ctx, m[1], null)],
  [/^\/(blog|projeler|yasal)\/([a-z0-9-]+)$/, (m) => renderEntryEditor(ctx, m[1], m[2])],
  [/^\/yayin$/, () => renderPublish(ctx)],
  [/^\/formlar(?:\/(\d+))?$/, (m) => renderForms(ctx, m[1])],
  [/^\/aboneler$/, () => renderSubscribers(ctx)],
  [/^\/medya$/, () => renderMedia(ctx)],
  [/^\/dogrulama$/, () => renderVerification(ctx)],
  [/^\/kullanicilar$/, () => renderUsers(ctx)],
  [/^\/gunluk$/, () => renderAudit(ctx)],
  [/^\/yedekler$/, () => renderBackups(ctx)],
  [/^\/hesabim$/, () => renderAccount(ctx)],
  [/^\/yonlendirmeler$/, () => renderRedirects(ctx)],
  [/^\/ayarlar$/, () => renderSettings(ctx)],
];

let leaveGuard = null;


const route = async () => {
  if (!session.user) return;
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  leaveGuard = null;
  for (const a of navLinks) {
    const base = a.dataset.to;
    const on = base === '/' ? path === '/' : path === base || path.startsWith(`${base}/`);
    a.toggleAttribute('aria-current', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  view.replaceChildren(spinner());
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    try {
      const el = await fn(m);
      view.replaceChildren(el);
      window.scrollTo(0, 0);
    } catch (err) {
      view.replaceChildren(errorBanner(err));
    }
    return;
  }
  view.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'Sayfa bulunamadı'), h('p', {}, h('a', { href: '#/' }, 'Panoya dön'))));
};

let lastHash = location.hash;
let restoring = false;
window.addEventListener('hashchange', () => {
  if (restoring) {
    restoring = false;
    return;
  }
  if (leaveGuard && !leaveGuard()) {
    restoring = true;
    location.hash = lastHash; // vazgeçildi: eski adrese dön
    return;
  }
  lastHash = location.hash;
  route();
});
window.addEventListener('beforeunload', (e) => {
  if (leaveGuard && !leaveGuard()) e.preventDefault();
});
window.addEventListener('akort:logout', () => {
  toast('Oturum süresi doldu, lütfen yeniden giriş yapın', 'err');
  boot();
});

const boot = async () => {
  try {
    const d = await api.status();
    state.siteUrl = d.siteUrl;
    if (d.setupRequired) return authScreen(true);
    if (!session.user) return authScreen(false);
    buildShell();
    await route();
    refreshBadges();
  } catch (err) {
    clear(app);
    app.append(h('div', { class: 'content' }, errorBanner(err)));
  }
};

setInterval(() => document.visibilityState === 'visible' && refreshBadges(), 45_000);
boot();
