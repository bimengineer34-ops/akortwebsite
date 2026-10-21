// Zengin metin (WYSIWYG) editörü: görsel düzenleme + Markdown depolama. Harici kütüphane yok, innerHTML ataması yok.
// - İçerik Markdown olarak saklanır (site derlemesi değişmez); düzenlenmeyen içerik bayt bayt aynı döner.
// - Tablo / ham HTML gibi desteklenmeyen bloklar "ham blok" olarak korunur (kayıpsız), Kaynak görünümünde düzenlenir.
// - textarea benzeri yüzey sunar: value, addEventListener('input'), dispatchEvent, focus, selectedText.
import { h } from './ui.js';

const UNSAFE = /^\s*(javascript|vbscript|data):/i;
const safeUrl = (u) => (UNSAFE.test(u) ? '#' : u);
const SKIP = new Set(['SCRIPT', 'STYLE', 'META', 'TITLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'XML', 'LINK']);

/* ================= Markdown → DOM ================= */
const INLINE = /(\\\n)|( {2,}\n)|\\([\\`*_{}[\]()#+\-.!<>~|])|`([^`\n]+)`|!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)|\[((?:[^[\]\\]|\\.|\[[^\]]*\])+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)|\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|__(?=\S)([\s\S]+?)(?<=\S)__|\*(?=[^\s*])([\s\S]*?[^\s*])\*|(?<![A-Za-z0-9_])_(?=[^\s_])([\s\S]*?[^\s_])_(?![A-Za-z0-9_])/g;

const appendInline = (parent, text) => {
  let last = 0;
  const txt = (s) => { if (s) parent.append(s.replace(/\n/g, ' ')); };
  for (const m of text.matchAll(INLINE)) {
    txt(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined || m[2] !== undefined) parent.append(h('br'));
    else if (m[3] !== undefined) parent.append(m[3]);
    else if (m[4] !== undefined) parent.append(h('code', {}, m[4]));
    else if (m[6] !== undefined) parent.append(h('img', { src: safeUrl(m[6]), alt: m[5] }));
    else if (m[8] !== undefined) { const a = h('a', { href: safeUrl(m[8]) }); appendInline(a, m[7]); parent.append(a); }
    else if (m[9] !== undefined || m[10] !== undefined) { const s = h('strong'); appendInline(s, m[9] ?? m[10]); parent.append(s); }
    else { const e = h('em'); appendInline(e, m[11] ?? m[12]); parent.append(e); }
  }
  txt(text.slice(last));
};
const inl = (tag, text, attrs) => { const el = h(tag, attrs); appendInline(el, text); return el; };

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^ {0,3}([-*_])( ?\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HTML_RE = /^\s*<\/?[A-Za-z!]/;

const rawNode = (md) => h('div', { class: 'rt-raw', contenteditable: 'false', 'data-md': md },
  h('div', { class: 'rt-raw-l' }, 'Ham blok (tablo / HTML) — değiştirilmeden korunur; "Kaynak" görünümünde düzenlenir'), h('pre', {}, md));

export const parseBlocks = (src) => {
  const out = document.createDocumentFragment();
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  let i = 0;
  const startsBlock = (l, next) => /^ {0,3}#{1,6}\s/.test(l) || HR_RE.test(l) || /^ {0,3}(```|~~~)/.test(l) || /^ {0,3}>/.test(l) || /^\s{0,3}([-*+]|\d+[.)])\s+/.test(l) || HTML_RE.test(l) || (l.includes('|') && next !== undefined && TABLE_SEP.test(next));
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^ {0,3}(```|~~~)\s*([\w+-]*)\s*$/.exec(l))) {
      const fence = m[1], code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++;
      const pre = h('pre', { 'data-lang': m[2] }, h('code', {}, code.join('\n')));
      out.append(pre);
      continue;
    }
    if (HTML_RE.test(l) || (l.includes('|') && lines[i + 1] !== undefined && TABLE_SEP.test(lines[i + 1]))) {
      const raw = [];
      while (i < lines.length && lines[i].trim()) raw.push(lines[i++]);
      out.append(rawNode(raw.join('\n')));
      continue;
    }
    if ((m = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) { out.append(inl(`h${m[1].length}`, m[2])); i++; continue; }
    if (HR_RE.test(l)) { out.append(h('hr')); i++; continue; }
    if (/^ {0,3}>/.test(l)) {
      const q = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      const bq = h('blockquote');
      bq.append(parseBlocks(q.join('\n')));
      out.append(bq);
      continue;
    }
    if (LIST_RE.test(l)) {
      const stack = [];
      let root = null, lastLi = null;
      while (i < lines.length) {
        const cur = lines[i];
        const lm = LIST_RE.exec(cur);
        if (lm && !HR_RE.test(cur)) {
          const indent = lm[1].length, ordered = /\d/.test(lm[2]);
          while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
          let top = stack[stack.length - 1];
          if (top && top.indent === indent && top.list.tagName !== (ordered ? 'OL' : 'UL')) { // aynı düzeyde liste türü değişti → yeni liste
            if (stack.length === 1) break;
            stack.pop(); top = stack[stack.length - 1];
          }
          if (!top || top.indent < indent) {
            const list = h(ordered ? 'ol' : 'ul');
            if (!top) root = root ?? list;
            if (top) top.lastLi.append(list);
            top = { indent, list, lastLi: null };
            stack.push(top);
          }
          const li = inl('li', lm[3]);
          top.list.append(li); top.lastLi = li; lastLi = li;
        } else if (cur.trim() && /^\s+\S/.test(cur) && lastLi) {
          lastLi.append(' ', ...inl('span', cur.trim()).childNodes);
        } else if (!cur.trim() && LIST_RE.test(lines[i + 1] ?? '') && !HR_RE.test(lines[i + 1] ?? '')) {
          /* liste maddeleri arası boş satır */
        } else break;
        i++;
      }
      if (root) out.append(root);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && (!para.length || !startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++]);
    out.append(inl('p', para.map((x) => x.trim() === '' ? '' : x.replace(/^\s+/, '')).join('\n')));
  }
  return out;
};

/* ================= DOM → Markdown ================= */
const esc = (s) => s.replace(/[\\`*_[\]<]/g, '\\$&');
const BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE|HR|TABLE|FIGURE|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|MAIN|NAV|DL)$/;
const hasBlockChild = (el) => [...el.children].some((c) => BLOCK.test(c.tagName) || c.classList?.contains('rt-raw'));

const wrapMark = (node, mark) => {
  const inner = inlineChildren(node);
  if (!inner.trim()) return inner;
  return `${inner.match(/^\s*/)[0]}${mark}${inner.trim()}${mark}${inner.match(/\s*$/)[0]}`;
};
const inlineNode = (c) => {
  if (c.nodeType === 3) return esc(c.nodeValue.replace(/[\u00a0\s]+/g, ' '));
  if (c.nodeType !== 1 || SKIP.has(c.tagName)) return '';
  switch (c.tagName) {
    case 'BR': return c.nextSibling ? '\\\n' : '';
    case 'IMG': return `![${(c.getAttribute('alt') ?? '').replace(/[[\]]/g, '')}](${(c.getAttribute('src') ?? '').replace(/ /g, '%20').replace(/\)/g, '%29')})`;
    case 'CODE': return c.textContent ? `\`${c.textContent.replace(/`/g, "'")}\`` : '';
    case 'STRONG': case 'B': return wrapMark(c, '**');
    case 'EM': case 'I': return wrapMark(c, '*');
    case 'A': {
      const href = (c.getAttribute('href') ?? '').trim().replace(/ /g, '%20').replace(/\)/g, '%29');
      const inner = inlineChildren(c);
      return href && inner.trim() && !UNSAFE.test(href) ? `[${inner}](${href})` : inner;
    }
    default: return inlineChildren(c);
  }
};
const inlineChildren = (node) => [...node.childNodes].map(inlineNode).join('').replace(/\*\*\*\*/g, '');

const para = (t) => {
  t = t.replace(/^\s+|\s+$/g, '');
  if (!t) return '';
  return t.replace(/^(#{1,6}\s|>|[-+]\s|---|\+\+\+)/, '\\$1').replace(/^(\d+)([.)])(\s)/, '$1\\$2$3').replace(/^(```|~~~)/, '\\$1');
};

const listMd = (list, indent = '') => {
  const ordered = list.tagName === 'OL';
  const out = [];
  let n = Number(list.getAttribute('start')) || 1;
  for (const li of list.children) {
    if (li.tagName !== 'LI') continue;
    const marker = ordered ? `${n++}. ` : '- ';
    let text = '';
    const nested = [];
    for (const c of li.childNodes) {
      if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) nested.push(c);
      else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) text += `${text ? ' ' : ''}${inlineChildren(c)}`;
      else text += inlineNode(c);
    }
    text = text.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
    out.push(`${indent}${marker}${text}`);
    for (const nl of nested) out.push(listMd(nl, indent + ' '.repeat(marker.length)));
  }
  return out.filter(Boolean).join('\n');
};

const blocksMd = (container) => {
  const blocks = [];
  let run = '';
  const flush = () => { const t = para(run); if (t) blocks.push(t); run = ''; };
  for (const c of container.childNodes) {
    if (c.nodeType === 3) { run += inlineNode(c); continue; }
    if (c.nodeType !== 1 || SKIP.has(c.tagName)) continue;
    if (c.classList.contains('rt-raw')) { flush(); blocks.push(c.getAttribute('data-md') ?? ''); continue; }
    const t = c.tagName;
    if (!BLOCK.test(t)) { run += inlineNode(c); continue; }
    flush();
    if (/^H[1-6]$/.test(t)) {
      const x = inlineChildren(c).replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (x) blocks.push(`${'#'.repeat(Number(t[1]))} ${x}`);
    } else if (t === 'UL' || t === 'OL') { const x = listMd(c); if (x) blocks.push(x); }
    else if (t === 'BLOCKQUOTE') {
      const x = blocksMd(c).join('\n\n');
      if (x.trim()) blocks.push(x.split('\n').map((ln) => (ln ? `> ${ln}` : '>')).join('\n'));
    } else if (t === 'PRE') {
      const code = c.textContent.replace(/\n$/, '');
      blocks.push(`\`\`\`${c.getAttribute('data-lang') ?? ''}\n${code}\n\`\`\``);
    } else if (t === 'HR') blocks.push('---');
    else if (t === 'TABLE') { const x = para(esc(c.textContent.replace(/\s+/g, ' '))); if (x) blocks.push(x); }
    else if (hasBlockChild(c)) blocks.push(...blocksMd(c));
    else { const x = para(inlineChildren(c)); if (x) blocks.push(x); }
  }
  flush();
  return blocks;
};
export const toMarkdown = (root) => { const b = blocksMd(root); return b.length ? `${b.join('\n\n')}\n` : ''; };

/* ================= editör ================= */
let sepSet = false;
export const createRichEditor = ({ value = '', pickMedia, minHeight = 420, onChange } = {}) => {
  if (!sepSet) { try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch { /* eski tarayıcı */ } sepSet = true; }
  let md = String(value ?? '');
  let mode = 'visual';
  let dirty = false;
  const listeners = [];
  const fire = () => { const ev = new Event('input'); for (const fn of listeners) fn(ev); onChange?.(); };

  const surface = h('div', { class: 'rt-surface', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'İçerik editörü' });
  surface.style.minHeight = `${minHeight}px`;
  const source = h('textarea', { class: 'textarea md-area rt-source', spellcheck: 'false', hidden: true });
  const stats = h('span', {});
  const wrap = h('div', { class: 'rt-wrap' });

  const render = () => {
    surface.replaceChildren(parseBlocks(md));
    if (!surface.firstChild || surface.lastChild.classList?.contains('rt-raw') || surface.lastChild.tagName === 'PRE') surface.append(h('p', {}, h('br')));
  };
  const sync = () => { if (mode === 'visual' && dirty) { md = toMarkdown(surface); dirty = false; } else if (mode === 'source') md = source.value; return md; };
  const updateStats = () => {
    const t = (mode === 'visual' ? surface.textContent : source.value).trim();
    const words = t ? t.split(/\s+/).length : 0;
    stats.textContent = `${words} kelime · ${t.length} karakter · ~${Math.max(1, Math.round(words / 200))} dk okuma`;
  };

  /* ---- seçim yönetimi ---- */
  let saved = null;
  const inside = (n) => n && surface.contains(n);
  const onSel = () => {
    if (!wrap.isConnected) { if (wrapMounted) document.removeEventListener('selectionchange', onSel); return; } // sayfa değişince dinleyiciyi bırak
    wrapMounted = true;
    const s = getSelection();
    if (s.rangeCount && inside(s.anchorNode)) { saved = s.getRangeAt(0).cloneRange(); syncToolbar(); }
  };
  let wrapMounted = false;
  document.addEventListener('selectionchange', onSel);
  const restore = () => {
    if (document.activeElement === surface && inside(getSelection().anchorNode)) return; // odak zaten editörde: güncel seçimi koru
    surface.focus();
    if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  };
  const closest = (tag) => {
    const s = getSelection();
    let n = s.rangeCount ? s.anchorNode : null;
    while (n && n !== surface) { if (n.nodeType === 1 && n.tagName === tag) return n; n = n.parentNode; }
    return null;
  };
  const exec = (cmd, arg) => { restore(); document.execCommand(cmd, false, arg); };
  const markDirty = () => { dirty = true; updateStats(); fire(); };
  const insertNode = (node) => { restore(); const box = h('div'); box.append(node); document.execCommand('insertHTML', false, box.innerHTML); }; // yalnızca kendi ürettiğimiz güvenli düğümler

  /* ---- komutlar ---- */
  const setBlock = (tag) => { restore(); const pre = closest('PRE'); if (pre && tag !== 'pre') document.execCommand('formatBlock', false, '<p>'); document.execCommand('formatBlock', false, `<${tag}>`); };
  const toggleQuote = () => {
    restore();
    const q = closest('BLOCKQUOTE');
    if (q) {
      if (hasBlockChild(q)) { while (q.firstChild) q.before(q.firstChild); q.remove(); } else { const p = h('p'); while (q.firstChild) p.append(q.firstChild); q.replaceWith(p); }
      markDirty();
    } else document.execCommand('formatBlock', false, '<blockquote>');
  };
  const toggleCode = () => {
    restore();
    const c = closest('CODE');
    if (c) { c.replaceWith(document.createTextNode(c.textContent)); markDirty(); return; }
    const t = getSelection().toString();
    if (t) insertNode(h('code', {}, t));
  };
  const link = () => {
    restore();
    const a = closest('A');
    const url = prompt('Bağlantı adresi (https://… veya /sayfa):', a?.getAttribute('href') ?? 'https://');
    if (url === null) return;
    restore();
    if (!url.trim()) { document.execCommand('unlink'); return; }
    if (UNSAFE.test(url)) { alert('Bu bağlantı türüne izin verilmez.'); return; }
    if (getSelection().isCollapsed && !a) insertNode(h('a', { href: url.trim() }, url.trim()));
    else if (a && getSelection().isCollapsed) { a.setAttribute('href', url.trim()); markDirty(); } else document.execCommand('createLink', false, url.trim());
  };
  let selImg = null;
  const image = async () => {
    const m = await pickMedia?.();
    if (!m) return;
    insertNode(h('img', { src: m.url, alt: m.alt || m.title || '' }));
  };
  const imageAlt = () => {
    if (!selImg || !surface.contains(selImg)) { alert('Önce düzenleyeceğiniz görsele tıklayın.'); return; }
    const v = prompt('Görsel alt metni (erişilebilirlik ve SEO için):', selImg.getAttribute('alt') ?? '');
    if (v !== null) { selImg.setAttribute('alt', v); markDirty(); }
  };
  const clearFormat = () => { restore(); document.execCommand('removeFormat'); document.execCommand('unlink'); if (!closest('LI')) document.execCommand('formatBlock', false, '<p>'); };
  const indent = (out) => { if (closest('LI')) exec(out ? 'outdent' : 'indent'); };

  /* ---- araç çubuğu ---- */
  const btns = [];
  const btn = (label, title, fn, opts = {}) => {
    const b = h('button', { type: 'button', class: `rt-btn${opts.cls ? ` ${opts.cls}` : ''}`, title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: () => { if (mode === 'visual' || opts.always) fn(); } }, label);
    if (!opts.always) btns.push(b);
    return b;
  };
  const sep = () => h('span', { class: 'rt-sep' });
  const blockSel = h('select', { class: 'rt-select', title: 'Biçim', 'aria-label': 'Paragraf biçimi', onchange: (e) => { setBlock(e.target.value); surface.focus(); } },
    h('option', { value: 'p' }, 'Paragraf'), h('option', { value: 'h2' }, 'Başlık 2'), h('option', { value: 'h3' }, 'Başlık 3'), h('option', { value: 'h4' }, 'Başlık 4'), h('option', { value: 'pre' }, 'Kod bloğu'));
  btns.push(blockSel);
  const bBold = btn(h('b', {}, 'B'), 'Kalın (Ctrl+B)', () => exec('bold'));
  const bItalic = btn(h('i', {}, 'İ'), 'İtalik (Ctrl+I)', () => exec('italic'));
  const bUl = btn('• ≡', 'Madde işaretli liste', () => exec('insertUnorderedList'));
  const bOl = btn('1. ≡', 'Numaralı liste', () => exec('insertOrderedList'));
  const bQ = btn('❝', 'Alıntı', toggleQuote);
  const bCode = btn('</>', 'Satır içi kod', toggleCode);
  const bLink = btn('Bağlantı', 'Bağlantı ekle / düzenle (Ctrl+K)', link);
  const toolbar = h('div', { class: 'rt-toolbar', role: 'toolbar', 'aria-label': 'Biçimlendirme' },
    blockSel, sep(), bBold, bItalic, sep(), bUl, bOl, btn('⇥', 'Girinti artır (liste içinde, Tab)', () => indent(false)), btn('⇤', 'Girinti azalt (Shift+Tab)', () => indent(true)), sep(),
    bQ, bCode, sep(), bLink, btn('Bağlantıyı kaldır', 'Bağlantıyı kaldır', () => exec('unlink')),
    pickMedia ? btn('Görsel', 'Medya kütüphanesinden görsel ekle', image) : null, btn('Alt metin', 'Seçili görselin alt metnini düzenle', imageAlt),
    btn('―', 'Yatay çizgi', () => exec('insertHorizontalRule')), sep(),
    btn('↶', 'Geri al (Ctrl+Z)', () => exec('undo')), btn('↷', 'Yinele (Ctrl+Y)', () => exec('redo')), btn('Tx', 'Biçimi temizle', clearFormat),
    h('span', { class: 'grow' }),
    btn('Kaynak', 'Markdown kaynağını göster / düzenle', () => setMode(mode === 'visual' ? 'source' : 'visual'), { always: true, cls: 'rt-toggle' }),
    btn('⤢', 'Tam ekran', () => { wrap.classList.toggle('rt-full'); document.body.classList.toggle('rt-lock', wrap.classList.contains('rt-full')); }, { always: true }));
  const toggleBtn = toolbar.querySelector('.rt-toggle');

  function syncToolbar() {
    if (mode !== 'visual') return;
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    bBold.classList.toggle('on', q('bold')); bItalic.classList.toggle('on', q('italic'));
    bUl.classList.toggle('on', !!closest('UL')); bOl.classList.toggle('on', !!closest('OL'));
    bQ.classList.toggle('on', !!closest('BLOCKQUOTE')); bCode.classList.toggle('on', !!closest('CODE')); bLink.classList.toggle('on', !!closest('A'));
    const tag = ['H2', 'H3', 'H4', 'PRE'].find((t) => closest(t));
    blockSel.value = tag ? tag.toLowerCase() : 'p';
  }

  function setMode(next) {
    if (next === mode) return;
    if (next === 'source') { sync(); source.value = md; mode = 'source'; surface.hidden = true; source.hidden = false; }
    else { md = source.value; mode = 'visual'; source.hidden = true; surface.hidden = false; render(); dirty = false; }
    for (const b of btns) b.disabled = mode === 'source';
    toggleBtn.classList.toggle('on', mode === 'source');
    toggleBtn.textContent = mode === 'source' ? 'Görsel' : 'Kaynak';
    updateStats();
  }

  /* ---- olaylar ---- */
  surface.addEventListener('input', (e) => {
    if (e.inputType === 'insertText' && e.data?.endsWith(' ')) mdShortcut();
    markDirty();
  });
  source.addEventListener('input', () => { md = source.value; updateStats(); fire(); });
  surface.addEventListener('click', (e) => {
    selImg = e.target.tagName === 'IMG' ? e.target : null;
    if (selImg) { const r = document.createRange(); r.selectNode(selImg); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    const a = e.target.closest?.('a');
    if (a && (e.ctrlKey || e.metaKey)) window.open(a.getAttribute('href'), '_blank', 'noopener');
  });
  surface.addEventListener('drop', (e) => e.preventDefault());
  surface.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const text = html ? toMarkdown(new DOMParser().parseFromString(html, 'text/html').body) : plain;
    const frag = parseBlocks(text);
    const box = h('div');
    box.append(frag);
    const kids = [...box.children];
    restore();
    if (kids.length === 1 && kids[0].tagName === 'P') document.execCommand('insertHTML', false, kids[0].innerHTML);
    else if (kids.length) document.execCommand('insertHTML', false, box.innerHTML);
  });
  const RULES = [[/^#{1,4}$/, (m) => () => document.execCommand('formatBlock', false, `<h${Math.max(2, m.length)}>`)], [/^[-*]$/, () => () => document.execCommand('insertUnorderedList')], [/^1[.)]$/, () => () => document.execCommand('insertOrderedList')], [/^>$/, () => () => document.execCommand('formatBlock', false, '<blockquote>')]];
  // "## " + boşluk → başlık, "- " → liste, "1. " → numaralı liste, "> " → alıntı
  const mdShortcut = () => {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return;
    let blk = s.anchorNode;
    while (blk && blk.parentNode !== surface) blk = blk.parentNode;
    if (!blk || blk.nodeType !== 1 || blk.tagName !== 'P') return;
    const r = document.createRange();
    r.setStart(blk, 0); r.setEnd(s.anchorNode, s.anchorOffset);
    const pre = r.toString().replace(/[\s\u00a0]+$/, '');
    if (r.toString().length !== pre.length + 1) return;
    const rule = RULES.find(([re]) => re.test(pre));
    if (!rule) return;
    s.removeAllRanges(); s.addRange(r);
    document.execCommand('delete');
    rule[1](pre)();
  };
  surface.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); link(); return; }
    if (e.key === 'Tab' && closest('LI')) { e.preventDefault(); indent(e.shiftKey); return; }
    if (e.key === 'Escape' && wrap.classList.contains('rt-full')) { wrap.classList.remove('rt-full'); document.body.classList.remove('rt-lock'); return; }
  });

  wrap.append(toolbar, surface, source, h('div', { class: 'rt-status' }, stats, h('span', { class: 'grow' }), h('span', { class: 'muted' }, 'Kısayollar: ## + boşluk başlık · - + boşluk liste · Ctrl+K bağlantı')));
  render();
  updateStats();

  const api = {
    el: wrap,
    get value() { return sync(); },
    set value(v) { md = String(v ?? ''); dirty = false; if (mode === 'visual') render(); else source.value = md; updateStats(); },
    get: () => sync(),
    set: (v) => { api.value = v; },
    addEventListener: (type, fn) => { if (type === 'input') listeners.push(fn); },
    dispatchEvent: (ev) => { if (ev.type === 'input') for (const fn of listeners) fn(ev); return true; },
    focus: () => (mode === 'visual' ? surface : source).focus(),
    selectedText: () => (mode === 'visual' ? (inside(getSelection().anchorNode) ? getSelection().toString() : '') : source.value.slice(source.selectionStart, source.selectionEnd)),
    /** Seçim/imleç yerine Markdown parçası ekler (ör. iç bağlantı önerisi) */
    insertMarkdown: (text) => {
      if (mode === 'source') { const p = source.selectionStart; source.value = `${source.value.slice(0, p)}${text}${source.value.slice(p)}`; md = source.value; fire(); return; }
      if (!saved) { surface.append(parseBlocks(text)); markDirty(); return; } // imleç hiç konmadıysa metnin sonuna yeni paragraf olarak ekle
      const box = h('div');
      box.append(parseBlocks(text));
      restore();
      document.execCommand('insertHTML', false, box.children.length === 1 && box.firstChild.tagName === 'P' ? `${box.firstChild.innerHTML} ` : box.innerHTML);
    },
  };
  return api;
};
