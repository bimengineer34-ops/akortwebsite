// Tema tercihi (varsayılan koyu) — sayfa boyanmadan önce uygulanır
try {
  const t = localStorage.getItem('akort-theme');
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
} catch {
  document.documentElement.setAttribute('data-theme', 'dark');
}
