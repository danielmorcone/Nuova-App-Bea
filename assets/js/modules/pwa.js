if ('serviceWorker' in navigator) {
  const serviceWorkerUrl = new URL('../../sw.js', import.meta.url);

  navigator.serviceWorker.register(serviceWorkerUrl).then(registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') window.location.reload();
      });
    });
  }).catch(error => {
    console.error('Impossibile registrare il service worker:', error);
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  deferredPrompt.prompt();
});
