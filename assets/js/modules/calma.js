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
  const confirmDialog = document.querySelector('#confirm-stop-dialog');
  const confirmYesButton = document.querySelector('#confirm-stop-yes');
  const confirmNoButton = document.querySelector('#confirm-stop-no');
  const completionScreen = document.querySelector('#breath-completion');
  const completionYesButton = document.querySelector('#completion-yes');
  const completionContinueButton = document.querySelector('#completion-continue');
  const guideSteps = [...document.querySelectorAll('.calm-guide__step')];

  if (!rings || !phaseLabel || !countLabel || !startButton) return;

  let isRunning = false;
  let phaseIndex = 0;
  let cyclesCompleted = 0;
  let secondsRemaining = phases[0].seconds;
  let timerId = null;
  let timerDeadline = 0;
  let pendingTimerCallback = null;
  let pausedTimerDelay = null;
  let isPausedForConfirmation = false;
  let pausedExerciseAnimations = [];
  let isClosingConfirmation = false;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const backLink = document.querySelector('.calm-back');
  const calmScreen = document.querySelector('.calm-screen');
  let isNavigatingHome = false;
  let pendingHomeNavigation = false;

  function navigateHomeWithFade() {
    if (isNavigatingHome) return;
    isNavigatingHome = true;

    const goHome = () => window.location.assign(backLink.href);
    if (!calmScreen) {
      goHome();
      return;
    }

    let fallbackTimer;
    const finishExit = transitionEvent => {
      if (transitionEvent.target !== calmScreen || transitionEvent.propertyName !== 'opacity') return;
      clearTimeout(fallbackTimer);
      calmScreen.removeEventListener('transitionend', finishExit);
      goHome();
    };

    calmScreen.addEventListener('transitionend', finishExit);
    document.body.classList.add('is-leaving-home');
    fallbackTimer = window.setTimeout(goHome, 1600);
  }

  backLink?.addEventListener('click', event => {
    // Mantiene il comportamento normale per apertura in una nuova scheda.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (isNavigatingHome) return;
    pendingHomeNavigation = true;

    if (isRunning) askToStopBreathing();
    else confirmDialog?.showModal();
  });

  function scheduleTimer(callback, delay = 1000) {
    window.clearTimeout(timerId);
    pendingTimerCallback = callback;
    pausedTimerDelay = null;
    timerDeadline = Date.now() + delay;
    timerId = window.setTimeout(() => {
      timerId = null;
      timerDeadline = 0;
      pendingTimerCallback = null;
      callback();
    }, delay);
  }

  function pauseBreathingTimer() {
    if (timerId === null) return;
    pausedTimerDelay = Math.max(0, timerDeadline - Date.now());
    window.clearTimeout(timerId);
    timerId = null;
  }

  function resumeBreathingTimer() {
    if (!pendingTimerCallback) return;
    scheduleTimer(pendingTimerCallback, pausedTimerDelay ?? 1000);
  }

  function pauseExerciseAnimations() {
    pausedExerciseAnimations = [...document.querySelectorAll('.calm-screen, .calm-screen *')]
      .flatMap(element => element.getAnimations())
      .filter(animation => animation.playState === 'running');
    pausedExerciseAnimations.forEach(animation => animation.pause());
  }

  function resumeExerciseAnimations() {
    pausedExerciseAnimations.forEach(animation => {
      if (animation.playState === 'paused') animation.play();
    });
    pausedExerciseAnimations = [];
  }

  function discardPausedExerciseAnimations() {
    pausedExerciseAnimations.forEach(animation => animation.cancel());
    pausedExerciseAnimations = [];
  }

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
            showCompletionScreen();
            return;
          }
        }

        phaseIndex = (phaseIndex + 1) % phases.length;
        runPhase();
        return;
      }

      setTextImmediately(countLabel, `${secondsRemaining} ${secondsRemaining === 1 ? 'secondo' : 'secondi'}`);
      scheduleTimer(countDown);
    }

    scheduleTimer(countDown);
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
      scheduleTimer(countIn);
    }

    scheduleTimer(countIn);
  }

  function stopBreathing() {
    window.clearTimeout(timerId);
    discardPausedExerciseAnimations();
    timerId = null;
    timerDeadline = 0;
    pendingTimerCallback = null;
    pausedTimerDelay = null;
    isPausedForConfirmation = false;
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
    infoButton?.setAttribute('aria-label', 'Come funziona la respirazione');
  }

  function showCompletionScreen() {
    if (!completionScreen) return;
    if (calmScreen) calmScreen.inert = true;
    completionScreen.inert = false;
    completionScreen.setAttribute('aria-hidden', 'false');
    completionScreen.classList.add('is-visible');
    completionYesButton?.focus({ preventScroll: true });
  }

  function hideCompletionScreen(afterClose = () => {}) {
    if (!completionScreen) {
      afterClose();
      return;
    }

    let finished = false;
    let fallbackTimer;
    const finish = event => {
      if (event && (event.target !== completionScreen || event.propertyName !== 'opacity')) return;
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      completionScreen.removeEventListener('transitionend', finish);
      completionScreen.setAttribute('aria-hidden', 'true');
      if (calmScreen) calmScreen.inert = false;
      afterClose();
    };

    completionScreen.addEventListener('transitionend', finish);
    completionScreen.inert = true;
    completionScreen.classList.remove('is-visible');
    fallbackTimer = window.setTimeout(() => finish(), 700);
  }

  function askToStopBreathing() {
    if (!isRunning || isPausedForConfirmation || !confirmDialog) return;

    pendingHomeNavigation = true;
    pauseBreathingTimer();
    pauseExerciseAnimations();
    isPausedForConfirmation = true;
    confirmDialog.showModal();
  }

  function closeConfirmation(afterClose = () => {}) {
    if (!confirmDialog?.open) {
      afterClose();
      return;
    }

    if (isClosingConfirmation) return;
    if (prefersReducedMotion) {
      confirmDialog.close();
      afterClose();
      return;
    }

    isClosingConfirmation = true;
    let fallbackTimer;
    const finishClose = event => {
      if (event && (event.target !== confirmDialog || event.animationName !== 'calm-confirm-exit')) return;
      clearTimeout(fallbackTimer);
      confirmDialog.removeEventListener('animationend', finishClose);
      confirmDialog.close();
      confirmDialog.classList.remove('is-closing');
      isClosingConfirmation = false;
      afterClose();
    };

    confirmDialog.addEventListener('animationend', finishClose);
    confirmDialog.classList.add('is-closing');
    fallbackTimer = window.setTimeout(() => finishClose(), 320);
  }

  function resumeAfterConfirmation() {
    pendingHomeNavigation = false;
    const wasPaused = isPausedForConfirmation;
    closeConfirmation(() => {
      if (!wasPaused) return;
      isPausedForConfirmation = false;
      resumeExerciseAnimations();
      resumeBreathingTimer();
    });
  }

  function confirmStopBreathing() {
    const shouldGoHome = pendingHomeNavigation;
    pendingHomeNavigation = false;
    closeConfirmation(() => {
      stopBreathing();
      if (shouldGoHome) navigateHomeWithFade();
    });
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
    infoButton?.setAttribute('aria-label', 'Chiedi conferma per fermare la respirazione');
    beginBreathingCountdown();
  });

  stopButton?.addEventListener('click', askToStopBreathing);

  confirmYesButton?.addEventListener('click', confirmStopBreathing);
  confirmNoButton?.addEventListener('click', resumeAfterConfirmation);
  confirmDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    resumeAfterConfirmation();
  });
  confirmDialog?.addEventListener('click', event => {
    if (event.target === confirmDialog) resumeAfterConfirmation();
  });

  completionYesButton?.addEventListener('click', () => {
    hideCompletionScreen();
    navigateHomeWithFade();
  });
  completionContinueButton?.addEventListener('click', () => {
    hideCompletionScreen(() => {
      window.location.assign(new URL('../../../pages/radicamento.html', import.meta.url).href);
    });
  });

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
      if (isRunning) {
        askToStopBreathing();
        return;
      }

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
