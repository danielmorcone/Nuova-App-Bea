const steps = [
  {
    title: 'Guarda intorno a te',
    description: 'Prova a trovare tre cose che puoi vedere. possono essere qualsiasi cosa, anche le più piccole.',
    answerLabel: 'Scrivi tre cose che riesci a vedere'
  },
  {
    title: 'Usa i tuoi sensi',
    description: 'Riesci a percepire due cose attraverso il tatto? Magari i vestiti sulla pelle o qualcosa che stai tenendo in mano.',
    answerLabel: 'Scrivi due sensazioni tattili'
  },
  {
    title: 'Ascolta un momento',
    description: 'Cerca di individuare un suono intorno a te. non importa quanto sia lontano o silenzioso.',
    answerLabel: 'Scrivi un suono che riesci a sentire'
  }
];

export function setupGroundingExercise() {
  const screen = document.querySelector('.grounding-screen');
  const backButton = document.querySelector('.grounding-back');
  const form = document.querySelector('#grounding-form');
  const stepNumber = document.querySelector('#grounding-step-number');
  const stepTitle = document.querySelector('#grounding-step-title');
  const stepDescription = document.querySelector('#grounding-step-description');
  const answer = document.querySelector('#grounding-answer');
  const answerLabel = document.querySelector('#grounding-answer-label');
  const previousButton = document.querySelector('#grounding-previous');
  const confirmDialog = document.querySelector('#grounding-confirm');
  const confirmYesButton = document.querySelector('#grounding-confirm-yes');
  const confirmNoButton = document.querySelector('#grounding-confirm-no');
  const completionScreen = document.querySelector('#grounding-completion');
  const completionYesButton = document.querySelector('#grounding-completion-yes');
  const completionContinueButton = document.querySelector('#grounding-completion-continue');

  if (!screen || !form || !stepNumber || !stepTitle || !stepDescription || !answer || !answerLabel || !previousButton) return;

  const answers = ['', '', ''];
  let currentStep = 0;
  let isChangingStep = false;
  let isLeaving = false;
  let isClosingConfirmation = false;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderStep() {
    const step = steps[currentStep];
    stepNumber.textContent = String(currentStep + 1);
    stepTitle.textContent = step.title;
    stepDescription.textContent = step.description;
    answer.value = answers[currentStep];
    answerLabel.textContent = step.answerLabel;
    previousButton.hidden = currentStep === 0;
  }

  function changeStep(nextStep) {
    if (isChangingStep || nextStep < 0 || nextStep >= steps.length || nextStep === currentStep) return;
    isChangingStep = true;
    answer.blur();

    let finished = false;
    let fallbackTimer;
    const finishFade = event => {
      if (event && (event.target !== form || event.propertyName !== 'opacity')) return;
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      form.removeEventListener('transitionend', finishFade);
      currentStep = nextStep;
      renderStep();
      form.classList.remove('is-changing');
      isChangingStep = false;
    };

    form.addEventListener('transitionend', finishFade);
    form.classList.add('is-changing');
    fallbackTimer = window.setTimeout(() => finishFade(), 350);
  }

  function leaveExercise(destination = '../index.html') {
    if (isLeaving) return;
    isLeaving = true;

    let fallbackTimer;
    const goToDestination = () => window.location.assign(destination);
    const finishExit = event => {
      if (event && (event.target !== screen || event.propertyName !== 'opacity')) return;
      clearTimeout(fallbackTimer);
      screen.removeEventListener('transitionend', finishExit);
      goToDestination();
    };

    screen.addEventListener('transitionend', finishExit);
    document.body.classList.add('is-leaving');
    fallbackTimer = window.setTimeout(goToDestination, 800);
  }

  function showCompletionScreen() {
    if (!completionScreen) {
      leaveExercise();
      return;
    }

    screen.inert = true;
    completionScreen.inert = false;
    completionScreen.setAttribute('aria-hidden', 'false');
    completionScreen.classList.remove('is-closing');
    completionScreen.classList.add('is-visible');
    completionYesButton?.focus({ preventScroll: true });
  }

  function finishWithDestination(destination) {
    if (isLeaving) return;
    completionScreen?.setAttribute('aria-hidden', 'true');
    if (completionScreen) {
      completionScreen.inert = true;
      completionScreen.classList.add('is-closing');
      completionScreen.classList.remove('is-visible');
    }
    leaveExercise(destination);
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
      if (event && (event.target !== confirmDialog || event.animationName !== 'grounding-confirm-exit')) return;
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (isChangingStep || isLeaving) return;

    answers[currentStep] = answer.value.trim();
    if (currentStep < steps.length - 1) changeStep(currentStep + 1);
    else showCompletionScreen();
  });

  previousButton?.addEventListener('click', () => {
    if (isChangingStep || isLeaving) return;
    answers[currentStep] = answer.value.trim();
    changeStep(currentStep - 1);
  });

  backButton?.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!confirmDialog?.open) confirmDialog?.showModal();
  });

  confirmYesButton?.addEventListener('click', () => {
    closeConfirmation(leaveExercise);
  });
  confirmNoButton?.addEventListener('click', () => closeConfirmation());
  completionYesButton?.addEventListener('click', () => finishWithDestination('../index.html'));
  completionContinueButton?.addEventListener('click', () => finishWithDestination('calma.html'));
  confirmDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeConfirmation();
  });
  confirmDialog?.addEventListener('click', event => {
    if (event.target === confirmDialog) closeConfirmation();
  });

  renderStep();
}
