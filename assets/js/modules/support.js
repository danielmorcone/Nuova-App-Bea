import { fadeOutMusic, playEffect } from './music.js';

export function setupSupportButton() {
  const button = document.querySelector('.btn');
  if (!button) return;

  const transitionScreen = document.querySelector('#support-transition');
  let holdTimer;
  let holdSound;
  let cancelMusicFade;
  let transitionStarted = false;

  const openCalmScreen = () => {
    window.location.href = new URL('../../../pages/calma.html', import.meta.url).href;
  };

  const afterOpacityTransition = (element, callback, fallbackDelay = 1800) => {
    if (!element) {
      callback();
      return;
    }

    let completed = false;
    const finish = event => {
      if (event && (event.target !== element || event.propertyName !== 'opacity')) return;
      if (completed) return;
      completed = true;
      clearTimeout(fallbackTimer);
      element.removeEventListener('transitionend', finish);
      callback();
    };

    const fallbackTimer = window.setTimeout(() => finish(), fallbackDelay);
    element.addEventListener('transitionend', finish);
  };

  const startHold = () => {
    clearTimeout(holdTimer);
    cancelMusicFade?.();
    transitionStarted = false;
    cancelMusicFade = fadeOutMusic(8.7);
    holdSound?.stop();
    holdSound = playEffect('longpress', { loop: true, fadeOutSeconds: 0.4 });
    button.classList.add('pressing');
    holdTimer = window.setTimeout(() => {
      transitionStarted = true;
      cancelMusicFade = null;
      if (!transitionScreen) {
        openCalmScreen();
        return;
      }

      document.body.classList.add('is-transitioning');
      transitionScreen.setAttribute('aria-hidden', 'false');

      const firstMessage = transitionScreen.querySelector('.support-transition__content--first');
      const secondMessage = transitionScreen.querySelector('.support-transition__content--second');

      const showSecondMessage = () => {
        firstMessage?.setAttribute('aria-hidden', 'true');
        secondMessage?.setAttribute('aria-hidden', 'false');

        afterOpacityTransition(secondMessage, () => {
          // Dopo la breve permanenza, dissolve la frase e cambia pagina appena finita la dissolvenza.
          window.setTimeout(() => {
            afterOpacityTransition(secondMessage, openCalmScreen, 1600);
            secondMessage?.classList.add('is-fading-out');
          }, 650);
        });

        transitionScreen.classList.add('show-second');
      };

      window.setTimeout(() => {
        if (!firstMessage || !secondMessage) {
          showSecondMessage();
          return;
        }

        afterOpacityTransition(firstMessage, showSecondMessage);
        firstMessage.classList.add('is-hidden');
      }, 2500);
    }, 2000);
  };

  const cancelHold = () => {
    clearTimeout(holdTimer);
    button.classList.remove('pressing');
    if (!transitionStarted) {
      cancelMusicFade?.();
      cancelMusicFade = null;
    }
    holdSound?.stop();
    holdSound = null;
  };

  button.addEventListener('pointerdown', startHold);
  button.addEventListener('pointerup', cancelHold);
  button.addEventListener('pointerleave', cancelHold);
  button.addEventListener('pointercancel', cancelHold);
  button.addEventListener('contextmenu', event => event.preventDefault());
}
