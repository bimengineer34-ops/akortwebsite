// API istemcisi — CSRF belirteci, JSON hata çözümleme
export const session = { user: null, csrf: '', setupRequired: false, loginHint: '' };

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const request = async (method, url, body, extra = {}) => {
  const headers = { Accept: 'application/json', ...extra.headers };
  if (method !== 'GET') headers['X-CSRF-Token'] = session.csrf;
  let payload;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  } else payload = body;
  const res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  let data = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !url.includes('/giris') && !url.includes('/durum')) {
      session.user = null;
      window.dispatchEvent(new CustomEvent('akort:logout'));
    }
    throw new ApiError(res.status, data?.error ?? `İstek başarısız (${res.status})`, data);
  }
  return data;
};

const A = '/api/admin';
export const api = {
  get: (p) => request('GET', A + p),
  post: (p, b) => request('POST', A + p, b ?? {}),
  put: (p, b) => request('PUT', A + p, b),
  patch: (p, b) => request('PATCH', A + p, b),
  del: (p) => request('DELETE', A + p),
  upload: (name, file) => request('POST', `${A}/medya?ad=${encodeURIComponent(name)}`, file, { headers: { 'Content-Type': 'application/octet-stream' } }),
  status: async () => {
    const d = await request('GET', A + '/durum');
    session.user = d.user;
    session.csrf = d.user?.csrf ?? '';
    session.setupRequired = d.setupRequired;
    session.loginHint = d.loginHint ?? '';
    return d;
  },
  login: async (email, password, remember = false) => {
    const d = await request('POST', A + '/giris', { email, password, remember });
    return d;
  },
  forgot: (email) => request('POST', A + '/parola-unuttum', { email }),
  resetPassword: (token, password) => request('POST', A + '/parola-sifirla', { token, password }),
  login2fa: (ticket, code, remember = false) => request('POST', A + '/giris/2fa', { ticket, code, remember }),
  setup: (b) => request('POST', A + '/kurulum', b),
  logout: () => request('POST', A + '/cikis', {}),
};
