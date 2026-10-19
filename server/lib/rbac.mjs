// Rol tabanlı yetki: 7 rol. Merkezi denetim dispatch() içinde yapılır; ayrıca mevcut requireAdmin kontrolleri aynen sürer.
// Kural: yönetici/editör davranışı DEĞİŞMEZ; diğer roller yalnızca kendi alanlarında yazabilir, okuma serbest (CRM kişisel verisi hariç).

export const ROLES = {
  admin: { label: 'Yönetici', desc: 'Her şey: kullanıcılar, günlük, yedek, entegrasyonlar, onay ve yayın.' },
  editor: { label: 'Editör', desc: 'İçerik, SEO, sosyal medya, yayın ve CRM; kullanıcı/yedek/anahtar yönetimi yok.' },
  seo: { label: 'SEO Uzmanı', desc: 'SEO, hız, pazar/rakip/backlink ve AI Stüdyo\'da düzenler; yayın yapamaz.' },
  icerik: { label: 'İçerik Yazarı', desc: 'Sayfa, blog, proje ve medyayı düzenler, AI Stüdyo kullanır; yayın yapamaz.' },
  sosyal: { label: 'Sosyal Medya Uzmanı', desc: 'Social Studio, Brand Kit ve medya; AI Stüdyo. Onay ve hesap bağlama yöneticidedir.' },
  satis: { label: 'Satış / CRM', desc: 'Gelen talepler ve aboneler (kişisel veri); diğer alanlarda salt okunur.' },
  izleyici: { label: 'İzleyici', desc: 'Her yeri salt okunur görür (CRM kişisel verisi hariç); hiçbir şey değiştiremez.' },
};
export const ROLE_IDS = Object.keys(ROLES);

/** Yol → alan. Eşleşmeyen yazma istekleri "sistem" alanıdır (yalnızca admin/editör). */
const AREAS = [
  ['orkestra', /^x\/orkestra(\/|$)/],
  ['crm', /^(formlar|aboneler)(\/|$)/],
  ['medya', /^medya(\/|$)/],
  ['yayin', /^(yayin|yayin-geri-al|yayinlar|yeniden-derle)(\/|$)/],
  ['icerik', /^(icerik|girdi|yonlendirmeler|surum)(\/|$)/],
  ['seo', /^x\/(seo|hiz|pazar|rakip|rakipler|rakip-ozet|backlink)(\/|$)/],
  ['ai', /^x\/ai(\/|$)/],
  ['sosyal', /^x\/(sosyal|marka)(\/|$)/],
  ['dil', /^x\/dil(\/|$)/],
];
/** Her rolün YAZABİLDİĞİ alanlar ('*' = hepsi, 'sistem' dahil) */
const WRITE = {
  admin: '*', editor: '*',
  seo: ['seo', 'ai'],
  icerik: ['icerik', 'medya', 'ai'],
  sosyal: ['sosyal', 'medya', 'ai'],
  satis: ['crm'],
  izleyici: [],
};
/** AI Orchestra görevlerini (komutlar, taslaklar, kaynaklar, kullanım) okuyabilen roller */
const READ_ORCH = new Set(['admin', 'editor']);
/** CRM kişisel verisini okuyabilen roller */
const READ_CRM = new Set(['admin', 'editor', 'satis']);
/** Herkesin kendi oturumu/hesabı için yaptığı yazma istekleri */
const SELF = /^(giris|cikis|kurulum|durum|parola|parola-unuttum|parola-sifirla|2fa|profil|x\/kpi)(\/|$)/;

export const areaOf = (sub) => AREAS.find(([, re]) => re.test(sub))?.[0] ?? 'sistem';

/** @returns {null | string} reddedilirse Türkçe gerekçe, izinliyse null */
export const denyReason = (role, method, pathname) => {
  const sub = pathname.replace(/^\/api\/admin\/?/, '');
  if (!pathname.startsWith('/api/admin/') || SELF.test(sub)) return null;
  const area = areaOf(sub);
  const read = method === 'GET' || method === 'HEAD';
  if (read) {
    if (area === 'crm' && !READ_CRM.has(role)) return 'Gelen talepler kişisel veri içerir; bu rol göremez';
    if (area === 'orkestra' && !READ_ORCH.has(role)) return 'AI Orchestra görevleri ve çıktıları yalnızca yönetici/editör tarafından görüntülenebilir';
    return null;
  }
  const w = WRITE[role];
  if (w === '*' || w?.includes(area)) return null;
  return `"${ROLES[role]?.label ?? role}" rolü bu alanda değişiklik yapamaz`;
};

/** Arayüz için: rolün yazabildiği alanlar */
export const writableAreas = (role) => (WRITE[role] === '*' ? ['*'] : WRITE[role] ?? []);
