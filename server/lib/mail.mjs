// Bağımlılıksız SMTP istemcisi (örtük TLS 465 veya STARTTLS 587) + yeni form talebi bildirimi
// Ayarlar ortam değişkenleriyle verilir (parola veritabanına yazılmaz): SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';
import { getSetting, setSetting, audit } from './db.mjs';
import { validateEmail } from './auth.mjs';
import { HttpError } from './http.mjs';

const env = () => ({
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
});

export const smtpStatus = () => {
  const c = env();
  return { configured: !!(c.host && c.from), host: c.host, port: c.port, secure: c.secure, user: c.user, from: c.from };
};

export const getRecipients = () => getSetting('notify_emails', '').split(',').map((s) => s.trim()).filter(Boolean);
export const setRecipients = (list, user) => {
  const emails = [...new Set(String(list).split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  for (const e of emails) if (!validateEmail(e)) throw new HttpError(400, `Geçersiz e-posta: ${e}`);
  if (emails.length > 10) throw new HttpError(400, 'En fazla 10 alıcı');
  setSetting('notify_emails', emails.join(','));
  audit(user, 'ayar.bildirim_alicilari', emails.join(', '));
};

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/** SMTP yanıtı okuyucu: çok satırlı yanıtları (250-…) birleştirir */
const createReader = (socket) => {
  let buf = '';
  const waiters = [];
  const flush = () => {
    for (;;) {
      const lines = buf.split('\r\n');
      let end = -1;
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i])) { end = i; break; }
      if (end < 0 || !waiters.length) return;
      const reply = lines.slice(0, end + 1).join('\n');
      buf = lines.slice(end + 1).join('\r\n');
      waiters.shift().resolve(reply);
    }
  };
  socket.on('data', (d) => { buf += d.toString('utf8'); flush(); });
  socket.on('error', (e) => waiters.splice(0).forEach((w) => w.reject(e)));
  socket.on('close', () => waiters.splice(0).forEach((w) => w.reject(new Error('Bağlantı kapandı'))));
  return {
    next: () => new Promise((resolve, reject) => { waiters.push({ resolve, reject }); flush(); }),
    rebind: (s) => { s.on('data', (d) => { buf += d.toString('utf8'); flush(); }); s.on('error', (e) => waiters.splice(0).forEach((w) => w.reject(e))); },
  };
};

export const sendMail = async ({ to, subject, text }) => {
  const c = env();
  if (!c.host || !c.from) throw new HttpError(400, 'SMTP ayarlı değil (SMTP_HOST ve SMTP_FROM ortam değişkenleri gerekli)');
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) throw new HttpError(400, 'Alıcı yok');
  const fromAddr = (c.from.match(/<([^>]+)>/)?.[1] ?? c.from).trim();

  let socket = await new Promise((resolve, reject) => {
    const s = c.secure ? tls.connect({ host: c.host, port: c.port, servername: c.host }, () => resolve(s)) : net.connect({ host: c.host, port: c.port }, () => resolve(s));
    s.setTimeout(20000, () => { s.destroy(); reject(new Error('SMTP zaman aşımı')); });
    s.on('error', reject);
  });
  let rd = createReader(socket);
  const send = async (line, expect) => {
    socket.write(line + '\r\n');
    const r = await rd.next();
    if (expect && !String(r).startsWith(String(expect))) throw new Error(`SMTP hata (${line.split(' ')[0]}): ${String(r).slice(0, 160)}`);
    return r;
  };
  try {
    const greet = await rd.next();
    if (!greet.startsWith('220')) throw new Error(`SMTP karşılama hatası: ${greet.slice(0, 120)}`);
    let ehlo = await send(`EHLO ${os.hostname().replace(/[^a-z0-9.-]/gi, '') || 'localhost'}`, '250');
    if (!c.secure && /STARTTLS/i.test(ehlo)) {
      await send('STARTTLS', '220');
      socket = tls.connect({ socket, servername: c.host });
      await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      rd = createReader(socket);
      ehlo = await send(`EHLO ${os.hostname().replace(/[^a-z0-9.-]/gi, '') || 'localhost'}`, '250');
    }
    if (c.user) {
      await send(`AUTH PLAIN ${b64(`\0${c.user}\0${c.pass}`)}`, '235');
    }
    await send(`MAIL FROM:<${fromAddr}>`, '250');
    for (const r of recipients) await send(`RCPT TO:<${r}>`, '25');
    await send('DATA', '354');
    const headers = [
      `From: ${c.from}`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${encHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ].join('\r\n');
    const body = b64(text).replace(/(.{76})/g, '$1\r\n');
    await send(`${headers}\r\n\r\n${body}\r\n.`, '250');
    await send('QUIT');
  } finally {
    socket.destroy();
  }
};

/** Yeni form talebinde panel alıcılarına bildirim gönderir (hata verirse yalnızca günlüğe yazar; form kaydı etkilenmez). */
export const notifyNewForm = async (form) => {
  const to = getRecipients();
  if (!to.length || !smtpStatus().configured) return;
  const text = [
    'AKORT web sitesinden yeni bir hizmet talebi geldi.',
    '',
    `Ad Soyad : ${form.name}`,
    `E-posta  : ${form.email}`,
    `Telefon  : ${form.phone || '—'}`,
    `Şirket   : ${form.company || '—'}`,
    `Konu     : ${form.subject || '—'}`,
    '',
    'Mesaj:',
    form.message,
    '',
    'Talebi yönetim panelinden takip edebilirsiniz: /yonetim/#/formlar',
  ].join('\n');
  try {
    await sendMail({ to, subject: `Yeni talep: ${form.name}${form.subject ? ' — ' + form.subject : ''}`, text });
  } catch (e) {
    audit(null, 'eposta.bildirim_hata', form.email, String(e.message).slice(0, 200));
  }
};
