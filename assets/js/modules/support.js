export function setupSupportButton() {
  const button = document.querySelector('.btn');
  if (!button) return;

  const transitionScreen = document.querySelector('#support-transition');
  let holdTimer;

  const openCalmScreen = () => {
    window.location.href = new URL('../../../pages/calma.html', import.meta.url).href;
  };

  const startHold = () => {
    clearTimeout(holdTimer);
    button.classList.add('pressing');
    holdTimer = window.setTimeout(() => {
      if (!transitionScreen) {
        openCalmScreen();
        return;
      }

      document.body.classList.add('is-transitioning');
      transitionScreen.setAttribute('aria-hidden', 'false');

      const firstMessage = transitionScreen.querySelector('.support-transition__content--first');
      const secondMessage = transitionScreen.querySelector('.support-transition__content--second');

      const showSecondMessage = () => {
        transitionScreen.classList.add('show-second');
        firstMessage?.setAttribute('aria-hidden', 'true');
        secondMessage?.setAttribute('aria-hidden', 'false');
      };

      window.setTimeout(() => {
        if (!firstMessage || !secondMessage) {
          showSecondMessage();
          return;
        }

        firstMessage.addEventListener('transitionend', event => {
          if (event.propertyName === 'opacity') showSecondMessage();
        }, { once: true });
        firstMessage.classList.add('is-hidden');

        // Fallback nel caso transitionend non venga emesso (per esempio con motion ridotto).
        window.setTimeout(showSecondMessage, 1800);
      }, 5200);

      window.setTimeout(() => document.body.classList.add('is-leaving'), 12000);
      window.setTimeout(openCalmScreen, 14500);
    }, 2000);
  };

  const cancelHold = () => {
    clearTimeout(holdTimer);
    button.classList.remove('pressing');
  };

  button.addEventListener('pointerdown', startHold);
  button.addEventListener('pointerup', cancelHold);
  button.addEventListener('pointerleave', cancelHold);
  button.addEventListener('pointercancel', cancelHold);
  button.addEventListener('contextmenu', event => event.preventDefault());
}
