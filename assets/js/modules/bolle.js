import { playEffect } from './music.js';

// Quando saranno disponibili, aggiungi i file in assets/sounds/ e inserisci
// i rispettivi nomi senza estensione qui. Per ora non vengono usati suoni casuali.
const BUBBLE_SOUND_NAMES = {
  small: null, // assets/sounds/bubble-pop-small.mp3
  medium: null, // assets/sounds/bubble-pop-medium.mp3
  large: null, // assets/sounds/bubble-pop-large.mp3
  golden: null // assets/sounds/bubble-pop-golden.mp3
};

const GOLDEN_CHANCE = 0.018;
const SPAWN_DELAY_MIN = 0.18;
const SPAWN_DELAY_MAX = 0.82;
const POP_SPAWN_DELAY_MIN = 0.12;
const POP_SPAWN_DELAY_MAX = 0.72;
const POP_LOCK_MS = 260;
const GOLDEN_POP_LOCK_MS = 560;
const BUBBLE_GAP = 12;
const SPAWN_POSITION_ATTEMPTS = 12;
const EXIT_AFTER_SECONDS = 15;

export function setupBubbleGame() {
  const screen = document.querySelector('#bubbles-screen');
  const stage = document.querySelector('#bubble-play-area');
  const exitButton = document.querySelector('#bubble-exit');
  const confirmDialog = document.querySelector('#bubble-confirm');
  const continueButton = document.querySelector('#bubble-confirm-continue');
  const confirmExitButton = document.querySelector('#bubble-confirm-exit');
  const completionScreen = document.querySelector('#bubble-completion');
  const completionYesButton = document.querySelector('#bubble-completion-yes');
  const completionContinueButton = document.querySelector('#bubble-completion-continue');
  const nextExerciseDialog = document.querySelector('#bubble-next-exercise-confirm');
  const nextExerciseYesButton = document.querySelector('#bubble-next-exercise-yes');
  const nextExerciseNoButton = document.querySelector('#bubble-next-exercise-no');
  const sealVideoScreen = document.querySelector('#seal-video');
  const sealVideo = document.querySelector('#seal-video-player');
  const sealVideoHomeButton = document.querySelector('#seal-video-home');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!screen || !stage || !exitButton || !confirmDialog || !completionScreen) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const listeners = new AbortController();
  const bubbles = [];
  const timers = new Set();
  let resizeObserver = null;
  let animationFrame = 0;
  let lastFrameTime = null;
  let elapsedGameTime = 0;
  let spawnTime = 0;
  let spawnDelay = 0.6;
  let isRunning = false;
  let isPausedForConfirm = false;
  let isEnding = false;
  let isClosingConfirm = false;
  let isClosingNextExerciseDialog = false;
  let goldenInScene = false;
  let nextPopAllowedAt = 0;
  let activeSparkleCount = 0;
  let confirmCloseTimer = null;
  let nextExerciseCloseTimer = null;
  let sealVideoBlackoutTimer = null;
  let sealAudioContext = null;
  let sealVideoSource = null;
  let sealVideoGain = null;
  let lastSealVideoTime = 0;
  let hasSealVideoLooped = false;
  let areaWidth = 0;
  let areaHeight = 0;
  let desiredBubbleCount = 15;

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function loadAreaSize() {
    areaWidth = stage.clientWidth;
    areaHeight = stage.clientHeight;
    desiredBubbleCount = Math.min(24, Math.max(12, Math.round(areaWidth / 26)));

    bubbles.forEach(bubble => {
      bubble.x = Math.min(Math.max(bubble.radius, bubble.x), Math.max(bubble.radius, areaWidth - bubble.radius));
      bubble.y = Math.min(Math.max(bubble.radius, bubble.y), Math.max(bubble.radius, areaHeight - bubble.radius));
      placeBubble(bubble);
    });
  }

  function placeBubble(bubble) {
    bubble.element.style.transform = `translate3d(${bubble.x - bubble.radius}px, ${bubble.y - bubble.radius}px, 0)`;
  }

  function findSpawnPosition(radius) {
    const minX = radius + 3;
    const maxX = Math.max(minX, areaWidth - radius - 3);
    const minY = radius + 3;
    const maxY = Math.max(minY, areaHeight - radius - 3);
    let bestPosition = { x: randomBetween(minX, maxX), y: randomBetween(minY, maxY) };
    let bestGap = -Infinity;

    for (let attempt = 0; attempt < SPAWN_POSITION_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: randomBetween(minX, maxX),
        y: randomBetween(minY, maxY)
      };
      const nearestGap = bubbles.reduce((gap, bubble) => Math.min(
        gap,
        Math.hypot(candidate.x - bubble.x, candidate.y - bubble.y) - radius - bubble.radius
      ), Infinity);

      if (nearestGap > bestGap) {
        bestGap = nearestGap;
        bestPosition = candidate;
      }
      if (nearestGap >= BUBBLE_GAP) return candidate;
    }

    return bestPosition;
  }

  function playBubbleSound(bubble) {
    const kind = bubble.isGolden ? 'golden' : bubble.sizeName;
    const soundName = BUBBLE_SOUND_NAMES[kind];
    if (soundName) playEffect(soundName, { volume: 0.24, fadeOutSeconds: 0.14 });
  }

  function createSparkles(bubble) {
    const sparkleCount = Math.max(0, Math.min(bubble.isGolden ? 9 : 6, 24 - activeSparkleCount));
    for (let index = 0; index < sparkleCount; index += 1) {
      const sparkle = document.createElement('span');
      sparkle.className = `bubble-sparkle${bubble.isGolden ? ' bubble-sparkle--golden' : ''}`;
      sparkle.setAttribute('aria-hidden', 'true');
      sparkle.style.left = `${bubble.x}px`;
      sparkle.style.top = `${bubble.y}px`;
      const angle = Math.random() * Math.PI * 2;
      const distance = randomBetween(12, bubble.radius * 0.72);
      sparkle.style.setProperty('--sparkle-x', `${Math.cos(angle) * distance}px`);
      sparkle.style.setProperty('--sparkle-y', `${Math.sin(angle) * distance}px`);
      stage.append(sparkle);
      activeSparkleCount += 1;
      schedule(() => {
        sparkle.remove();
        activeSparkleCount -= 1;
      }, reducedMotion ? 40 : 560);
    }
  }

  function spawnBubble() {
    if (bubbles.length >= desiredBubbleCount || areaWidth <= 0 || areaHeight <= 0) return;

    const sizeRoll = Math.random();
    const sizeName = sizeRoll < 0.25 ? 'small' : sizeRoll > 0.84 ? 'large' : 'medium';
    const radius = sizeName === 'small'
      ? randomBetween(28, 36)
      : sizeName === 'large' ? randomBetween(52, 62) : randomBetween(40, 49);
    const position = findSpawnPosition(radius);
    const isGolden = !goldenInScene && Math.random() < GOLDEN_CHANCE;
    if (isGolden) goldenInScene = true;

    const element = document.createElement('button');
    element.className = `bubble bubble--${sizeName}${isGolden ? ' bubble--golden' : ''}`;
    element.type = 'button';
    element.setAttribute('aria-label', isGolden ? 'Scoppia la bolla dorata' : `Scoppia una bolla ${sizeName === 'large' ? 'grande' : sizeName === 'small' ? 'piccola' : 'media'}`);
    element.style.width = `${radius * 2}px`;
    element.style.height = `${radius * 2}px`;

    const surface = document.createElement('span');
    surface.className = 'bubble__surface';
    surface.setAttribute('aria-hidden', 'true');
    element.append(surface);
    stage.append(element);

    const angle = randomBetween(0, Math.PI * 2);
    const speedMultiplier = sizeName === 'small' ? 1.1 : sizeName === 'large' ? 0.82 : 1;
    const speed = randomBetween(12, 25) * speedMultiplier * (reducedMotion ? 0.58 : 1);
    const bubble = {
      element,
      surface,
      radius,
      sizeName,
      isGolden,
      x: position.x,
      y: position.y,
      speed,
      angle,
      turnRate: randomBetween(-0.3, 0.3),
      targetTurnRate: randomBetween(-0.5, 0.5),
      edgeBias: randomBetween(-0.9, 0.9),
      repulsionX: 0,
      repulsionY: 0,
      turnTimer: randomBetween(1.5, 4),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    };
    bubbles.push(bubble);
    placeBubble(bubble);
  }

  function popBubble(element) {
    if (!isRunning || isPausedForConfirm || isEnding) return;
    const bubbleIndex = bubbles.findIndex(bubble => bubble.element === element);
    if (bubbleIndex < 0) return;
    const now = elapsedGameTime * 1000;
    if (now < nextPopAllowedAt) return;

    const [bubble] = bubbles.splice(bubbleIndex, 1);
    nextPopAllowedAt = now + (bubble.isGolden ? GOLDEN_POP_LOCK_MS : POP_LOCK_MS);
    spawnTime = 0;
    spawnDelay = randomBetween(POP_SPAWN_DELAY_MIN, POP_SPAWN_DELAY_MAX);
    if (document.activeElement === bubble.element) bubble.element.blur();
    bubble.element.tabIndex = -1;
    bubble.element.setAttribute('aria-disabled', 'true');
    bubble.element.setAttribute('aria-hidden', 'true');
    bubble.surface.classList.add('is-popping');
    if (bubble.isGolden) {
      bubble.element.classList.add('is-popping');
      bubble.surface.classList.add('is-popping--golden');
    }
    createSparkles(bubble);
    playBubbleSound(bubble);
    if (bubble.isGolden) goldenInScene = true;

    schedule(() => {
      bubble.element.remove();
      if (bubble.isGolden) goldenInScene = false;
    }, bubble.isGolden ? (reducedMotion ? 180 : 560) : (reducedMotion ? 140 : 230));
  }

  function updateBubble(bubble, deltaTime) {
    bubble.turnTimer -= deltaTime;
    if (bubble.turnTimer <= 0) {
      bubble.turnTimer = randomBetween(1.1, 3.4);
      bubble.targetTurnRate = randomBetween(-0.78, 0.78);
      bubble.edgeBias = randomBetween(-0.9, 0.9);
    }

    const turnBlend = 1 - Math.exp(-0.38 * deltaTime);
    bubble.turnRate += (bubble.targetTurnRate - bubble.turnRate) * turnBlend;
    bubble.angle += bubble.turnRate * deltaTime;

    let directionX = Math.cos(bubble.angle);
    let directionY = Math.sin(bubble.angle);
    const softEdge = bubble.radius + 38;
    const pushX = Math.max(0, (softEdge - bubble.x) / softEdge)
      - Math.max(0, (bubble.x - (areaWidth - softEdge)) / softEdge);
    const pushY = Math.max(0, (softEdge - bubble.y) / softEdge)
      - Math.max(0, (bubble.y - (areaHeight - softEdge)) / softEdge);
    const pushLength = Math.hypot(pushX, pushY);

    if (pushLength > 0.001) {
      const inwardX = pushX / pushLength;
      const inwardY = pushY / pushLength;
      const tangent = bubble.edgeBias * 0.42;
      let escapeX = inwardX - inwardY * tangent;
      let escapeY = inwardY + inwardX * tangent;
      const escapeLength = Math.hypot(escapeX, escapeY) || 1;
      escapeX /= escapeLength;
      escapeY /= escapeLength;

      const edgeBlend = Math.min(0.82, pushLength * 0.78);
      directionX = directionX * (1 - edgeBlend) + escapeX * edgeBlend;
      directionY = directionY * (1 - edgeBlend) + escapeY * edgeBlend;
    }

    const repulsionLength = Math.hypot(bubble.repulsionX, bubble.repulsionY);
    if (repulsionLength > 0.001) {
      const repulsionBlend = Math.min(0.62, repulsionLength / 22);
      directionX = directionX * (1 - repulsionBlend) + bubble.repulsionX / repulsionLength * repulsionBlend;
      directionY = directionY * (1 - repulsionBlend) + bubble.repulsionY / repulsionLength * repulsionBlend;
    }

    let directionLength = Math.hypot(directionX, directionY);
    if (directionLength < 0.18) {
      const towardCenter = Math.atan2(areaHeight / 2 - bubble.y, areaWidth / 2 - bubble.x);
      const recoveryAngle = towardCenter + randomBetween(-1.25, 1.25);
      directionX = Math.cos(recoveryAngle);
      directionY = Math.sin(recoveryAngle);
      directionLength = 1;
    }
    directionX /= directionLength;
    directionY /= directionLength;
    const steerBlend = 1 - Math.exp(-1.8 * deltaTime);
    bubble.vx += (directionX * bubble.speed - bubble.vx) * steerBlend;
    bubble.vy += (directionY * bubble.speed - bubble.vy) * steerBlend;
    bubble.x += bubble.vx * deltaTime;
    bubble.y += bubble.vy * deltaTime;

    const minX = bubble.radius;
    const maxX = Math.max(minX, areaWidth - bubble.radius);
    const minY = bubble.radius;
    const maxY = Math.max(minY, areaHeight - bubble.radius);
    if (bubble.x < minX) {
      bubble.x = minX;
      bubble.vx = Math.abs(bubble.vx) * 0.75;
    } else if (bubble.x > maxX) {
      bubble.x = maxX;
      bubble.vx = -Math.abs(bubble.vx) * 0.75;
    }
    if (bubble.y < minY) {
      bubble.y = minY;
      bubble.vy = Math.abs(bubble.vy) * 0.75;
    } else if (bubble.y > maxY) {
      bubble.y = maxY;
      bubble.vy = -Math.abs(bubble.vy) * 0.75;
    }

    if (Math.hypot(bubble.vx, bubble.vy) < bubble.speed * 0.42) {
      const towardCenter = Math.atan2(areaHeight / 2 - bubble.y, areaWidth / 2 - bubble.x);
      bubble.angle = towardCenter + randomBetween(-1.25, 1.25);
      bubble.turnRate = randomBetween(-0.4, 0.4);
      bubble.targetTurnRate = randomBetween(-0.78, 0.78);
      bubble.turnTimer = randomBetween(1.1, 3.4);
      bubble.vx = Math.cos(bubble.angle) * bubble.speed * 0.68;
      bubble.vy = Math.sin(bubble.angle) * bubble.speed * 0.68;
    }
    placeBubble(bubble);
  }

  function applyBubbleRepulsion(deltaTime) {
    bubbles.forEach(bubble => {
      bubble.repulsionX = 0;
      bubble.repulsionY = 0;
    });

    for (let firstIndex = 0; firstIndex < bubbles.length; firstIndex += 1) {
      const first = bubbles[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < bubbles.length; secondIndex += 1) {
        const second = bubbles[secondIndex];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          const angle = randomBetween(0, Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const preferredDistance = first.radius + second.radius + BUBBLE_GAP;
        if (distance >= preferredDistance) continue;

        const directionX = dx / distance;
        const directionY = dy / distance;
        const pressure = (preferredDistance - distance) / preferredDistance;
        const force = pressure * 16;

        first.repulsionX -= directionX * force;
        first.repulsionY -= directionY * force;
        second.repulsionX += directionX * force;
        second.repulsionY += directionY * force;

        const separation = Math.min((preferredDistance - distance) * 0.8 * deltaTime, 1.5);
        first.x -= directionX * separation / 2;
        first.y -= directionY * separation / 2;
        second.x += directionX * separation / 2;
        second.y += directionY * separation / 2;
      }
    }
  }

  function animate(now) {
    if (!isRunning || isPausedForConfirm || isEnding || document.hidden) return;
    if (lastFrameTime === null) lastFrameTime = now;
    const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    elapsedGameTime += deltaTime;
    spawnTime += deltaTime;

    if (!document.body.classList.contains('can-exit') && elapsedGameTime >= EXIT_AFTER_SECONDS) {
      document.body.classList.add('can-exit');
    }

    if (bubbles.length < desiredBubbleCount && spawnTime >= spawnDelay) {
      spawnTime = 0;
      spawnBubble();
      spawnDelay = randomBetween(SPAWN_DELAY_MIN, SPAWN_DELAY_MAX);
    }

    applyBubbleRepulsion(deltaTime);
    bubbles.forEach(bubble => updateBubble(bubble, deltaTime));
    animationFrame = window.requestAnimationFrame(animate);
  }

  function startAnimationLoop() {
    if (isRunning || isPausedForConfirm || isEnding || document.hidden) return;
    isRunning = true;
    stage.classList.remove('is-paused');
    lastFrameTime = null;
    animationFrame = window.requestAnimationFrame(animate);
  }

  function pauseAnimationLoop() {
    isRunning = false;
    stage.classList.add('is-paused');
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameTime = null;
  }

  function resumeFromConfirmation() {
    stage.inert = false;
    isPausedForConfirm = false;
    exitButton.focus({ preventScroll: true });
    startAnimationLoop();
  }

  function closeConfirmation(afterClose) {
    if (!confirmDialog.open) {
      afterClose();
      return;
    }
    if (isClosingConfirm) return;

    if (reducedMotion) {
      confirmDialog.close();
      afterClose();
      return;
    }

    isClosingConfirm = true;
    const finish = event => {
      if (event && (event.target !== confirmDialog || event.animationName !== 'bubble-confirm-exit')) return;
      window.clearTimeout(confirmCloseTimer);
      confirmDialog.removeEventListener('animationend', finish);
      confirmDialog.close();
      confirmDialog.classList.remove('is-closing');
      isClosingConfirm = false;
      afterClose();
    };

    confirmDialog.addEventListener('animationend', finish);
    confirmDialog.classList.add('is-closing');
    confirmCloseTimer = window.setTimeout(() => finish(), 320);
  }

  function clearGameResources() {
    pauseAnimationLoop();
    window.clearTimeout(confirmCloseTimer);
    confirmCloseTimer = null;
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    resizeObserver?.disconnect();
    resizeObserver = null;
    listeners.abort();
    bubbles.length = 0;
    stage.replaceChildren();
  }

  function showCompletion() {
    if (isEnding) return;
    isEnding = true;
    clearGameResources();
    screen.inert = true;
    const musicToggle = document.querySelector('.music-toggle');
    if (musicToggle) musicToggle.inert = true;
    completionScreen.inert = false;
    completionScreen.setAttribute('aria-hidden', 'false');
    completionScreen.classList.add('is-visible');
    completionYesButton?.focus({ preventScroll: true });
  }

  function closeNextExerciseDialog(afterClose = () => {}) {
    if (!nextExerciseDialog?.open) {
      afterClose();
      return;
    }
    if (isClosingNextExerciseDialog) return;

    if (reducedMotion) {
      nextExerciseDialog.close();
      afterClose();
      return;
    }

    isClosingNextExerciseDialog = true;
    const finish = event => {
      if (event && (event.target !== nextExerciseDialog || event.animationName !== 'bubble-confirm-exit')) return;
      window.clearTimeout(nextExerciseCloseTimer);
      nextExerciseDialog.removeEventListener('animationend', finish);
      nextExerciseDialog.close();
      nextExerciseDialog.classList.remove('is-closing');
      isClosingNextExerciseDialog = false;
      afterClose();
    };

    nextExerciseDialog.addEventListener('animationend', finish);
    nextExerciseDialog.classList.add('is-closing');
    nextExerciseCloseTimer = window.setTimeout(() => finish(), 320);
  }

  function openNextExerciseDialog() {
    if (!nextExerciseDialog || nextExerciseDialog.open) return;
    nextExerciseDialog.classList.remove('is-closing');
    nextExerciseDialog.showModal();
    nextExerciseNoButton?.focus({ preventScroll: true });
  }

  function leaveCompletion(destination) {
    completionScreen.inert = true;
    completionScreen.setAttribute('aria-hidden', 'true');
    completionScreen.classList.add('is-closing');
    completionScreen.classList.remove('is-visible');
    document.body.classList.add('is-leaving');
    schedule(() => window.location.assign(destination), reducedMotion ? 80 : 720);
  }

  function startSealVideo() {
    if (!sealVideoScreen || !sealVideo || !sealVideoHomeButton) {
      leaveCompletion('radicamento.html');
      return;
    }

    // Avviare play() direttamente dal tap conserva il permesso audio su iPhone.
    sealVideoScreen.inert = false;
    sealVideoScreen.setAttribute('aria-hidden', 'false');
    sealVideoScreen.classList.add('is-active');
    document.documentElement.classList.add('is-seal-video-active');
    document.body.classList.add('is-seal-video-active');
    themeColorMeta?.setAttribute('content', '#000000');
    sealVideoHomeButton.hidden = true;
    lastSealVideoTime = 0;
    hasSealVideoLooped = false;
    sealVideo.loop = true;
    silenceSystemMediaSession();

    sealVideo.addEventListener('playing', revealSealVideoWhenReady, { once: true });
    sealVideo.addEventListener('timeupdate', detectFirstVideoLoop);
    sealVideo.addEventListener('seeked', detectFirstVideoLoop);
    sealVideo.addEventListener('error', showSealVideoHomeButton, { once: true });
    prepareSealVideoAudio();
    const playback = sealVideo.play();

    window.clearTimeout(sealVideoBlackoutTimer);
    sealVideoBlackoutTimer = window.setTimeout(() => {
      sealVideoScreen.classList.add('is-black');
      if (sealVideo.paused) showSealVideoHomeButton();
      else if (sealVideoScreen.classList.contains('is-video-playing')) {
        sealVideoScreen.classList.add('is-video-visible');
      }
    }, reducedMotion ? 0 : 1400);

    playback?.catch(() => showSealVideoHomeButton());
  }

  function prepareSealVideoAudio() {
    // Lascia la traccia attiva: il MediaElementAudioSource la instrada nel grafo Web Audio.
    sealVideo.muted = false;
    try {
      // Su Safari dichiara l'audio come riproduzione, così non dipende dal canale dei suoni brevi.
      if (navigator.audioSession && 'type' in navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch {
      // Audio Session API non disponibile o non modificabile: continua con l'audio standard.
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!sealAudioContext) {
        sealAudioContext = new AudioContextClass();
        sealVideoSource = sealAudioContext.createMediaElementSource(sealVideo);
        sealVideoGain = sealAudioContext.createGain();
        sealVideoGain.gain.value = 1;
        sealVideoSource.connect(sealVideoGain);
        sealVideoGain.connect(sealAudioContext.destination);
      }

      // Web Audio porta l'audio alle casse senza esporre il video come Now Playing.
      if (sealAudioContext.state !== 'running') {
        sealAudioContext.resume().catch(error => {
          console.warn('Impossibile attivare l’audio del video:', error);
        });
      }
    } catch {
      sealVideo.muted = false;
    }
  }

  function silenceSystemMediaSession() {
    const mediaSession = navigator.mediaSession;
    if (!mediaSession) return;

    try {
      mediaSession.metadata = null;
      mediaSession.playbackState = 'none';
      ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'].forEach(action => {
        try { mediaSession.setActionHandler(action, null); } catch { /* Azione non supportata dal browser. */ }
      });
    } catch {
      // Safari può non esporre tutte le funzioni della Media Session API.
    }
  }

  function detectFirstVideoLoop() {
    if (!sealVideo || !sealVideoScreen || hasSealVideoLooped) return;
    const currentTime = sealVideo.currentTime;
    const duration = sealVideo.duration;
    const didWrapToStart = Number.isFinite(duration)
      && duration > 0
      && lastSealVideoTime > duration * 0.65
      && currentTime < lastSealVideoTime - Math.max(0.5, duration * 0.1);

    if (didWrapToStart) {
      hasSealVideoLooped = true;
      sealVideoScreen.classList.add('is-home-ready');
      sealVideoHomeButton.hidden = false;
    }

    lastSealVideoTime = currentTime;
  }

  function revealSealVideoWhenReady() {
    if (!sealVideoScreen) return;
    sealVideoScreen.classList.add('is-video-playing');
    if (sealVideoScreen.classList.contains('is-black')) sealVideoScreen.classList.add('is-video-visible');
  }

  function showSealVideoHomeButton() {
    if (!sealVideoScreen || !sealVideoHomeButton) return;
    sealVideoHomeButton.hidden = false;
    sealVideoScreen.classList.add('is-black', 'is-video-visible', 'is-home-ready');
  }

  function openConfirmation() {
    if (!isRunning || isPausedForConfirm || isEnding) return;
    pauseAnimationLoop();
    isPausedForConfirm = true;
    stage.inert = true;
    confirmDialog.classList.remove('is-closing');
    confirmDialog.showModal();
    continueButton.focus({ preventScroll: true });
  }

  function startGame() {
    if (isEnding) return;
    document.body.classList.add('is-game-active');
    spawnTime = 0;
    spawnDelay = randomBetween(0.1, 0.4);
    startAnimationLoop();
  }

  function handleVisibilityChange() {
    if (document.hidden) pauseAnimationLoop();
    else startAnimationLoop();
  }

  function cleanupOnPageHide() {
    clearGameResources();
  }

  function handlePointerBubblePress(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const bubble = event.target.closest?.('.bubble');
    if (!bubble || !stage.contains(bubble)) return;
    event.preventDefault();
    popBubble(bubble);
  }

  function handleKeyboardBubblePress(event) {
    if (event.detail !== 0) return;
    const bubble = event.target.closest?.('.bubble');
    if (bubble && stage.contains(bubble)) popBubble(bubble);
  }

  stage.addEventListener('pointerdown', handlePointerBubblePress, { signal: listeners.signal });
  stage.addEventListener('click', handleKeyboardBubblePress, { signal: listeners.signal });
  exitButton.addEventListener('click', openConfirmation, { signal: listeners.signal });
  continueButton.addEventListener('click', () => closeConfirmation(resumeFromConfirmation), { signal: listeners.signal });
  confirmExitButton.addEventListener('click', () => closeConfirmation(showCompletion), { signal: listeners.signal });
  confirmDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeConfirmation(resumeFromConfirmation);
  }, { signal: listeners.signal });
  confirmDialog.addEventListener('click', event => {
    if (event.target === confirmDialog) closeConfirmation(resumeFromConfirmation);
  }, { signal: listeners.signal });
  document.addEventListener('visibilitychange', handleVisibilityChange, { signal: listeners.signal });
  window.addEventListener('pagehide', cleanupOnPageHide, { once: true, signal: listeners.signal });

  completionYesButton?.addEventListener('click', openNextExerciseDialog);
  completionContinueButton?.addEventListener('click', () => leaveCompletion('../index.html'));
  nextExerciseNoButton?.addEventListener('click', () => closeNextExerciseDialog(() => {
    completionYesButton?.focus({ preventScroll: true });
  }));
  nextExerciseYesButton?.addEventListener('click', () => {
    startSealVideo();
    nextExerciseDialog?.close();
  });
  sealVideoHomeButton?.addEventListener('click', () => leaveCompletion('../index.html'));
  nextExerciseDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeNextExerciseDialog(() => completionYesButton?.focus({ preventScroll: true }));
  });
  nextExerciseDialog?.addEventListener('click', event => {
    if (event.target === nextExerciseDialog) {
      closeNextExerciseDialog(() => completionYesButton?.focus({ preventScroll: true }));
    }
  });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(loadAreaSize);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener('resize', loadAreaSize, { signal: listeners.signal });
  }
  loadAreaSize();

  schedule(() => {
    document.body.classList.add('is-title-moving');
    schedule(() => {
      if (isEnding) return;
      startGame();
    }, reducedMotion ? 520 : 2020);
  }, reducedMotion ? 1500 : 3200);
}
