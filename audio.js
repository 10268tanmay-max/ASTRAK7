// Music playback and lightweight WebAudio sound effects.
let ctx = null;
let musicAudio = null;
let musicFadeTimer = null;
let musicFadeTarget = null;
let musicPlayPromise = null;
let musicPlayTrack = null;
let musicRequested = false;
let musicRequestId = 0;
let selectedMusicTrack = 'space-galaxy-universe';
let ambientMaster = null;
let ambientOscillators = [];
let ambientTimer = null;

const ambientChords = [
  [130.81, 196, 261.63, 329.63],
  [110, 164.81, 220, 261.63],
  [146.83, 220, 293.66, 349.23],
  [98, 146.83, 196, 246.94]
];

function setMusicVolume(volume) {
  if (selectedMusicTrack === 'deep-field') {
    if (ambientMaster) ambientMaster.gain.value = volume;
  } else if (musicAudio) {
    musicAudio.volume = volume;
  }
}

function getMusicVolume() {
  if (selectedMusicTrack === 'deep-field') return ambientMaster?.gain.value || 0;
  return musicAudio?.volume || 0;
}

function startAmbientMusic() {
  const audioContext = ac();
  if (!audioContext) throw new Error('Web Audio is not available in this browser.');

  const master = audioContext.createGain();
  master.gain.value = 0;
  master.connect(audioContext.destination);
  ambientMaster = master;

  const drone = audioContext.createOscillator();
  const droneGain = audioContext.createGain();
  drone.type = 'sine';
  drone.frequency.value = 55;
  droneGain.gain.value = 0.12;
  drone.connect(droneGain);
  droneGain.connect(master);
  drone.start();
  ambientOscillators = [{ oscillator: drone, gain: droneGain }];

  const chordVoices = ambientChords[0];
  for (let i = 0; i < chordVoices.length; i++) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = i < 2 ? 'sine' : 'triangle';
    oscillator.frequency.value = chordVoices[i];
    gain.gain.value = i === 0 ? 0.045 : 0.022;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    ambientOscillators.push({ oscillator, gain });
  }

  let chordIndex = 0;
  ambientTimer = window.setInterval(() => {
    chordIndex = (chordIndex + 1) % ambientChords.length;
    const chord = ambientChords[chordIndex];
    const now = audioContext.currentTime;
    ambientOscillators.slice(1).forEach(({ oscillator }, index) => {
      oscillator.frequency.setTargetAtTime(chord[index], now, 3.5);
    });
  }, 18000);
}

function stopAmbientMusic() {
  if (ambientTimer) window.clearInterval(ambientTimer);
  ambientTimer = null;
  for (const { oscillator } of ambientOscillators) {
    try {
      oscillator.stop();
    } catch (error) {
      if (error.name !== 'InvalidStateError') throw error;
    }
  }
  ambientOscillators = [];
  ambientMaster?.disconnect();
  ambientMaster = null;
}

function fadeMusicTo(target, duration, onComplete) {
  if (musicFadeTimer && musicFadeTarget === target) return;
  if (musicFadeTimer) window.clearInterval(musicFadeTimer);
  musicFadeTarget = target;
  const startVolume = getMusicVolume();
  const startedAt = performance.now();
  musicFadeTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / duration);
    setMusicVolume(startVolume + (target - startVolume) * progress);
    if (progress === 1) {
      window.clearInterval(musicFadeTimer);
      musicFadeTimer = null;
      musicFadeTarget = null;
      onComplete?.();
    }
  }, 30);
}

export function startMusic() {
  musicRequested = true;
  if (selectedMusicTrack === 'deep-field') {
    if (!ambientMaster) startAmbientMusic();
    if (musicFadeTarget !== 0 && ambientMaster.gain.value >= 0.55) return Promise.resolve();
    fadeMusicTo(0.55, 1200);
    return Promise.resolve();
  }

  if (!musicAudio) {
    musicAudio = new Audio(new URL('./assets/audio/space-galaxy-universe.mp3', import.meta.url).href);
    musicAudio.loop = true;
    musicAudio.preload = 'auto';
    musicAudio.volume = 0;
    musicAudio.addEventListener('error', () => {
      window.dispatchEvent(new CustomEvent('game-music-error', {
        detail: new Error('The music track could not be loaded.')
      }));
    });
    musicAudio.addEventListener('ended', () => {
      musicAudio.currentTime = 0;
      musicAudio.play().catch((error) => {
        window.dispatchEvent(new CustomEvent('game-music-error', { detail: error }));
      });
    });
  }
  if (musicPlayPromise && musicPlayTrack === selectedMusicTrack) return musicPlayPromise;
  if (!musicAudio.paused) {
    if (musicAudio.volume < 0.55 || musicFadeTarget === 0) fadeMusicTo(0.55, 1200);
    return Promise.resolve();
  }

  const requestId = musicRequestId;
  const track = selectedMusicTrack;
  const playPromise = musicAudio.play().then(() => {
    if (requestId !== musicRequestId || track !== selectedMusicTrack) return;
    if (!musicRequested) return stopMusic();
    fadeMusicTo(0.55, 1200);
  });
  musicPlayPromise = playPromise;
  musicPlayTrack = track;
  const clearPlayPromise = () => {
    if (musicPlayPromise === playPromise) {
      musicPlayPromise = null;
      musicPlayTrack = null;
    }
  };
  playPromise.then(clearPlayPromise, clearPlayPromise);
  return playPromise;
}

export function stopMusic() {
  musicRequested = false;
  musicRequestId++;
  musicPlayPromise = null;
  musicPlayTrack = null;
  if (musicFadeTimer) window.clearInterval(musicFadeTimer);
  musicFadeTimer = null;
  musicFadeTarget = null;
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicAudio.volume = 0;
  }
  stopAmbientMusic();
}

export function setMusicTrack(track) {
  if (track !== 'space-galaxy-universe' && track !== 'deep-field') {
    throw new Error(`Unknown music track: ${track}`);
  }
  if (track === selectedMusicTrack) return;
  selectedMusicTrack = track;
  stopMusic();
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function beep(freq = 440, dur = 0.12, type = 'sine', vol = 0.14, slide = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.03);
}

export function click() { beep(880, 0.05, 'square', 0.05); }
export function hover() { beep(1320, 0.03, 'sine', 0.03); }

export function countBeep() { beep(440, 0.12, 'square', 0.09); }
export function countGo() { beep(880, 0.5, 'square', 0.12, 300); }

export function pickupBeep() { beep(620, 0.09, 'triangle', 0.12, 180); }

export function arpeggio() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.1), i * 110));
}

export function alarmBeep() { beep(620, 0.22, 'sawtooth', 0.07, 140); }
