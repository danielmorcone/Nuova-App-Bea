export function setupSupportButton() {
  const button = document.querySelector('.btn');
  if (!button) return;

  let holdTimer;

  const startHold = () => {
    clearTimeout(holdTimer);
    button.classList.add('pressing');
    holdTimer = window.setTimeout(() => {
      window.location.href = new URL('../../pages/calma.html', import.meta.url).href;
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
