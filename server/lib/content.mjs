// İçerik belgeleri: varsayılan (data/defaults) + taslak + yayın (override) yönetimi
import fs from 'node:fs';
import path from 'node:path';
import { q, tx, audit } from './db.mjs';
import { paths } from './config.mjs';
import { HttpError } from './http.mjs';
import { syncMediaRefs } from './assets.mjs';

/** Belge anahtarı → grup ve Türkçe ad. Listede olmayan anahtarlar "Diğer" grubunda görünür. */
const G = {
  home: 'Ana Sayfa',
  about: 'Hakkımızda',
  services: 'Hizmetler',
  svcRecords: 'Hizmet Kayıtları (78 sayfa)',
  expertise: 'Uzmanlık Alanları',
  projects: 'Projeler',
  blog: 'Blog',
  contact: 'İletişim',
  work: 'Çalışma Modelimiz',
  general: 'Genel ve Menü',
};
export const GROUP_ORDER = Object.values(G);

const META = {
  'home.homeHero': [G.home, 'Hero (üst alan)'],
  'home.homeIntro': [G.home, 'Giriş bölümü'],
  'home.homeWhy': [G.home, 'Neden AKORT?'],
  'home.homeSections': [G.home, 'Bölüm başlıkları (hizmet, süreç, proje, blog)'],
  'home.homeCta': [G.home, 'Alt çağrı bandı'],
  'about.aboutHero': [G.about, 'Hero'],
  'about.aboutIntro': [G.about, 'Giriş'],
  'about.aboutPrinciples': [G.about, 'Misyon, vizyon, değerler'],
  'about.aboutWhy': [G.about, 'Neden AKORT?'],
  'about.aboutMilestones': [G.about, 'Yolculuğumuz / kilometre taşları'],
  'about.aboutApproach': [G.about, 'Yaklaşımımız'],
  'about.aboutExpertise': [G.about, 'Uzmanlık alanlarımız (4 kart)'],
  'about.aboutCta': [G.about, 'Alt çağrı bandı'],
  'servicesPage.servicesHero': [G.services, 'Hizmetler sayfası — Hero'],
  'servicesPage.servicesIntro': [G.services, 'Giriş'],
  'servicesPage.servicesGrid': [G.services, 'Hizmet kartları bölümü'],
  'servicesPage.featuredService': [G.services, 'Öne çıkan hizmet'],
  'servicesPage.servicesProcess': [G.services, 'Süreç bölümü'],
  'servicesPage.servicesWhy': [G.services, 'Neden AKORT?'],
  'servicesPage.servicesCta': [G.services, 'Alt çağrı bandı (tüm hizmet sayfalarında)'],
  'services.services': [G.services, 'Hizmet kartları (ana sayfa ve hizmetler)'],
  'services.servicePillars': [G.services, 'Hizmet grupları (başlık + madde listesi)'],
  'serviceContent.muhendislik.muhendislikServices': [G.svcRecords, 'Mühendislik Danışmanlığı (15 sayfa)'],
  'serviceContent.bim.bimServices': [G.svcRecords, 'BIM ve Dijital Mühendislik (24 sayfa)'],
  'serviceContent.enerji.enerjiServices': [G.svcRecords, 'Enerji ve Bina Performansı (13 sayfa)'],
  'serviceContent.maliyet.maliyetServices': [G.svcRecords, 'Maliyet ve Teknik Danışmanlık (11 sayfa)'],
  'serviceContent.yazilim.yazilimServices': [G.svcRecords, 'Yazılım, Yapay Zeka ve Dijital Çözümler (15 sayfa)'],
  'techStack.techStack': [G.general, 'Kullanılan teknolojiler (yazılım hizmeti)'],
  'serviceContent.sectors.sectorEntries': [G.expertise, 'Sektör sayfaları (8 sayfa)'],
  'expertisePage.expertiseHero': [G.expertise, 'Hero'],
  'expertisePage.expertiseIntro': [G.expertise, 'Giriş'],
  'expertisePage.expertiseSectors': [G.expertise, 'Sektör kartları'],
  'expertisePage.expertiseIntegrated': [G.expertise, 'Bütüncül yaklaşım'],
  'expertisePage.expertiseDisciplines': [G.expertise, 'Disiplinler'],
  'expertisePage.expertiseCta': [G.expertise, 'Alt çağrı bandı'],
  'projectsPage.projectsHero': [G.projects, 'Hero'],
  'projectsPage.projectsList': [G.projects, 'Liste başlıkları'],
  'projectsPage.projectFilters': [G.projects, 'Filtre etiketleri'],
  'projectsPage.spotlightSection': [G.projects, 'Öne çıkan proje bölümü'],
  'projectsPage.projectMetrics': [G.projects, 'Proje göstergeleri (rakamlar)'],
  'projectsPage.projectsCta': [G.projects, 'Alt çağrı bandı'],
  'blog.blogHero': [G.blog, 'Hero'],
  'blog.blogListing': [G.blog, 'Liste ve yan panel metinleri'],
  'blog.newsletter': [G.blog, 'Bülten bandı'],
  'contactPage.contactHero': [G.contact, 'Hero'],
  'contactPage.contactIntro': [G.contact, 'Giriş'],
  'contactPage.contactForm': [G.contact, 'İletişim formu (alanlar, KVKK metni, uç nokta)'],
  'contactPage.leadQualification': [G.contact, 'Talep nitelendirme alanları'],
  'contactPage.contactInfo': [G.contact, 'İletişim bilgileri (telefon, e-posta, adres)'],
  'contactPage.contactMap': [G.contact, 'Harita'],
  'contactPage.contactFaqSection': [G.contact, 'SSS bölüm başlığı'],
  'contactPage.contactCta': [G.contact, 'Alt çağrı bandı'],
  'faq.contactFaq': [G.contact, 'Sıkça sorulan sorular'],
  'workModel.workModelPage': [G.work, 'Çalışma Modelimiz — sayfa metinleri'],
  'workModel.workSteps': [G.work, 'Çalışma Modelimiz — 5 adım'],
  'process.process': [G.work, 'Ana sayfa süreç adımları'],
  'images.siteImages': [G.general, 'Site görselleri (hero, intro, hizmet ve sektör görselleri)'],
  'site.site': [G.general, 'Site bilgileri (ad, açıklama, sosyal bağlantılar)'],
  'navigation.mainNav': [G.general, 'Ana menü'],
  'navigation.aboutMenu': [G.general, 'Hakkımızda açılır menüsü'],
  'footer.legalNav': [G.general, 'Alt bilgi — yasal bağlantılar'],
  'assistant.assistant': [G.general, 'Teknik Asistan'],
};

const fileOf = (key) => `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

export const defaultsOf = (key) => readJson(path.join(paths.defaults, fileOf(key)));
export const hasDefaults = (key) => fs.existsSync(path.join(paths.defaults, fileOf(key)));

const assertKey = (key) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(key) || !hasDefaults(key)) throw new HttpError(404, 'Belge bulunamadı');
};

export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
export const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const listDocs = () => {
  const drafts = new Map(q.all('SELECT key, updated_at, updated_by FROM drafts').map((r) => [r.key, r]));
  const pub = new Map(q.all('SELECT key, published_at FROM published').map((r) => [r.key, r]));
  const keys = fs
    .readdirSync(paths.defaults)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5));
  return keys
    .map((key) => {
      const [group, label] = META[key] ?? ['Diğer', key];
      const d = drafts.get(key);
      return { key, group, label, draft: !!d, draftAt: d?.updated_at ?? null, draftBy: d?.updated_by ?? null, published: pub.has(key), publishedAt: pub.get(key)?.published_at ?? null };
    })
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.label.localeCompare(b.label, 'tr'));
};

export const getDoc = (key) => {
  assertKey(key);
  const defaults = defaultsOf(key);
  const draft = q.get('SELECT json, updated_at, updated_by FROM drafts WHERE key = ?', key);
  const pub = q.get('SELECT json, published_at, published_by FROM published WHERE key = ?', key);
  const [group, label] = META[key] ?? ['Diğer', key];
  return {
    key,
    group,
    label,
    defaults,
    published: pub ? JSON.parse(pub.json) : null,
    publishedAt: pub?.published_at ?? null,
    draft: draft ? JSON.parse(draft.json) : null,
    draftAt: draft?.updated_at ?? null,
    draftBy: draft?.updated_by ?? null,
  };
};

/* ------------------------------ doğrulama ------------------------------ */

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const URLISH = /(^|\.)(href|url|link|endpoint)$/i;

/** Dizideki nesne öğeleri için "zorunlu anahtarlar": varsayılan öğelerin tümünde bulunan anahtarlar */
const requiredKeys = (arr) => {
  const objs = arr.filter(isPlainObject);
  if (!objs.length) return null;
  return Object.keys(objs[0]).filter((k) => objs.every((o) => k in o));
};

const validate = (def, val, p, errors) => {
  if (def === undefined) return; // varsayılanda yok → serbest (isteğe bağlı alan)
  const dt = typeOf(def), vt = typeOf(val);
  if (dt === 'null' || dt === 'undefined') return;
  if (dt !== vt) {
    // sayı ↔ metin dönüşümüne izin verme; ama boş isteğe bağlı nesneler için null'a izin ver
    errors.push(`${p || 'kök'}: ${dt} bekleniyordu, ${vt} geldi`);
    return;
  }
  if (vt === 'string') {
    if (val.length > 20000) errors.push(`${p}: metin çok uzun`);
    if (URLISH.test(p) && val && !/^(\/|#|https?:\/\/|mailto:|tel:)/i.test(val.trim())) errors.push(`${p}: bağlantı "/", "#", "http(s)://", "mailto:" veya "tel:" ile başlamalı`);
    return;
  }
  if (vt === 'array') {
    const req = requiredKeys(def);
    val.forEach((item, i) => {
      if (isPlainObject(item) && req) {
        for (const k of req) if (!(k in item)) errors.push(`${p}[${i}]: "${k}" alanı zorunlu`);
        for (const k of req) validate(def.find(isPlainObject)?.[k], item[k], `${p}[${i}].${k}`, errors);
      } else if (def.length && !isPlainObject(item)) {
        const t0 = typeOf(def[0]);
        if (t0 !== typeOf(item)) errors.push(`${p}[${i}]: ${t0} bekleniyordu`);
        else if (t0 === 'array') validate(def[0], item, `${p}[${i}]`, errors);
      }
    });
    return;
  }
  if (vt === 'object') {
    for (const k of Object.keys(def)) {
      if (!(k in val)) continue; // eksik anahtar varsayılandan gelir
      validate(def[k], val[k], p ? `${p}.${k}` : k, errors);
    }
  }
};

export const validateDoc = (key, value) => {
  const def = defaultsOf(key);
  const errors = [];
  validate(def, value, '', errors);
  if (JSON.stringify(value).length > 2_000_000) errors.push('Belge çok büyük');
  return errors;
};

/* ------------------------------ taslak ------------------------------ */

export const saveDraft = (key, value, user, note = '') => {
  assertKey(key);
  const errors = validateDoc(key, value);
  if (errors.length) throw new HttpError(422, 'Doğrulama hatası', { errors: errors.slice(0, 30) });
  syncMediaRefs(value); // /medya/... görsellerini derlemeye hazır klasöre kopyala
  const json = JSON.stringify(value);
  tx(() => {
    q.run(
      `INSERT INTO drafts (key, json, updated_by, updated_at) VALUES (?,?,?,datetime('now'))
       ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      key,
      json,
      user.email,
    );
    q.run('INSERT INTO versions (key, json, kind, note, user_email) VALUES (?,?,?,?,?)', key, json, 'taslak', note, user.email);
    // sürüm geçmişini belge başına son 40 kayıtla sınırla
    q.run('DELETE FROM versions WHERE key = ? AND id NOT IN (SELECT id FROM versions WHERE key = ? ORDER BY id DESC LIMIT 40)', key, key);
  });
  audit(user, 'icerik.taslak', key);
};

export const discardDraft = (key, user) => {
  assertKey(key);
  q.run('DELETE FROM drafts WHERE key = ?', key);
  audit(user, 'icerik.taslak_sil', key);
};

export const listVersions = (key) => {
  assertKey(key);
  return q.all('SELECT id, kind, note, user_email, created_at FROM versions WHERE key = ? ORDER BY id DESC LIMIT 40', key);
};

export const getVersion = (key, id) => {
  assertKey(key);
  const v = q.get('SELECT json, kind, created_at, user_email FROM versions WHERE key = ? AND id = ?', key, id);
  if (!v) throw new HttpError(404, 'Sürüm bulunamadı');
  return { ...v, json: JSON.parse(v.json) };
};

/* ------------------------------ yayın ------------------------------ */

export const pendingDrafts = () => q.all('SELECT key, updated_at, updated_by FROM drafts ORDER BY updated_at DESC');

/** Yayın için yeni override durumunu hesaplar (henüz hiçbir şey yazmaz). */
export const planPublish = () => {
  const out = [];
  for (const d of q.all('SELECT key, json FROM drafts')) {
    const def = defaultsOf(d.key);
    const value = JSON.parse(d.json);
    out.push({ key: d.key, json: d.json, matchesDefaults: deepEqual(def, value) });
  }
  return out;
};

const publishedFile = (key) => path.join(paths.published, fileOf(key));

/** Yayın dosyalarını yazar; geri alma için önceki durumu döndürür. */
export const applyPublishToDisk = (plan) => {
  const snapshot = new Map();
  for (const p of plan) {
    const f = publishedFile(p.key);
    snapshot.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
    if (p.matchesDefaults) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, JSON.stringify(JSON.parse(p.json), null, 2));
  }
  return () => {
    for (const [f, content] of snapshot) {
      if (content === null) fs.rmSync(f, { force: true });
      else fs.writeFileSync(f, content);
    }
  };
};

/** Derleme başarılı olduktan sonra veritabanını günceller. */
export const commitPublish = (plan, user) =>
  tx(() => {
    for (const p of plan) {
      if (p.matchesDefaults) q.run('DELETE FROM published WHERE key = ?', p.key);
      else
        q.run(
          `INSERT INTO published (key, json, published_by, published_at) VALUES (?,?,?,datetime('now'))
           ON CONFLICT(key) DO UPDATE SET json = excluded.json, published_by = excluded.published_by, published_at = excluded.published_at`,
          p.key,
          p.json,
          user.email,
        );
      q.run('INSERT INTO versions (key, json, kind, user_email) VALUES (?,?,?,?)', p.key, p.json, 'yayın', user.email);
      q.run('DELETE FROM drafts WHERE key = ?', p.key);
    }
  });

/** Yayınlanmış override dosyalarını veritabanından yeniden üretir (taşıma/geri yükleme sonrası). */
export const syncPublishedFiles = () => {
  const rows = q.all('SELECT key, json FROM published');
  const wanted = new Set(rows.map((r) => fileOf(r.key)));
  for (const f of fs.readdirSync(paths.published)) if (f.endsWith('.json') && !wanted.has(f)) fs.rmSync(path.join(paths.published, f));
  for (const r of rows) fs.writeFileSync(publishedFile(r.key), JSON.stringify(JSON.parse(r.json), null, 2));
};

/* ------------------------------ doğrulama bekleyen alanlar ------------------------------ */

/** NO_FAKE_DATA: { value, verified:false } olan alanları (güncel içerikte) listeler. */
export const scanUnverified = () => {
  const found = [];
  const walk = (node, p, key, label) => {
    if (Array.isArray(node)) return node.forEach((x, i) => walk(x, `${p}[${i}]`, key, label));
    if (!isPlainObject(node)) return;
    if ('value' in node && typeof node.verified === 'boolean') {
      if (!node.verified) found.push({ key, label, path: p, value: typeof node.value === 'string' ? node.value : JSON.stringify(node.value) });
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, p ? `${p}.${k}` : k, key, label);
  };
  for (const d of listDocs()) {
    const doc = getDoc(d.key);
    walk(doc.draft ?? doc.published ?? doc.defaults, '', d.key, d.label);
  }
  return found;
};
