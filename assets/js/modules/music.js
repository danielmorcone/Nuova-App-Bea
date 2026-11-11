// AUDIO TEMPORANEAMENTE DISATTIVATO.
// Per riattivare musica ed effetti, imposta il valore su false.
const AUDIO_TEMPORANEAMENTE_DISATTIVATO = true;

const MUSIC_URL = new URL('../../sounds/bgmusic.mp3', import.meta.url);
const PLAYBACK_KEY = 'respira-music-enabled';
const POSITION_KEY = 'respira-music-position';
const FADE_SECONDS = 0.8;
const TARGET_VOLUME = 0.2;

const AudioContextClass = AUDIO_TEMPORANEAMENTE_DISATTIVATO
  ? null
  : window.AudioContext || window.webkitAudioContext;
const context = AudioContextClass ? new AudioContextClass() : null;
const fallbackAudio = AUDIO_TEMPORANEAMENTE_DISATTIVATO || context ? null : new Audio(MUSIC_URL.href);
if (fallbackAudio) fallbackAudio.volume = TARGET_VOLUME;

let audioBufferPromise = null;
const effectBufferPromises = new Map();
const activeEffects = new Map();
let source = null;
let gainNode = null;
let startedAt = 0;
let savedOffset = Number(readStorage(POSITION_KEY)) || 0;
let enabled = readStorage(PLAYBACK_KEY) !== 'false';
let isFadingOut = false;
let fallbackFadeTimer = null;
let plannedMusicFade = null;

const button = AUDIO_TEMPORANEAMENTE_DISATTIVATO ? null : document.createElement('button');
if (button) {
  button.className = 'music-toggle';
  button.type = 'button';
  button.innerHTML = '<span aria-hidden="true">&#9835;</span>';
  document.body.append(button);
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // La musica continua a funzionare anche se lo storage non è disponibile.
  }
}

function currentPosition() {
  if (fallbackAudio) return fallbackAudio.currentTime || 0;
  if (isFadingOut) return savedOffset;
  if (!source || !context) return savedOffset;

  const duration = source.buffer.duration;
  return (savedOffset + context.currentTime - startedAt) % duration;
}

function isPlaying() {
  if (!enabled) return false;
  if (fallbackAudio) return !fallbackAudio.paused;
  return Boolean(source && context?.state === 'running' && !isFadingOut);
}

function updateButton() {
  if (AUDIO_TEMPORANEAMENTE_DISATTIVATO || !button) return;
  const playing = isPlaying();
  button.classList.toggle('is-muted', !playing);
  button.setAttribute('aria-pressed', String(playing));
  button.setAttribute('aria-label', playing ? 'Disattiva la musica' : 'Attiva la musica');
  button.title = playing ? 'Disattiva la musica' : 'Attiva la musica';
}

function loadAudioBuffer() {
  if (!audioBufferPromise) {
    audioBufferPromise = fetch(MUSIC_URL)
      .then(response => {
        if (!response.ok) throw new Error('La colonna sonora non è disponibile.');
        return response.arrayBuffer();
      })
      .then(file => context.decodeAudioData(file));
  }
  return audioBufferPromise;
}

function loadEffectBuffer(name) {
  if (!effectBufferPromises.has(name)) {
    const url = new URL(`../../sounds/${name}.mp3`, import.meta.url);
    const promise = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Il suono ${name} non è disponibile.`);
        return response.arrayBuffer();
      })
      .then(file => context.decodeAudioData(file));
    effectBufferPromises.set(name, promise);
  }
  return effectBufferPromises.get(name);
}

function holdGainAtCurrentValue(parameter, time) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(time);
  } else {
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(parameter.value, time);
  }
}

function fadeActiveMusicToEnd(fade) {
  if (gainNode && source && context) {
    const now = context.currentTime;
    const remaining = Math.max(0.05, (fade.endAt - performance.now()) / 1000);
    holdGainAtCurrentValue(gainNode.gain, now);
    gainNode.gain.linearRampToValueAtTime(0, now + remaining);
  }

  if (fallbackAudio && !fallbackAudio.paused) {
    window.clearInterval(fade.volumeTimer);
    const initialVolume = fallbackAudio.volume;
    const startAt = performance.now();
    const remainingMs = Math.max(50, fade.endAt - startAt);
    fade.volumeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startAt) / remainingMs);
      fallbackAudio.volume = initialVolume * (1 - progress);
    }, 50);
  }
}

function finishPlannedMusicFade(fade) {
  if (plannedMusicFade !== fade) return;
  plannedMusicFade = null;
  window.clearInterval(fade.volumeTimer);
  enabled = false;
  writeStorage(PLAYBACK_KEY, 'false');

  if (fallbackAudio) {
    fallbackAudio.pause();
    fallbackAudio.volume = TARGET_VOLUME;
  } else if (source) {
    savedOffset = currentPosition();
    isFadingOut = true;
    source.stop();
  } else {
    context?.suspend();
  }
  updateButton();
}

export function fadeOutMusic(durationSeconds = 8.7) {
  if (AUDIO_TEMPORANEAMENTE_DISATTIVATO) return () => {};
  if (!enabled) return () => {};

  const fade = {
    endAt: performance.now() + durationSeconds * 1000,
    durationMs: durationSeconds * 1000,
    timer: null,
    volumeTimer: null
  };
  plannedMusicFade = fade;
  fadeActiveMusicToEnd(fade);
  fade.timer = window.setTimeout(() => finishPlannedMusicFade(fade), fade.durationMs);

  return () => {
    if (plannedMusicFade !== fade) return;
    plannedMusicFade = null;
    window.clearTimeout(fade.timer);
    window.clearInterval(fade.volumeTimer);

    if (gainNode && context) {
      const now = context.currentTime;
      holdGainAtCurrentValue(gainNode.gain, now);
      gainNode.gain.linearRampToValueAtTime(TARGET_VOLUME, now + 0.35);
    }

    if (fallbackAudio && !fallbackAudio.paused) {
      const startVolume = fallbackAudio.volume;
      let step = 0;
      fallbackFadeTimer = window.setInterval(() => {
        step += 1;
        fallbackAudio.volume = startVolume + (TARGET_VOLUME - startVolume) * (step / 8);
        if (step >= 8) {
          window.clearInterval(fallbackFadeTimer);
          fallbackFadeTimer = null;
        }
      }, 45);
    }
  };
}

export function playEffect(name, { loop = false, fadeOutSeconds = 0.28, volume = 0.55 } = {}) {
  if (AUDIO_TEMPORANEAMENTE_DISATTIVATO) return { stop() {} };
  activeEffects.get(name)?.stop();
  const url = new URL(`../../sounds/${name}.mp3`, import.meta.url);
  let effectSource = null;
  let effectGain = null;
  let stopped = false;
  let fallbackTimer = null;
  const resume = context && context.state !== 'running'
    ? context.resume().catch(() => {})
    : Promise.resolve();

  const effect = {
    stop() {
      if (stopped) return;
      stopped = true;
      if (activeEffects.get(name) === effect) activeEffects.delete(name);

      if (effectSource && effectGain && context) {
        const now = context.currentTime;
        const stopAt = now + fadeOutSeconds;
        effectGain.gain.cancelScheduledValues(now);
        effectGain.gain.setValueAtTime(effectGain.gain.value, now);
        effectGain.gain.linearRampToValueAtTime(0, stopAt);
        effectSource.stop(stopAt);
      } else if (fallbackAudio) {
        window.clearInterval(fallbackTimer);
        const startVolume = fallbackAudio.volume;
        let step = 0;
        fallbackTimer = window.setInterval(() => {
          step += 1;
          fallbackAudio.volume = Math.max(0, startVolume * (1 - step / 8));
          if (step >= 8) {
            window.clearInterval(fallbackTimer);
            fallbackTimer = null;
            fallbackAudio.pause();
          }
        }, fadeOutSeconds * 1000 / 8);
      }
    }
  };

  activeEffects.set(name, effect);

  if (context) {
    Promise.all([loadEffectBuffer(name), resume]).then(([buffer]) => {
      if (stopped || context.state !== 'running') return;

      effectGain = context.createGain();
      effectGain.gain.value = volume;
      effectGain.connect(context.destination);
      effectSource = context.createBufferSource();
      effectSource.buffer = buffer;
      effectSource.loop = loop;
      effectSource.connect(effectGain);
      effectSource.addEventListener('ended', () => {
        effectSource?.disconnect();
        effectGain?.disconnect();
        stopped = true;
        if (activeEffects.get(name) === effect) activeEffects.delete(name);
      }, { once: true });
      effectSource.start();
    }).catch(error => {
      stopped = true;
      if (activeEffects.get(name) === effect) activeEffects.delete(name);
      console.warn(`Impossibile riprodurre il suono ${name}:`, error);
    });
  } else {
    const fallbackAudio = new Audio(url.href);
    fallbackAudio.loop = loop;
    fallbackAudio.volume = volume;
    effect.stop = () => {
      if (stopped) return;
      stopped = true;
      if (activeEffects.get(name) === effect) activeEffects.delete(name);
      const startVolume = fallbackAudio.volume;
      let step = 0;
      fallbackTimer = window.setInterval(() => {
        step += 1;
        fallbackAudio.volume = Math.max(0, startVolume * (1 - step / 8));
        if (step >= 8) {
          window.clearInterval(fallbackTimer);
          fallbackTimer = null;
          fallbackAudio.pause();
        }
      }, fadeOutSeconds * 1000 / 8);
    };
    fallbackAudio.addEventListener('ended', () => {
      stopped = true;
      if (activeEffects.get(name) === effect) activeEffects.delete(name);
    }, { once: true });
    fallbackAudio.play().catch(error => {
      stopped = true;
      if (activeEffects.get(name) === effect) activeEffects.delete(name);
      console.warn(`Impossibile riprodurre il suono ${name}:`, error);
    });
  }

  return effect;
}

// Carica in anticipo i due effetti brevi, così partono senza ritardo durante l'uso.
if (!AUDIO_TEMPORANEAMENTE_DISATTIVATO && context) {
  loadEffectBuffer('swipe').catch(() => {});
  loadEffectBuffer('longpress').catch(() => {});
}

async function startMusic() {
  if (AUDIO_TEMPORANEAMENTE_DISATTIVATO) return;
  if (fallbackAudio) {
    window.clearInterval(fallbackFadeTimer);
    fallbackFadeTimer = null;
    fallbackAudio.volume = TARGET_VOLUME;
    try {
      await fallbackAudio.play();
      if (plannedMusicFade) fadeActiveMusicToEnd(plannedMusicFade);
    } catch {
      // iOS richiede un gesto dell'utente prima di avviare l'audio.
    }
    updateButton();
    return;
  }

  if (!context) return;

  // resume() viene chiamato subito, così il tocco dell'utente sblocca l'audio.
  const resume = context.state === 'running'
    ? Promise.resolve()
    : context.resume().catch(() => {});

  try {
    const buffer = await loadAudioBuffer();
    await resume;

    if (!enabled || source || context.state !== 'running') {
      updateButton();
      return;
    }

    gainNode = context.createGain();
    gainNode.gain.value = TARGET_VOLUME;
    gainNode.connect(context.destination);

    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    startedAt = context.currentTime;
    source.start(0, savedOffset % buffer.duration);
    if (plannedMusicFade) fadeActiveMusicToEnd(plannedMusicFade);

    const playingSource = source;
    playingSource.addEventListener('ended', () => {
      if (source !== playingSource) return;
      playingSource.disconnect();
      gainNode?.disconnect();
      source = null;
      gainNode = null;
      isFadingOut = false;
      updateButton();
      if (enabled) startMusic();
    }, { once: true });

    updateButton();
  } catch (error) {
    console.warn('Impossibile avviare la colonna sonora:', error);
    updateButton();
  }
}

function stopMusic() {
  if (AUDIO_TEMPORANEAMENTE_DISATTIVATO) return;
  if (plannedMusicFade) {
    window.clearTimeout(plannedMusicFade.timer);
    window.clearInterval(plannedMusicFade.volumeTimer);
    plannedMusicFade = null;
  }

  if (fallbackAudio) {
    window.clearInterval(fallbackFadeTimer);
    const startVolume = fallbackAudio.volume;
    const steps = 16;
    let step = 0;

    fallbackFadeTimer = window.setInterval(() => {
      step += 1;
      fallbackAudio.volume = Math.max(0, startVolume * (1 - step / steps));

      if (step >= steps) {
        window.clearInterval(fallbackFadeTimer);
        fallbackFadeTimer = null;
        fallbackAudio.pause();
        fallbackAudio.volume = TARGET_VOLUME;
        updateButton();
      }
    }, FADE_SECONDS * 1000 / steps);
    updateButton();
    return;
  }

  if (source) {
    if (!isFadingOut) {
      const stopAt = context.currentTime + FADE_SECONDS;
      savedOffset = (currentPosition() + FADE_SECONDS) % source.buffer.duration;
      holdGainAtCurrentValue(gainNode.gain, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, stopAt);
      isFadingOut = true;
      source.stop(stopAt);
    }
  } else {
    context?.suspend();
  }
  updateButton();
}

if (button) {
  button.addEventListener('click', () => {
    enabled = !enabled;
    writeStorage(PLAYBACK_KEY, String(enabled));

    if (enabled) startMusic();
    else stopMusic();
  });
}

if (!AUDIO_TEMPORANEAMENTE_DISATTIVATO) {
  // Il primo tocco avvia la traccia se iOS ha bloccato l'avvio automatico.
  document.addEventListener('pointerdown', event => {
    if (enabled && !isPlaying() && !event.target.closest('.music-toggle')) startMusic();
  }, { capture: true });

  document.addEventListener('keydown', event => {
    if (enabled && !isPlaying() && event.key !== 'Tab') startMusic();
  }, { capture: true });

  if (enabled) startMusic();

  window.addEventListener('pagehide', () => {
    writeStorage(POSITION_KEY, String(currentPosition()));
  });
}
