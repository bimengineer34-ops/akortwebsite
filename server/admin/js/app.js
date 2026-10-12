// Yönetim paneli — başlatıcı: oturum, düzen, yönlendirme
import { api, session } from './api.js';
import { h, icon, clear, toast, spinner, errorBanner } from './ui.js';
import { renderDashboard } from './pages/dashboard.js';
import { buildTopbar } from './topbar.js';
import { buildNav } from './nav.js';
import { renderDocList, renderDocEditor } from './pages/content.js';
import { renderEntryList, renderEntryEditor } from './pages/entries.js';
import { renderPublish } from './pages/publish.js';
import { renderForms, renderSubscribers } from './pages/forms.js';
import { renderMedia } from './pages/media.js';
import { renderSeo } from './pages/x-seo-overview.js';
import { renderSeoEditor, renderSeoEditorList } from './pages/x-seo-editor.js';
import { renderSpeed } from './pages/x-speed.js';
import { renderAiStudio } from './pages/x-ai-studio.js';
import { renderSocialOverview, renderSocialCalendar, renderSocialApproval, renderSocialArchive, renderBrandKit } from './pages/x-social.js';
import { renderMarket, renderCompetitors, renderBacklinks } from './pages/x-intel.js';
import { renderIntegrations } from './pages/x-integrations.js';
import { renderUsers, renderAudit, renderBackups, renderAccount, renderVerification, renderRedirects, renderSettings, renderStats } from './pages/system.js';

const app = document.getElementById('app');
const state = { badges: { forms: 0, pending: 0, verify: 0 }, siteUrl: '' };
let shell, view, topbar, publishBtn, nav;

/* ---------------- giriş / kurulum ---------------- */
const authScreen = (setup) => {
  clear(app);
  const email = h('input', { class: 'input', type: 'email', id: 'akort-email', name: 'username', required: true, autocomplete: 'username', placeholder: 'ornek@firma.com' });
  const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ad Soyad' });
  const pass = h('input', { class: 'input', type: 'password', id: 'akort-pass', name: 'password', required: true, autocomplete: setup ? 'new-password' : 'current-password', minlength: setup ? 10 : undefined });
  let saved = null;
  try { saved = localStorage.getItem('akort-remember-email'); } catch { /* özel pencere */ }
  const remember = h('input', { type: 'checkbox', id: 'akort-remember', checked: saved !== null });
  const rememberRow = h('label', { class: 'switch' }, remember, h('i'), h('span', {}, 'Beni hatırla (bu cihazda 30 gün açık kal)'));
  const msg = h('div', { role: 'alert' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (setup) await api.setup({ email: email.value, name: name.value, password: pass.value });
      else {
        const r = await api.login(email.value, pass.value, remember.checked);
        try { if (remember.checked) localStorage.setItem('akort-remember-email', email.value); else localStorage.removeItem('akort-remember-email'); } catch { /* özel pencere */ }
        if (r.need2fa) return twoFactorScreen(r.ticket, remember.checked);
      }
      await boot();
    } catch (err) {
      msg.replaceChildren(errorBanner(err));
      btn.disabled = false;
      pass.select();
    }
  } },
    setup ? null : rememberRow,
    setup ? h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Ad Soyad'), name) : null,
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'E-posta'), email),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Parola'), pass, setup ? h('span', { class: 'hint' }, 'En az 10 karakter; en az bir harf ve bir rakam içermeli.') : null),
    msg,
    h('button', { type: 'submit', class: 'btn' }, setup ? 'Yönetici hesabını oluştur' : 'Giriş yap'),
    setup ? null : h('button', { type: 'button', class: 'btn ghost', onclick: () => forgotScreen() }, 'Parolamı unuttum'));
  app.append(h('div', { class: 'auth' }, h('div', { class: 'card' },
    h('img', { class: 'logo', src: '/favicon/favicon-48.png', alt: '' }),
    h('h1', {}, setup ? 'İlk kurulum' : 'AKORT Yönetim Paneli'),
    h('p', { class: 'muted' }, setup ? 'Henüz hiç kullanıcı yok. Sitenin ilk yönetici hesabını oluşturun.' : 'Devam etmek için giriş yapın.'),
    form)));
  if (!setup && (saved || session.loginHint)) email.value = saved || session.loginHint;
  (setup ? name : email.value ? pass : email).focus();
};

/** "Parolamı unuttum": e-posta ile sıfırlama bağlantısı iste */
const forgotScreen = () => {
  clear(app);
  const email = h('input', { class: 'input', type: 'email', required: true, autocomplete: 'username', placeholder: 'ornek@firma.com' });
  const msg = h('div', { role: 'status' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    try {
      await api.forgot(email.value);
      msg.replaceChildren(h('div', { class: 'banner ok' }, icon('check'), h('div', {}, 'Bu e-posta kayıtlıysa ve e-posta gönderimi ayarlıysa, sıfırlama bağlantısı birkaç dakika içinde gelecektir (30 dakika geçerli).')));
    } catch (err) {
      msg.replaceChildren(errorBanner(err));
    }
  } },
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'E-posta'), email),
    msg,
    h('button', { type: 'submit', class: 'btn' }, 'Sıfırlama bağlantısı gönder'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => authScreen(false) }, 'Girişe dön'),
    h('p', { class: 'hint' }, 'E-posta ayarlı değilse sunucu yöneticisi parolayı sunucuda "npm run admin:reset" komutuyla sıfırlayabilir.'));
  app.append(h('div', { class: 'auth' }, h('div', { class: 'card' }, h('img', { class: 'logo', src: '/favicon/favicon-48.png', alt: '' }), h('h1', {}, 'Parolamı unuttum'), h('p', { class: 'muted' }, 'Hesabınızın e-posta adresini girin.'), form)));
  email.focus();
};

/** E-postadaki bağlantıdan gelinen yeni parola ekranı */
const resetScreen = (token) => {
  clear(app);
  const p1 = h('input', { class: 'input', type: 'password', required: true, minlength: 10, autocomplete: 'new-password' });
  const p2 = h('input', { class: 'input', type: 'password', required: true, minlength: 10, autocomplete: 'new-password' });
  const msg = h('div', { role: 'alert' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    if (p1.value !== p2.value) return msg.replaceChildren(errorBanner(new Error('Parolalar eşleşmiyor')));
    try {
      await api.resetPassword(token, p1.value);
      history.replaceState(null, '', '/yonetim/');
      authScreen(false);
      toast('Parolanız güncellendi, giriş yapabilirsiniz', 'ok');
    } catch (err) {
      msg.replaceChildren(errorBanner(err));
    }
  } },
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Yeni parola'), p1, h('span', { class: 'hint' }, 'En az 10 karakter; en az bir harf ve bir rakam.')),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Yeni parola (tekrar)'), p2),
    msg,
    h('button', { type: 'submit', class: 'btn' }, 'Parolayı güncelle'));
  app.append(h('div', { class: 'auth' }, h('div', { class: 'card' }, h('img', { class: 'logo', src: '/favicon/favicon-48.png', alt: '' }), h('h1', {}, 'Yeni parola belirleyin'), form)));
  p1.focus();
};

/** Parola doğrulandıktan sonra 2 adımlı doğrulama kodu ekranı */
const twoFactorScreen = (ticket, remember = false) => {
  clear(app);
  const code = h('input', { class: 'input', type: 'text', inputmode: 'text', autocomplete: 'one-time-code', required: true, placeholder: '123456', maxlength: 13 });
  const msg = h('div', { role: 'alert' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    clear(msg);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api.login2fa(ticket, code.value, remember);
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
const buildShell = () => {
  clear(app);
  nav = buildNav(session.user, () => shell.classList.remove('nav-open'));
  publishBtn = h('a', { class: 'btn publish-pill hidden', href: '#/yayin' }, icon('rocket', 16), 'Yayınla');
  topbar = buildTopbar({ user: session.user, onMenu: () => shell.classList.toggle('nav-open'), publishBtn });
  view = h('main', { class: 'content', id: 'main', tabindex: '-1' });
  shell = h('div', { class: 'shell' },
    h('aside', { class: 'sidebar' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'AKORT Mühendislik — Dashboard' }, h('img', { src: '/yonetim/img/logo-h.png', alt: 'AKORT Mühendislik', width: 190 })),
      nav.el,
      h('a', { class: 'side-promo', href: '/', target: '_blank', rel: 'noopener' }, h('img', { src: '/yonetim/img/logo-mark-dark.png', alt: '' }), h('div', {}, h('span', {}, 'Mühendislikte'), h('b', {}, 'Daha İleriye')), h('span', { class: 'go' }, icon('external', 16))),
      h('div', { class: 'sidebar-foot' },
        h('a', { href: '#/hesabim' }, 'Hesabım'), ' · ', h('a', { href: '#', onclick: async (e) => { e.preventDefault(); await api.logout().catch(() => {}); session.user = null; boot(); } }, 'Çıkış'))),
    h('div', { class: 'main' }, topbar.el, view));
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
    topbar?.setBell(state.badges.forms);
    publishBtn?.replaceChildren(icon('rocket', 16), state.badges.pending ? `Yayınla (${state.badges.pending})` : 'Yayınla');
    publishBtn?.classList.toggle('hidden', !state.badges.pending);
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
  [/^\/istatistik$/, () => renderStats(ctx)],
  [/^\/seo$/, () => renderSeo(ctx)],
  [/^\/hiz$/, () => renderSpeed(ctx)],
  [/^\/seo\/editor$/, () => renderSeoEditorList(ctx)],
  [/^\/seo\/editor\/(blog|projects)\/([a-z0-9-]+)$/, (m) => renderSeoEditor(ctx, m[1], m[2])],
  [/^\/ai$/, () => renderAiStudio(ctx)],
  [/^\/sosyal$/, () => renderSocialOverview(ctx)],
  [/^\/sosyal\/takvim$/, () => renderSocialCalendar(ctx)],
  [/^\/sosyal\/onay$/, () => renderSocialApproval(ctx)],
  [/^\/sosyal\/marka$/, () => renderBrandKit(ctx)],
  [/^\/sosyal\/arsiv$/, () => renderSocialArchive(ctx)],
  [/^\/pazar$/, () => renderMarket(ctx)],
  [/^\/rakipler$/, () => renderCompetitors(ctx)],
  [/^\/backlink$/, () => renderBacklinks(ctx)],
  [/^\/entegrasyonlar$/, () => renderIntegrations(ctx)],
];

let leaveGuard = null;


const route = async () => {
  if (!session.user) return;
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  leaveGuard = null;
  nav.update(path);
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
    const rt = /^#\/parola-sifirla\/([A-Za-z0-9_-]{20,})$/.exec(location.hash);
    if (!session.user && rt) return resetScreen(rt[1]);
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
