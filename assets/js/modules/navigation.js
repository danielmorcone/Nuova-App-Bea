import { playEffect } from './music.js';

export function setupNavigation() {
  const selector = document.querySelector('.selettore');
  const tabs = ['.noi', '.home', '.umore']
    .map(query => document.querySelector(query))
    .filter(Boolean);
  const screens = {
    noi: document.querySelector('#noi-screen'),
    home: document.querySelector('#home-screen'),
    umore: document.querySelector('#umore-screen')
  };

  if (!selector || tabs.length === 0) return;
  let selectorResetTimer;
  let screenTransitionTimer;

  function selectTab(selectedTab, direction = 0) {
    const selectedName = selectedTab.classList.contains('noi')
      ? 'noi'
      : selectedTab.classList.contains('umore') ? 'umore' : 'home';

    const slideDirection = direction || 1;
    if (document.body.dataset.activeTab) {
      document.body.classList.add('is-tab-changing');
      window.clearTimeout(screenTransitionTimer);
      screenTransitionTimer = window.setTimeout(() => {
        document.body.classList.remove('is-tab-changing');
      }, 500);
    }

    document.body.dataset.activeTab = selectedName;
    document.body.style.setProperty('--tab-entry-shift', `${slideDirection * 24}px`);
    document.body.style.setProperty('--tab-exit-shift', `${slideDirection * -24}px`);

    tabs.forEach(tab => tab.classList.toggle('active', tab === selectedTab));
    tabs.forEach(tab => {
      const isSelected = tab === selectedTab;
      tab.setAttribute('aria-pressed', String(isSelected));
    });

    Object.entries(screens).forEach(([name, screen]) => {
      if (!screen) return;
      const isActive = name === selectedName;
      screen.classList.toggle('is-active', isActive);
      screen.setAttribute('aria-hidden', String(!isActive));
      screen.inert = !isActive;
    });

    const center = selectedTab.offsetLeft + selectedTab.offsetWidth / 2;
    const selectorCenter = selector.offsetWidth / 2;
    const position = center - selectorCenter;

    window.clearTimeout(selectorResetTimer);
    selector.style.transform = `translateX(${position}px) scaleX(0.78) scaleY(0.68)`;
    selectorResetTimer = window.setTimeout(() => {
      selector.style.transform = `translateX(${position}px) scaleX(1) scaleY(1)`;
    }, 100);
  }

  tabs.forEach((tab, index) => {
    const chooseTab = () => {
      const currentIndex = tabs.findIndex(item => item.classList.contains('active'));
      if (currentIndex === index) return;
      selectTab(tab, Math.sign(index - currentIndex));
      playEffect('swipe', { fadeOutSeconds: 0.18, volume: 0.3 });
    };

    tab.addEventListener('click', chooseTab);
    tab.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        chooseTab();
      }
    });
  });

  let touchStart = null;
  let suppressClickUntil = 0;
  document.addEventListener('pointerdown', event => {
    touchStart = null;
    if (!event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    if (event.target.closest('.nav, .music-toggle, a, input, textarea, select, dialog, .btncontainer')) return;
    // I giorni e le frecce del calendario restano toccabili, ma consentono anche lo swipe.
    if (event.target.closest('button') && !event.target.closest('.mood-calendar')) return;
    if (document.body.classList.contains('is-transitioning')) return;

    touchStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }, { passive: true });

  document.addEventListener('pointermove', event => {
    if (!touchStart || event.pointerId !== touchStart.pointerId) return;
    const deltaX = Math.abs(event.clientX - touchStart.x);
    const deltaY = Math.abs(event.clientY - touchStart.y);
    // Una volta iniziato lo scroll verticale, quel gesto non cambia più scheda.
    if (deltaY > 12 && deltaY > deltaX) touchStart = null;
  }, { passive: true });

  document.addEventListener('pointerup', event => {
    if (!touchStart || event.pointerId !== touchStart.pointerId) return;

    const deltaX = event.clientX - touchStart.x;
    const deltaY = event.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;

    // Il rilascio dopo uno swipe non deve attivare anche il giorno o la freccia sottostante.
    suppressClickUntil = performance.now() + 400;

    const currentIndex = tabs.findIndex(tab => tab.classList.contains('active'));
    const nextIndex = Math.max(0, Math.min(tabs.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)));
    if (nextIndex !== currentIndex) {
      selectTab(tabs[nextIndex], Math.sign(nextIndex - currentIndex));
      playEffect('swipe', { fadeOutSeconds: 0.18, volume: 0.3 });
    }
  }, { passive: true });

  document.addEventListener('click', event => {
    if (event.detail === 0 || performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClickUntil = 0;
  }, { capture: true });

  document.addEventListener('pointercancel', () => { touchStart = null; }, { passive: true });

  const homeTab = document.querySelector('.home');
  if (homeTab) selectTab(homeTab);
}
