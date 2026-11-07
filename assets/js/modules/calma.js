const phases = [
  { name: 'Inspira', seconds: 4, key: 'inhale', icon: 'bi-chevron-up' },
  { name: 'Trattieni', seconds: 2, key: 'hold', icon: 'bi-pause' },
  { name: 'Espira', seconds: 6, key: 'exhale', icon: 'bi-chevron-down' }
];

export function setupBreathingGuide() {
  const rings = document.querySelector('#breath-rings');
  const phaseLabel = document.querySelector('#breath-phase');
  const countLabel = document.querySelector('#breath-count');
  const startButton = document.querySelector('#start-breathing');
  const infoButton = document.querySelector('#open-info');
  const infoDialog = document.querySelector('#calm-info');
  const guideSteps = [...document.querySelectorAll('.calm-guide__step')];

  if (!rings || !phaseLabel || !countLabel || !startButton) return;

  let isRunning = false;
  let phaseIndex = 0;
  let secondsRemaining = phases[0].seconds;
  let timerId;

  function showPhase(phase, seconds) {
    phaseLabel.textContent = phase.name;
    countLabel.textContent = `${seconds} ${seconds === 1 ? 'secondo' : 'secondi'}`;
    rings.dataset.phase = phase.key;
    updateGuide(phaseIndex);
  }

  function updateGuide(activeIndex) {
    guideSteps.forEach((step, index) => {
      const state = index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming';
      const icon = index < activeIndex ? 'bi-check-lg' : step.dataset.icon;

      step.dataset.state = state;
      step.querySelector('.calm-guide__icon').innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

      if (state === 'active') step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  }

  function resetGuide() {
    guideSteps.forEach(step => {
      step.dataset.state = 'idle';
      step.querySelector('.calm-guide__icon').innerHTML = `<i class="bi ${step.dataset.icon}" aria-hidden="true"></i>`;
      step.removeAttribute('aria-current');
    });
  }

  function runPhase() {
    const phase = phases[phaseIndex];
    secondsRemaining = phase.seconds;
    showPhase(phase, secondsRemaining);

    function countDown() {
      secondsRemaining -= 1;

      if (secondsRemaining === 0) {
        phaseIndex = (phaseIndex + 1) % phases.length;
        runPhase();
        return;
      }

      countLabel.textContent = `${secondsRemaining} ${secondsRemaining === 1 ? 'secondo' : 'secondi'}`;
      timerId = window.setTimeout(countDown, 1000);
    }

    timerId = window.setTimeout(countDown, 1000);
  }

  function stopBreathing() {
    window.clearTimeout(timerId);
    isRunning = false;
    document.body.classList.remove('is-breathing');
    phaseIndex = 0;
    secondsRemaining = phases[0].seconds;
    rings.dataset.phase = 'idle';
    phaseLabel.textContent = phases[0].name;
    countLabel.textContent = `${secondsRemaining} secondi`;
    resetGuide();
    startButton.setAttribute('aria-pressed', 'false');
    startButton.innerHTML = '<i class="bi bi-play-fill" aria-hidden="true"></i><span>Inizia</span>';
  }

  startButton.addEventListener('click', () => {
    if (isRunning) {
      stopBreathing();
      return;
    }

    isRunning = true;
    phaseIndex = 0;
    document.body.classList.add('is-breathing');
    startButton.setAttribute('aria-pressed', 'true');
    startButton.innerHTML = '<i class="bi bi-stop-fill" aria-hidden="true"></i><span>Ferma</span>';
    runPhase();
  });

  if (infoButton && infoDialog) {
    infoButton.addEventListener('click', () => infoDialog.showModal());
    infoDialog.addEventListener('close', () => infoButton.setAttribute('aria-expanded', 'false'));
    infoButton.addEventListener('click', () => infoButton.setAttribute('aria-expanded', 'true'));
  }
}
