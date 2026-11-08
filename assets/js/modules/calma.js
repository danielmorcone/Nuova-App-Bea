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
  const stopButton = document.querySelector('#stop-breathing');
  const infoButton = document.querySelector('#open-info');
  const infoDialog = document.querySelector('#calm-info');
  const guideSteps = [...document.querySelectorAll('.calm-guide__step')];

  if (!rings || !phaseLabel || !countLabel || !startButton) return;

  let isRunning = false;
  let phaseIndex = 0;
  let cyclesCompleted = 0;
  let secondsRemaining = phases[0].seconds;
  let timerId;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setTextImmediately(element, text) {
    element.getAnimations().forEach(animation => animation.cancel());
    element.textContent = text;
  }

  function animateTextLikeCountdown(element) {
    if (prefersReducedMotion) return;

    element.animate(
      [
        { opacity: 0.18, transform: 'scale(0.88)' },
        { opacity: 1, transform: 'scale(1)' }
      ],
      { duration: 680, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  }

  function showPhase(phase, seconds) {
    setTextImmediately(phaseLabel, phase.name);
    animateTextLikeCountdown(phaseLabel);
    setTextImmediately(countLabel, `${seconds} ${seconds === 1 ? 'secondo' : 'secondi'}`);
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
        if (phaseIndex === phases.length - 1) {
          cyclesCompleted += 1;
          if (cyclesCompleted === 4) {
            stopBreathing();
            return;
          }
        }

        phaseIndex = (phaseIndex + 1) % phases.length;
        runPhase();
        return;
      }

      setTextImmediately(countLabel, `${secondsRemaining} ${secondsRemaining === 1 ? 'secondo' : 'secondi'}`);
      timerId = window.setTimeout(countDown, 1000);
    }

    timerId = window.setTimeout(countDown, 1000);
  }

  function showCountdown(number) {
    rings.dataset.phase = 'countdown';
    setTextImmediately(phaseLabel, 'Preparati');
    setTextImmediately(countLabel, String(number));
    animateTextLikeCountdown(countLabel);
  }

  function beginBreathingCountdown() {
    let number = 3;
    showCountdown(number);

    function countIn() {
      number -= 1;

      if (number === 0) {
        runPhase();
        return;
      }

      showCountdown(number);
      timerId = window.setTimeout(countIn, 1000);
    }

    timerId = window.setTimeout(countIn, 1000);
  }

  function stopBreathing() {
    window.clearTimeout(timerId);
    isRunning = false;
    cyclesCompleted = 0;
    document.body.classList.remove('is-breathing');
    phaseIndex = 0;
    secondsRemaining = phases[0].seconds;
    rings.dataset.phase = 'idle';
    setTextImmediately(phaseLabel, phases[0].name);
    setTextImmediately(countLabel, `${secondsRemaining} secondi`);
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
    cyclesCompleted = 0;
    document.body.classList.add('is-breathing');
    startButton.setAttribute('aria-pressed', 'true');
    startButton.innerHTML = '<i class="bi bi-stop-fill" aria-hidden="true"></i><span>Ferma</span>';
    beginBreathingCountdown();
  });

  stopButton?.addEventListener('click', stopBreathing);

  if (infoButton && infoDialog) {
    const closeButton = infoDialog.querySelector('.calm-info__close');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const closeDuration = prefersReducedMotion ? 0 : 240;
    let isClosing = false;

    function closeInfo() {
      if (!infoDialog.open || isClosing) return;

      isClosing = true;
      infoDialog.classList.add('is-closing');
      window.setTimeout(() => infoDialog.close(), closeDuration);
    }

    infoButton.addEventListener('click', () => {
      if (infoDialog.open) return;

      infoButton.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.9)' },
          { transform: 'scale(1)' }
        ],
        { duration: prefersReducedMotion ? 1 : 220, easing: 'ease-out' }
      );

      infoDialog.classList.remove('is-closing');
      infoDialog.classList.add('is-opening');
      infoDialog.showModal();
      infoButton.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(() => infoDialog.classList.remove('is-opening'));
    });

    closeButton?.addEventListener('click', closeInfo);
    infoDialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeInfo();
    });
    infoDialog.addEventListener('click', event => {
      if (event.target === infoDialog) closeInfo();
    });
    infoDialog.addEventListener('close', () => {
      infoDialog.classList.remove('is-opening', 'is-closing');
      infoButton.setAttribute('aria-expanded', 'false');
      isClosing = false;
    });
  }
}
