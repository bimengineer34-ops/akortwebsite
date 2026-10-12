// Bağımlılıksız SVG grafik bileşenleri: KPI kartı, mini çubuk/çizgi, alan grafiği, yığılmış çubuk, halka, yatay çubuk listesi.
// Renkler CSS değişkenlerinden (tema duyarlı); veri her zaman metin/öznitelik olarak eklenir (XSS güvenli).
import { h, icon, applyStyle } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) { if (k === 'style') applyStyle(el, v); else el.setAttribute(k, String(v)); }
  for (const k of kids) if (k) el.append(k);
  return el;
};

export const PALETTE = ['#0b7bd6', '#8b5cf6', '#28c76f', '#ff9f43', '#ea5455', '#00cfe8', '#ff6bb5', '#a8aaae'];
export const fmtNum = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Number.isInteger(n) ? n.toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
};
const niceMax = (m) => {
  if (m <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(m));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/** KPI kartındaki küçük çubuk grafik */
export const sparkBars = (values, color = 'var(--c-blue)', w = 84, hgt = 34) => {
  const max = Math.max(...values, 1);
  const n = values.length || 1;
  const bw = Math.max(2, Math.floor(w / n) - 1);
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, 'aria-hidden': 'true', class: 'spark' });
  values.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 2 : 1, (v / max) * (hgt - 2));
    svg.append(s('rect', { x: i * (w / n), y: hgt - bh, width: bw, height: bh, rx: 1, fill: color, opacity: v > 0 ? 0.95 : 0.25 }));
  });
  return svg;
};

export const sparkLine = (values, color = 'var(--c-blue)', w = 84, hgt = 34) => {
  const max = Math.max(...values, 1), n = values.length;
  const pts = values.map((v, i) => [n > 1 ? (i / (n - 1)) * w : w / 2, hgt - 2 - (v / max) * (hgt - 4)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, 'aria-hidden': 'true', class: 'spark' }, s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
};

/** Alan sparkline (referans KPI kartlarındaki gibi dolgulu çizgi) */
export const sparkArea = (values, color = 'var(--c-blue)', w = 130, hgt = 54) => {
  const max = Math.max(...values, 1), n = values.length;
  const id = 'sa' + Math.random().toString(36).slice(2, 8);
  const pts = values.map((v, i) => [n > 1 ? (i / (n - 1)) * w : w / 2, hgt - 3 - (v / max) * (hgt - 8)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, 'aria-hidden': 'true', class: 'spark' });
  svg.append(s('defs', {}, s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.32 }), s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }))));
  if (pts.length) svg.append(s('path', { d: `${line} L${w},${hgt} L0,${hgt} Z`, fill: `url(#${id})` }));
  svg.append(s('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return svg;
};

/**
 * KPI kartı (referans düzeni): solda simge kutusu, ortada etiket + büyük değer + delta, sağda alan grafiği.
 * delta: yüzde değişim (null → gösterilmez). goodUp=false ise artış kötü sayılır. target: hedef (ilerleme çubuğu).
 * connect: veri kaynağı bağlı değil → değer yerine "Bağlantı gerekli" gösterilir (sahte rakam yok).
 */
export const slug = (t) => String(t).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const kpiCard = ({ onClick, scroll, ic, label, value, unit = '', delta = null, deltaLabel = '', series = [], color = 'var(--c-blue)', to = '', hint = '', target = null, goodUp = true, spark = 'area', connect = false }) => {
  const up = delta !== null && delta > 0, down = delta !== null && delta < 0;
  const good = (up && goodUp) || (down && !goodUp);
  const deltaEl = delta === null ? null : h('div', { class: `kpi-delta ${delta === 0 ? '' : good ? 'up' : 'down'}` }, h('b', {}, `${up ? '↗' : down ? '↘' : '→'} %${Math.abs(Math.round(delta))}`), h('span', {}, deltaLabel || 'Önceki döneme göre'));
  const pct = target ? Math.min(100, Math.round((Number(value) / target) * 100)) : null;
  const main = connect
    ? [h('div', { class: 'kpi-val dim' }, '—'), h('div', { class: 'kpi-conn' }, 'Bağlantı gerekli')]
    : [h('div', { class: 'kpi-val' }, `${typeof value === 'number' ? fmtNum(value) : value}`, unit ? h('small', {}, ` ${unit}`) : null), deltaEl ?? (deltaLabel ? h('div', { class: 'kpi-delta' }, h('span', {}, deltaLabel)) : null)];
  const body = [
    h('span', { class: 'kpi-ic', style: `--kc:${color}` }, ic ? icon(ic, 22) : null),
    h('div', { class: 'kpi-txt' }, h('div', { class: 'kpi-label', title: hint || label }, label), ...main,
      pct !== null ? h('div', { class: 'kpi-goal', title: `Hedef: ${fmtNum(target)}` }, h('div', { class: 'progress-bar' }, h('i', { style: `width:${pct}%;background:${pct >= 100 ? 'var(--ok)' : color}` })), h('span', { class: 'small muted' }, `Hedef ${fmtNum(target)} · %${pct}`)) : null),
    !connect && series.length ? h('div', { class: 'kpi-spark' }, spark === 'bars' ? sparkBars(series, color) : spark === 'line' ? sparkLine(series, color) : sparkArea(series, color)) : null,
  ];
  if (onClick || scroll) {
    return h('button', { class: 'card kpi link', type: 'button', 'aria-label': `${label}: ilgili bölüme git`, onclick: (e) => {
      if (onClick) return onClick(e);
      const el = document.getElementById(slug(scroll));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1500);
    } }, ...body);
  }
  return to ? h('a', { class: 'card kpi', href: `#${to}` }, ...body) : h('div', { class: 'card kpi' }, ...body);
};

/** Alan/çizgi grafiği (çoklu seri). series: [{name,color,values}] */
export const areaChart = ({ labels, series, height = 240, fill = true, yFmt = fmtNum }) => {
  const W = 760, H = height, L = 46, R = 12, T = 12, B = 28;
  const max = niceMax(Math.max(...series.flatMap((x) => x.values), 1));
  const n = labels.length;
  const X = (i) => L + (n > 1 ? (i / (n - 1)) * (W - L - R) : (W - L - R) / 2);
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': series.map((x) => x.name).join(', ') + ' grafiği', preserveAspectRatio: 'none' });
  for (let g = 0; g <= 4; g++) {
    const v = (max / 4) * g, y = Y(v);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid-line' }));
    const t = s('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'axis' }); t.textContent = yFmt(v); svg.append(t);
  }
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((lb, i) => { if (i % step === 0 || i === n - 1) { const t = s('text', { x: X(i), y: H - 8, 'text-anchor': 'middle', class: 'axis' }); t.textContent = lb; svg.append(t); } });
  series.forEach((sr, si) => {
    const pts = sr.values.map((v, i) => [X(i), Y(v)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const id = `g${Math.random().toString(36).slice(2, 8)}${si}`;
    if (fill && pts.length) {
      svg.append(s('defs', {}, s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0%', 'stop-color': sr.color, 'stop-opacity': 0.35 }), s('stop', { offset: '100%', 'stop-color': sr.color, 'stop-opacity': 0 }))));
      svg.append(s('path', { d: `${line} L${pts.at(-1)[0]},${H - B} L${pts[0][0]},${H - B} Z`, fill: `url(#${id})` }));
    }
    svg.append(s('path', { d: line, fill: 'none', stroke: sr.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
    pts.forEach(([x, y], i) => { const c = s('circle', { cx: x, cy: y, r: 3.5, fill: sr.color, class: 'dot' }, s('title', {})); c.firstChild.textContent = `${sr.name} · ${labels[i]}: ${yFmt(sr.values[i])}`; svg.append(c); });
  });
  return h('div', { class: 'chart-wrap' }, h('div', { class: 'legend' }, series.map((x) => h('span', {}, h('i', { style: `background:${x.color}` }), x.name))), svg);
};

/** Yığılmış çubuk grafik: series [{name,color,values}] */
export const barChart = ({ labels, series, height = 220, yFmt = fmtNum }) => {
  const W = 760, H = height, L = 46, R = 8, T = 12, B = 28;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((a, x) => a + (x.values[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 1));
  const slot = (W - L - R) / Math.max(n, 1), bw = Math.max(3, slot * 0.62);
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': series.map((x) => x.name).join(', ') + ' çubuk grafiği', preserveAspectRatio: 'none' });
  for (let g = 0; g <= 4; g++) {
    const v = (max / 4) * g, y = Y(v);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid-line' }));
    const t = s('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'axis' }); t.textContent = yFmt(v); svg.append(t);
  }
  const step = Math.max(1, Math.ceil(n / 10));
  labels.forEach((lb, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    let acc = 0;
    series.forEach((sr) => {
      const v = sr.values[i] ?? 0;
      if (!v) return;
      const y1 = Y(acc + v), y0 = Y(acc);
      const r = s('rect', { x, y: y1, width: bw, height: Math.max(1, y0 - y1), fill: sr.color, rx: 1.5, class: 'bar' }, s('title', {}));
      r.firstChild.textContent = `${sr.name} · ${lb}: ${yFmt(v)}`;
      svg.append(r);
      acc += v;
    });
    if (i % step === 0 || i === n - 1) { const t = s('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis' }); t.textContent = lb; svg.append(t); }
  });
  return h('div', { class: 'chart-wrap' }, series.length > 1 ? h('div', { class: 'legend' }, series.map((x) => h('span', {}, h('i', { style: `background:${x.color}` }), x.name))) : null, svg);
};

/** Halka grafik: items [{label,value,color}] */
export const donut = ({ items, center = '', sub = '', size = 168, empty = 'Veri yok' }) => {
  const total = items.reduce((a, x) => a + x.value, 0);
  const r = 62, c = 2 * Math.PI * r;
  const svg = s('svg', { viewBox: '0 0 160 160', width: size, height: size, role: 'img', 'aria-label': items.map((x) => `${x.label}: ${x.value}`).join(', ') });
  svg.append(s('circle', { cx: 80, cy: 80, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': 18 }));
  let off = 0;
  if (total > 0) items.forEach((it, i) => {
    if (!it.value) return;
    const len = (it.value / total) * c;
    const seg = s('circle', { cx: 80, cy: 80, r, fill: 'none', stroke: it.color ?? PALETTE[i % PALETTE.length], 'stroke-width': 18, 'stroke-dasharray': `${Math.max(0, len - 1.5)} ${c - len + 1.5}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 80 80)' }, s('title', {}));
    seg.firstChild.textContent = `${it.label}: ${it.value} (%${Math.round((it.value / total) * 100)})`;
    svg.append(seg);
    off += len;
  });
  const ct = s('text', { x: 80, y: sub ? 80 : 86, 'text-anchor': 'middle', class: 'donut-c' }); ct.textContent = total > 0 ? String(center || fmtNum(total)) : '—'; svg.append(ct);
  if (sub) { const st = s('text', { x: 80, y: 98, 'text-anchor': 'middle', class: 'donut-s' }); st.textContent = sub; svg.append(st); }
  return h('div', { class: 'donut-wrap' }, svg, total > 0
    ? h('ul', { class: 'donut-legend' }, items.map((it, i) => h('li', {}, h('i', { style: `background:${it.color ?? PALETTE[i % PALETTE.length]}` }), h('span', { class: 'grow' }, it.label), h('b', {}, fmtNum(it.value)), h('span', { class: 'muted small' }, `%${Math.round((it.value / total) * 100)}`))))
    : h('div', { class: 'muted small' }, empty));
};

/** Tek değerli halka gösterge (0-100) */
export const ring = (value, { size = 120, stroke = 12, color, label = '', sub = '' } = {}) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const col = color ?? (v >= 80 ? '#12b76a' : v >= 55 ? '#f79009' : '#f04438');
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `${label} ${v}` });
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': stroke }));
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: col, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': `${(v / 100) * c} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }));
  const t = s('text', { x: size / 2, y: size / 2 + (sub ? 2 : 8), 'text-anchor': 'middle', class: 'donut-c', style: `font-size:${Math.round(size / 4.2)}px` }); t.textContent = String(v); svg.append(t);
  if (sub) { const u = s('text', { x: size / 2, y: size / 2 + size / 6, 'text-anchor': 'middle', class: 'donut-s' }); u.textContent = sub; svg.append(u); }
  return h('div', { class: 'ring' }, svg);
};

/** Yatay çubuk listesi: rows [{label, value, sub}] */
export const hbars = (rows, { color = 'var(--c-blue)', fmt = fmtNum, empty = 'Veri yok' } = {}) => {
  if (!rows.length) return h('div', { class: 'muted small', style: 'padding:8px 0' }, empty);
  const max = Math.max(...rows.map((r) => r.value), 1);
  return h('ul', { class: 'hbars' }, rows.map((r, i) => h('li', {}, h('div', { class: 'hb-top' }, h('span', { class: 'hb-l' }, r.label), h('b', {}, fmt(r.value))), h('div', { class: 'progress-bar' }, h('i', { style: `width:${Math.max(2, (r.value / max) * 100)}%;background:${r.color ?? (Array.isArray(color) ? color[i % color.length] : color)}` })), r.sub ? h('div', { class: 'small muted' }, r.sub) : null)));
};

/** Panel kabuğu: başlık + sağda eylem */
export const panel = (title, body, { action, sub, ic } = {}) =>
  h('section', { class: 'card panel', id: slug(title) }, h('div', { class: 'panel-head' }, ic ? h('span', { class: 'panel-ic' }, icon(ic, 18)) : null, h('div', { class: 'grow' }, h('h3', {}, title), sub ? h('div', { class: 'small muted' }, sub) : null), action ?? null), h('div', { class: 'panel-body' }, body));
