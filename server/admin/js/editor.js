// Şema güdümlü içerik editörü: varsayılan JSON'un yapısından form üretir (metin, liste, tekrarlayan kart, doğrulama bayrağı, simge, medya)
import { h, icon } from './ui.js';

const LABELS = {
  title: 'Başlık', subtitle: 'Alt başlık', text: 'Metin', body: 'Gövde metni', eyebrow: 'Üst başlık (eyebrow)', lead: 'Giriş metni', label: 'Etiket', href: 'Bağlantı',
  cta: 'Buton', button: 'Buton', description: 'Açıklama', summary: 'Özet', intro: 'Giriş', scope: 'Kapsam maddeleri', deliverables: 'Tipik çıktılar', when: 'Ne zaman gerekir?',
  standards: 'İlgili standartlar', faq: 'Sık sorulan sorular', q: 'Soru', a: 'Yanıt', question: 'Soru', answer: 'Yanıt', related: 'İlgili hizmetler (adres/slug)', slug: 'Adres (slug)',
  icon: 'Simge', items: 'Öğeler', cards: 'Kartlar', steps: 'Adımlar', pillars: 'Sütunlar', slogan: 'Slogan satırları', sloganAccent: 'Vurgulu slogan satırı', annotations: 'Teknik notlar (satırlar)',
  name: 'Ad', number: 'Numara', highlight: 'Vurgulu kelime', list: 'Liste', kind: 'Tür', pillar: 'Ana grup', parent: 'Üst hizmet (slug)', group: 'Grup', ratio: 'Oran', image: 'Görsel',
  imageAlt: 'Görsel alt metni', alt: 'Alt metin', placeholder: 'Örnek metin', submit: 'Gönder düğmesi', consent: 'Onay metni', consentLink: 'Onay bağlantısı', endpoint: 'Gönderim adresi (uç nokta)',
  messages: 'Mesajlar', pending: 'Hazırlanıyor', success: 'Başarılı', error: 'Hata', invalid: 'Geçersiz alan', value: 'Değer', verified: 'Doğrulandı', note: 'Not', email: 'E-posta', phone: 'Telefon',
  address: 'Adres', action: 'Eylem', enabled: 'Etkin', features: 'Özellikler', checklist: 'Kontrol listesi', calloutsLeft: 'Sol açıklamalar', calloutsRight: 'Sağ açıklamalar', headingId: 'Başlık kimliği',
  activities: 'Neler yapılır', outputs: 'Çıktılar', inputs: 'Sizden beklenenler', services: 'İlgili hizmetler (slug)', challenges: 'Öne çıkan konular', sector: 'Sektör', key: 'Anahtar', url: 'Adres',
  title2: 'İkinci başlık', primary: 'Ana kartlar', secondary: 'Diğer kartlar', onHome: 'Ana sayfada göster', lines: 'Satırlar', year: 'Yıl', hours: 'Çalışma saatleri', city: 'Şehir', map: 'Harita',
  titleLines: 'Başlık satırları', titleAccent: 'Vurgulu başlık', video: 'Video', secondaryCta: 'İkinci buton', badge: 'Rozet', ctaLabel: 'Buton metni', caption: 'Alt yazı', links: 'Bağlantılar', columns: 'Sütunlar', description2: 'Açıklama', metrics: 'Göstergeler', disciplines: 'Disiplinler', phases: 'Aşamalar', options: 'Seçenekler', groups: 'Gruplar', tagline: 'Slogan', lang: 'Dil', defaultDescription: 'Varsayılan açıklama',
};
export const humanize = (k) => LABELS[k] ?? k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const merge = (base, over) => {
  if (over === undefined) return clone(base);
  if (isObj(base) && isObj(over)) {
    const out = { ...clone(base) };
    for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
    return out;
  }
  return clone(over);
};
const isVerifiable = (v) => isObj(v) && 'value' in v && typeof v.verified === 'boolean';
const blank = (v) => {
  if (isVerifiable(v)) return { value: typeof v.value === 'number' ? 0 : '', verified: false };
  if (Array.isArray(v)) return [];
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)]));
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  return '';
};
const unionKeys = (items) => {
  const keys = [];
  for (const it of items) if (isObj(it)) for (const k of Object.keys(it)) if (!keys.includes(k)) keys.push(k);
  return keys;
};
const TITLE_KEYS = ['title', 'label', 'name', 'q', 'question', 'slug', 'year', 'text', 'number', 'id', 'value', 'key'];
const itemTitle = (it, i) => {
  if (isObj(it)) {
    for (const k of TITLE_KEYS) {
      const v = isVerifiable(it[k]) ? it[k].value : it[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  } else if (typeof it === 'string' && it) return it;
  return `Öğe ${i + 1}`;
};
const MEDIA_KEY = /^(image|img|src|cover|poster|video|pdf|logo|thumbnail|photo|(hero|intro|cta|telKafes|hizmet|sektor)[A-Z]\w*)$/;

export const createEditor = ({ value, defaults, icons = [], pickMedia, onChange }) => {
  const state = merge(defaults, value);
  const root = h('div', { class: 'stack' });
  const touch = () => onChange?.();

  /* ---------------- ilkel alanlar ---------------- */
  const autosize = (ta) => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, 520)}px`;
  };

  const stringControl = (parent, key, label) => {
    const v = parent[key] ?? '';
    const long = String(v).length > 70 || String(v).includes('\n') || /^(text|body|lead|description|summary|intro|answer|a|consent|note|subtitle|excerpt|challenge)$/i.test(key);
    const set = (val) => {
      parent[key] = val;
      touch();
    };
    if (MEDIA_KEY.test(key) && pickMedia) {
      const input = h('input', { class: 'input', value: v, placeholder: '/medya/dosya.webp', oninput: (e) => set(e.target.value) });
      const btn = h('button', { type: 'button', class: 'btn secondary', onclick: async () => {
        const m = await pickMedia();
        if (m) {
          input.value = m.url;
          set(m.url);
        }
      } }, icon('image', 16), 'Medya seç');
      return h('div', { class: 'row' }, input, btn);
    }
    if ((key === 'icon' || /Icon$/.test(key)) && icons.length) {
      const sel = h('select', { class: 'select', onchange: (e) => { set(e.target.value); prev.src = `/api/admin/simge/${e.target.value}`; } },
        !icons.includes(v) ? h('option', { value: v, selected: true }, v || '(seçiniz)') : null,
        icons.map((n) => h('option', { value: n, selected: n === v }, n)));
      const prev = h('img', { alt: '', src: v ? `/api/admin/simge/${v}` : '' });
      return h('div', { class: 'icon-pick' }, prev, h('div', { class: 'grow' }, sel));
    }
    if (long) {
      const ta = h('textarea', { class: 'textarea', rows: 2, oninput: (e) => { set(e.target.value); autosize(e.target); } });
      ta.value = v;
      queueMicrotask(() => autosize(ta));
      requestAnimationFrame(() => autosize(ta));
      return ta;
    }
    return h('input', { class: 'input', value: v, type: key === 'email' ? 'email' : 'text', oninput: (e) => set(e.target.value) });
  };

  const switchControl = (parent, key, text) => {
    const input = h('input', { type: 'checkbox', checked: !!parent[key], onchange: (e) => { parent[key] = e.target.checked; touch(); } });
    return h('label', { class: 'switch' }, input, h('i'), h('span', {}, text));
  };

  const numberControl = (parent, key) => h('input', { class: 'input', type: 'number', value: parent[key], oninput: (e) => { parent[key] = e.target.value === '' ? 0 : Number(e.target.value); touch(); } });

  const verifiableControl = (parent, key, label) => {
    const v = parent[key];
    const wrap = h('div', { class: 'vrow' });
    const flag = h('label', { class: `vflag${v.verified ? '' : ' unv'}`, title: 'Doğrulanmayan değerler yayında gösterilmez (sahte veri yasağı)' });
    const cb = h('input', { type: 'checkbox', checked: v.verified, onchange: (e) => { v.verified = e.target.checked; flag.classList.toggle('unv', !v.verified); text.textContent = v.verified ? 'Doğrulandı' : 'Doğrulanmadı'; touch(); } });
    const text = h('span', {}, v.verified ? 'Doğrulandı' : 'Doğrulanmadı');
    flag.append(cb, text);
    const input = typeof v.value === 'number'
      ? h('input', { class: 'input', type: 'number', value: v.value, oninput: (e) => { v.value = Number(e.target.value); touch(); } })
      : h('input', { class: 'input', value: v.value, oninput: (e) => { v.value = e.target.value; touch(); } });
    const note = h('input', { class: 'input note', placeholder: 'Doğrulama notu / kaynak (isteğe bağlı)', value: v.note ?? '', oninput: (e) => { v.note = e.target.value; if (!v.note) delete v.note; touch(); } });
    wrap.append(input, flag, note);
    return wrap;
  };

  /* ---------------- listeler ---------------- */
  const stringList = (arr, onChangeList) => {
    const box = h('div', { class: 'stack', style: undefined });
    const draw = () => {
      box.replaceChildren();
      arr.forEach((s, i) => {
        const long = String(s).length > 70 || String(s).includes('\n');
        const ctl = long
          ? h('textarea', { class: 'textarea', rows: 2, oninput: (e) => { arr[i] = e.target.value; autosize(e.target); onChangeList(); } })
          : h('input', { class: 'input', value: s, oninput: (e) => { arr[i] = e.target.value; onChangeList(); } });
        if (long) {
          ctl.value = s;
          requestAnimationFrame(() => autosize(ctl));
        }
        box.append(h('div', { class: 'list-row' }, ctl, h('div', { class: 'list-actions' },
          h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Yukarı', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onChangeList(); draw(); } }, icon('up', 15)),
          h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Aşağı', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; onChangeList(); draw(); } }, icon('down', 15)),
          h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: () => { arr.splice(i, 1); onChangeList(); draw(); } }, icon('trash', 15)))));
      });
      box.append(h('div', {}, h('button', { type: 'button', class: 'btn secondary sm', onclick: () => { arr.push(''); onChangeList(); draw(); box.querySelectorAll('.input,.textarea').item(arr.length - 1)?.focus(); } }, icon('plus', 15), 'Ekle')));
    };
    draw();
    return box;
  };

  const objectRepeater = (arr, def, label) => {
    const box = h('div', { class: 'stack' });
    const defItems = Array.isArray(def) ? def : [];
    const template = () => blank(defItems[0] ?? arr[arr.length - 1] ?? arr[0] ?? {});
    const search = h('input', { class: 'input', type: 'search', placeholder: `${label} içinde ara…`, oninput: (e) => {
      const q = e.target.value.trim().toLocaleLowerCase('tr');
      list.querySelectorAll(':scope > .fset').forEach((el, i) => el.classList.toggle('hidden', !!q && !JSON.stringify(arr[i]).toLocaleLowerCase('tr').includes(q)));
    } });
    const list = h('div', { class: 'stack' });
    const open = new Set(arr.length <= 3 ? arr.map((_, i) => i) : []);
    const draw = () => {
      list.replaceChildren();
      const keys = unionKeys([...arr, ...defItems]);
      arr.forEach((item, i) => {
        if (!isObj(item)) return;
        const collapsed = !open.has(i);
        const fs = h('div', { class: `fset nested${collapsed ? ' collapsed' : ''}` });
        const ttl = h('span', { class: 'ttl' }, itemTitle(item, i));
        const toggle = h('button', { type: 'button', class: 'toggle', 'aria-label': 'Aç/kapat', 'aria-expanded': String(!collapsed), onclick: () => { const c = fs.classList.toggle('collapsed'); toggle.setAttribute('aria-expanded', String(!c)); c ? open.delete(i) : open.add(i); } }, icon('chevron', 16));
        const head = h('div', { class: 'fset-head' }, toggle, h('span', { class: 'idx' }, `#${i + 1}`), ttl,
          h('div', { class: 'list-actions' },
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Yukarı', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; touch(); draw(); } }, icon('up', 15)),
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Aşağı', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; touch(); draw(); } }, icon('down', 15)),
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Çoğalt', onclick: () => { arr.splice(i + 1, 0, clone(item)); open.add(i + 1); touch(); draw(); } }, icon('copy', 15)),
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: () => { if (confirm('Bu öğe silinsin mi?')) { arr.splice(i, 1); open.clear(); touch(); draw(); } } }, icon('trash', 15))));
        head.addEventListener('dblclick', () => toggle.click());
        const body = h('div', { class: 'fset-body' });
        for (const k of keys) {
          const dv = defItems.find((d) => isObj(d) && k in d)?.[k] ?? arr.find((d) => isObj(d) && k in d)?.[k];
          if (!(k in item)) item[k] = blank(dv);
          body.append(renderField(item, k, dv, () => { ttl.textContent = itemTitle(item, i); }));
        }
        fs.append(head, body);
        list.append(fs);
      });
    };
    draw();
    box.append(arr.length > 6 ? search : null, list, h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn secondary sm', onclick: () => { arr.push(template()); open.add(arr.length - 1); touch(); draw(); list.lastElementChild?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, icon('plus', 15), `${label} ekle`),
      h('span', { class: 'hint' }, `${arr.length} öğe`)));
    return box;
  };

  const nestedLists = (arr, def, label) => {
    // [[satır, satır], [satır]] biçimi
    const box = h('div', { class: 'stack' });
    const draw = () => {
      box.replaceChildren();
      arr.forEach((lines, i) => {
        box.append(h('div', { class: 'fset nested' },
          h('div', { class: 'fset-head' }, h('span', { class: 'idx' }, `#${i + 1}`), h('span', { class: 'ttl' }, (lines ?? []).join(' ')),
            h('button', { type: 'button', class: 'btn ghost sm icon', 'aria-label': 'Sil', onclick: () => { arr.splice(i, 1); touch(); draw(); } }, icon('trash', 15))),
          h('div', { class: 'fset-body' }, stringList(lines, touch))));
      });
      box.append(h('div', {}, h('button', { type: 'button', class: 'btn secondary sm', onclick: () => { arr.push(['']); touch(); draw(); } }, icon('plus', 15), `${label} ekle`)));
    };
    draw();
    return box;
  };

  /* ---------------- alan çözümleyici ---------------- */
  function renderField(parent, key, def, onTitleChange) {
    const label = humanize(key);
    const val = parent[key];
    const wrapChange = onTitleChange ? () => onTitleChange() : null;
    const inner = (el) => {
      if (wrapChange) el.addEventListener('input', wrapChange);
      return el;
    };
    if (typeof val === 'boolean') return h('div', {}, switchControl(parent, key, label));
    if (typeof val === 'number') return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), numberControl(parent, key));
    if (isVerifiable(val)) return h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), verifiableControl(parent, key, label));
    if (Array.isArray(val)) {
      const kindArr = val.find((x) => x !== undefined) ?? (Array.isArray(def) ? def[0] : undefined);
      let content;
      if (kindArr === undefined || typeof kindArr === 'string') content = stringList(val, touch);
      else if (Array.isArray(kindArr)) content = nestedLists(val, def, label);
      else content = objectRepeater(val, def, label);
      return h('div', { class: 'field' }, h('span', { class: 'lbl' }, `${label} `, h('span', { class: 'hint' }, `(${val.length})`)), content);
    }
    if (isObj(val)) {
      const fs = h('div', { class: 'fset' });
      fs.append(h('div', { class: 'fset-head' }, h('span', { class: 'ttl' }, label)));
      const body = h('div', { class: 'fset-body' });
      const keys = unionKeys([val, isObj(def) ? def : {}]);
      for (const k of keys) {
        if (!(k in val)) val[k] = blank(def?.[k]);
        body.append(renderField(val, k, def?.[k]));
      }
      fs.append(body);
      return fs;
    }
    // metin (veya null → isteğe bağlı metin)
    if (val === null || val === undefined) {
      const ctl = h('input', { class: 'input', value: '', placeholder: 'Boş', oninput: (e) => { parent[key] = e.target.value === '' ? null : e.target.value; touch(); } });
      return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), ctl);
    }
    const ctl = stringControl(parent, key, label);
    inner(ctl.matches?.('input,textarea') ? ctl : ctl.querySelector('input,textarea,select') ?? ctl);
    return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label, key === 'href' || key === 'url' ? h('span', { class: 'hint' }, '  (/sayfa, #bölüm, https://… veya mailto:/tel:)') : null), ctl);
  }

  /* ---------------- kök ---------------- */
  const draw = () => {
    root.replaceChildren();
    if (isObj(state)) {
      for (const k of unionKeys([state, isObj(defaults) ? defaults : {}])) {
        if (!(k in state)) state[k] = blank(defaults?.[k]);
        root.append(renderField(state, k, defaults?.[k]));
      }
    } else {
      // kök dizi (ör. menü, SSS listesi, hizmet kayıtları)
      const holder = { items: state };
      root.append(renderField(holder, 'items', defaults));
    }
  };
  draw();

  /** Boş isteğe bağlı alanları temizleyerek serileştirir. */
  const serialize = (val, def) => {
    if (Array.isArray(val)) {
      const defItems = Array.isArray(def) ? def.filter(isObj) : [];
      const objs = val.filter(isObj);
      const basis = defItems.length ? defItems : objs;
      const req = basis.length ? Object.keys(basis[0]).filter((k) => basis.every((o) => k in o)) : [];
      return val.map((item) => {
        if (!isObj(item)) return item;
        const out = {};
        for (const [k, v] of Object.entries(item)) {
          const empty = v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
          if (empty && !req.includes(k)) continue;
          out[k] = serialize(v, defItems.find((d) => k in d)?.[k]);
        }
        return out;
      });
    }
    if (isObj(val) && !isVerifiable(val)) return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, serialize(v, def?.[k])]));
    return val;
  };

  return {
    el: root,
    getValue: () => serialize(clone(state), defaults),
    replace: (next) => {
      const merged = merge(defaults, next);
      if (isObj(state)) {
        for (const k of Object.keys(state)) delete state[k];
        Object.assign(state, merged);
      } else {
        state.splice(0, state.length, ...merged);
      }
      draw();
    },
  };
};

export const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
