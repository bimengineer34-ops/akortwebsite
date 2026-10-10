// Arayüz yardımcıları — DOM üretimi (innerHTML'siz: veri her zaman metin düğümü olarak eklenir → XSS güvenli)
export const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required' || k === 'readOnly' || k === 'multiple') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
};

export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};

/** Sabit (güvenilir) SVG dizgilerinden simge üretir */
const SVG = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  blog: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  project: '<path d="M3 20V9l9-5 9 5v11z"/><path d="M9 20v-6h6v6"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.5.6 4 2.6 4 6"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  rocket: '<path d="M5 19c0-3 1-5 3-7m-1 7c3 0 5-1 7-3M14 4c3-1 6-1 6-1s0 3-1 6c-1.5 3-4 5.5-7 7l-4-4c1.5-3 4-5.500 6-8z"/><circle cx="15" cy="9" r="1.4"/>',
  log: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
  shield: '<path d="M12 3 4 6v6c0 4.500 3.200 7.800 8 9 4.800-1.200 8-4.500 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.500-4.500"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5m-5 5 5-5 5 5M5 20h14"/>',
  undo: '<path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>',
  logout: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9"/>',
  alert: '<path d="M12 4 2.500 20h19zM12 10v5M12 17.500v.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  eye: '<path d="M2 12s3.500-6.500 10-6.500S22 12 22 12s-3.500 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>',
  history: '<path d="M4 12a8 8 0 1 0 3-6.200M4 4v5h5M12 8v4l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
};
export const icon = (name, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = SVG[name] ?? ''; // yalnızca yukarıdaki sabit dizgiler
  return s;
};

/* ---------- toast ---------- */
let toastBox;
export const toast = (message, kind = '') => {
  toastBox ??= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = h('div', { class: `toast ${kind}` }, message);
  toastBox.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3500);
};

/* ---------- modal ---------- */
export const modal = ({ title, body, actions = [], wide = false, onClose }) => {
  const prevFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const overlay = h(
    'div',
    { class: 'overlay', onclick: (e) => e.target === overlay && close() },
    h(
      'div',
      { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'btn ghost sm icon', 'aria-label': 'Kapat', onclick: close }, icon('x'))),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-foot' }, actions.map((a) => h('button', { class: `btn ${a.class ?? ''}`, onclick: async () => { const r = await a.onClick?.(close); if (r !== false && a.close !== false) close(); } }, a.label))) : null,
    ),
  );
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('input,textarea,select,button.btn:not(.ghost)')?.focus();
  return { close, overlay };
};

export const confirmBox = ({ title = 'Emin misiniz?', message, confirmLabel = 'Onayla', danger = false }) =>
  new Promise((resolve) => {
    modal({
      title,
      body: h('p', {}, message),
      onClose: () => resolve(false),
      actions: [
        { label: 'Vazgeç', class: 'secondary', onClick: () => resolve(false) },
        { label: confirmLabel, class: danger ? 'danger' : '', onClick: () => resolve(true) },
      ],
    });
  });

export const promptBox = ({ title, label, value = '', placeholder = '', confirmLabel = 'Tamam', type = 'text' }) =>
  new Promise((resolve) => {
    const input = h('input', { class: 'input', type, value, placeholder });
    modal({
      title,
      body: h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input),
      onClose: () => resolve(null),
      actions: [
        { label: 'Vazgeç', class: 'secondary', onClick: () => resolve(null) },
        { label: confirmLabel, onClick: () => resolve(input.value) },
      ],
    });
  });

export const drawer = (content, onClose) => {
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const wrap = h('div', { class: 'drawer-wrap', onclick: (e) => e.target === wrap && close() }, h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true' }, content(close)));
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  return { close };
};

/* ---------- biçimlendirme ---------- */
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
  return isNaN(d) ? String(s) : d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
export const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
export const spinner = (text = 'Yükleniyor…') => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), ' ', text);

export const chip = (text, kind = '') => h('span', { class: `chip ${kind}` }, text);
export const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);

export const errorBanner = (err) => {
  const errors = err?.data?.errors;
  return h('div', { class: 'banner danger', role: 'alert' }, icon('alert'), h('div', {}, h('b', {}, err?.message ?? 'Hata'), errors ? h('ul', {}, errors.map((e) => h('li', {}, e))) : null));
};
