// Caricato soltanto dal server locale: non fa parte della build o della cache PWA.
(() => {
  let previous = null;
  let checking = false;
  const tabKey = 'app-bea-dev-active-tab';

  function restoreTab() {
    try {
      const tab = sessionStorage.getItem(tabKey);
      sessionStorage.removeItem(tabKey);
      if (['home', 'noi', 'umore'].includes(tab)) document.querySelector(`.btn-nav .${tab}`)?.click();
    } catch { /* Il live reload funziona anche se sessionStorage è bloccato. */ }
  }
  if (document.readyState === 'complete') restoreTab();
  else window.addEventListener('load', restoreTab, { once: true });

  async function checkChanges() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch('/__app-bea-changes__', { cache: 'no-store' });
      if (!response.ok) return;
      const current = await response.json();
      if (previous) {
        const changed = [...new Set([...Object.keys(previous), ...Object.keys(current)])]
          .filter(file => current[file] !== previous[file]);
        if (changed.length && changed.every(file => file.endsWith('.css'))) {
          // Sostituisci il CSS solo dopo il caricamento: niente flash, reload o perdita di bozze.
          for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
            const url = new URL(link.href);
            const file = decodeURIComponent(url.pathname.slice(1));
            if (url.origin !== location.origin || !changed.includes(file)) continue;
            const updated = link.cloneNode();
            url.searchParams.set('dev', current[file]);
            updated.href = url.href;
            updated.addEventListener('load', () => link.remove(), { once: true });
            updated.addEventListener('error', () => updated.remove(), { once: true });
            link.after(updated);
          }
        } else if (changed.length) {
          try { sessionStorage.setItem(tabKey, document.body.dataset.activeTab || 'home'); } catch { /* Facoltativo. */ }
          location.reload();
        }
      }
      previous = current;
    } catch { /* Offline o server spento: l'app continua a funzionare normalmente. */ }
    finally { checking = false; }
  }

  checkChanges();
  window.setInterval(checkChanges, 900);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkChanges(); });
})();
