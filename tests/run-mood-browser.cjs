// Server locale già avviato. Chrome usa un profilo temporaneo, senza dati personali.
// Esegui con: node tests/run-mood-browser.cjs
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, writeFile, unlink } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'app-bea-mood-'));
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await wait(100); }
    }
    if (!port) throw new Error('Chrome non ha aperto la porta di test');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:8000/tests/umore-browser.html' });
    let report = '';
    for (let i = 0; i < 180; i++) {
      await wait(250);
      const response = await send('Runtime.evaluate', { expression: 'document.querySelector("#result")?.textContent', returnByValue: true });
      report = response.result.value || '';
      if (report.includes('TUTTI I TEST SUPERATI') || report.includes('FAIL')) break;
    }
    console.log(report);
    if (!report.includes('TUTTI I TEST SUPERATI')) throw new Error('Test interfaccia non completati');
    // Prova il live CSS con un file temporaneo; i CSS personali non vengono modificati.
    const probeName = `.live-probe-${process.pid}.css`;
    const probePath = path.join(__dirname, '../assets/css', probeName);
    try {
      await writeFile(probePath, ':root { --live-reload-probe: prima; }');
      await send('Runtime.evaluate', { expression: `(() => {
        const f=document.querySelector('#app'); f.contentWindow.__liveReloadProbe=true;
        const link=f.contentDocument.createElement('link'); link.rel='stylesheet';
        link.href='/assets/css/${probeName}'; f.contentDocument.head.append(link);
      })()` });
      await wait(1500);
      await writeFile(probePath, ':root { --live-reload-probe: dopo; }');
      let applied = false;
      for (let i = 0; i < 30; i++) {
        await wait(150);
        const result = await send('Runtime.evaluate', { expression: `(() => {
          const f=document.querySelector('#app'); return f.contentWindow.__liveReloadProbe === true
            && f.contentWindow.getComputedStyle(f.contentDocument.documentElement).getPropertyValue('--live-reload-probe').trim()==='dopo';
        })()`, returnByValue: true });
        if (result.result.value) { applied = true; break; }
      }
      if (!applied) throw new Error('Live CSS non aggiornato oppure pagina ricaricata');
      console.log('PASS Modifica CSS applicata automaticamente senza ricaricare la pagina');
    } finally {
      await send('Runtime.evaluate', { expression: `document.querySelector('#app').contentDocument.querySelectorAll('link[href*="${probeName}"]').forEach(link=>link.remove())` });
      await unlink(probePath).catch(() => {});
    }
    await send('Network.enable');
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await send('Runtime.evaluate', { expression: 'document.querySelector("#app").contentWindow.location.reload()' });
    let offlineReady = false;
    for (let i = 0; i < 80; i++) {
      await wait(100);
      const state = await send('Runtime.evaluate', {
        expression: 'Boolean(document.querySelector("#app").contentDocument?.querySelector("#mood-days button"))', returnByValue: true
      });
      if (state.result.value) { offlineReady = true; break; }
    }
    if (!offlineReady) throw new Error('Ricaricamento offline non riuscito');
    const offlineState = await send('Runtime.evaluate', {
      expression: `(() => { const d=document.querySelector('#app').contentDocument; d.querySelector('.umore').click(); return Boolean(d.querySelector('.mood-saved-note')?.textContent.includes('Una nota di prova')); })()`, returnByValue: true
    });
    if (!offlineState.result.value) throw new Error('Diario non disponibile offline');
    console.log('PASS Ricaricamento reale offline e persistenza del diario');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const motion = await send('Runtime.evaluate', {
      expression: `(() => { const f=document.querySelector('#app'); return f.contentWindow.getComputedStyle(f.contentDocument.querySelector('#mood-panel')).animationName; })()`, returnByValue: true
    });
    if (motion.result.value !== 'none') throw new Error('Movimento ridotto non rispettato');
    console.log('PASS prefers-reduced-motion');
    await send('Runtime.evaluate', {
      expression: `(() => { const d=document.querySelector('#app').contentDocument; [...d.querySelectorAll('.mood-day')].find(b=>!b.disabled && !b.classList.contains('is-selected')).click(); d.querySelector('#umore-screen').scrollTop=0; })()`
    });
    await wait(600);
    console.log('Eccezioni runtime:', JSON.stringify(errors));
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 393, height: 852, scale: 1 } });
    const screenshotPath = path.join(tmpdir(), 'app-bea-umore-test.png');
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot:', screenshotPath);
    // Smoke test degli esercizi già esistenti, ancora offline e senza modificarli.
    async function exercise(pathname, selector) {
      await send('Runtime.evaluate', { expression: `document.querySelector('#app').src=${JSON.stringify('../pages/' + pathname)}` });
      for (let i = 0; i < 100; i++) {
        await wait(100);
        const state = await send('Runtime.evaluate', {
          expression: `Boolean(document.querySelector('#app').contentDocument?.querySelector(${JSON.stringify(selector)}))`, returnByValue: true
        });
        if (state.result.value) { await wait(300); return; }
      }
      throw new Error('Esercizio non caricato: ' + pathname);
    }
    await exercise('calma.html', '#start-breathing');
    let smoke = await send('Runtime.evaluate', {
      expression: `(() => { const d=document.querySelector('#app').contentDocument; d.querySelector('#start-breathing').click(); const started=d.body.classList.contains('is-breathing'); d.querySelector('#stop-breathing').click(); return started && d.querySelector('#confirm-stop-dialog').open; })()`, returnByValue: true
    });
    if (!smoke.result.value) throw new Error('Avvio/conferma Respiro');
    console.log('PASS Respiro: avvio e conferma interruzione offline');
    await exercise('radicamento.html', '#grounding-form');
    await send('Runtime.evaluate', { expression: `(() => { const d=document.querySelector('#app').contentDocument; d.querySelector('#grounding-answer').value='Risposta di prova'; d.querySelector('#grounding-next').click(); })()` });
    await wait(900);
    smoke = await send('Runtime.evaluate', {
      expression: `document.querySelector('#app').contentDocument.querySelector('#grounding-step-number').textContent`, returnByValue: true
    });
    if (smoke.result.value !== '2') throw new Error('Navigazione Radicamento');
    console.log('PASS Radicamento: passaggio al secondo step offline');
    await exercise('bolle.html', '#bubble-play-area');
    await wait(6500);
    smoke = await send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#app').contentDocument.querySelector('.bubble'))`, returnByValue: true
    });
    if (!smoke.result.value) throw new Error('Avvio Bolle');
    console.log('PASS Bolle: introduzione e generazione bolle offline');
    if (!report.includes('TUTTI I TEST SUPERATI') || errors.length) process.exitCode = 1;
    await send('Browser.close');
  } finally {
    socket?.close();
    chrome.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
