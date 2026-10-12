// Tema tercihi (varsayılan AÇIK, yumuşak tema) — sayfa boyanmadan önce uygulanır
try {
  const t = localStorage.getItem('akort-theme-v2');
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
} catch {
  document.documentElement.setAttribute('data-theme', 'light');
}
