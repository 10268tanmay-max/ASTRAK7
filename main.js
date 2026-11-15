// ============================================================
// Junior Space Academy - main game logic
// ============================================================
import * as THREE from 'three';
import { MISSIONS, INTERACT_LABELS } from './mission.js?v=mission-pack-8';
import { SurfaceWorld, createStarfield } from './world.js?v=mission-pack-8';
import { SpaceflightWorld } from './spaceflight.js';
import { Cockpit } from './cockpit.js';
import { HUD } from './hud.js';
import { BaseSystems } from './system.js?v=mission-pack-5';
import { TeamNetwork } from './team-network.js?v=online-teams-1';
import { click, hover, countBeep, countGo, pickupBeep, arpeggio, alarmBeep, startMusic, stopMusic, setMusicTrack } from './audio.js';

// ---------- renderer / scene ----------
const requestedQuality = new URLSearchParams(window.location.search).get('quality');
const qualityPreset = requestedQuality || localStorage.getItem('jsa-quality') || 'high';
const QUALITY_PRESETS = {
  low: { pixelRatio: 1.2, shadowSize: 1024, exposure: 0.9 },
  high: { pixelRatio: Math.min(window.devicePixelRatio * 1.2, 2.5), shadowSize: 2048, exposure: 1.18 },
  ultra: { pixelRatio: Math.min(window.devicePixelRatio * 1.5, 3), shadowSize: 4096, exposure: 1.18 }
};
const quality = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.high;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.renderSingleSided = false;
renderer.shadowMap.autoUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = quality.exposure;

const scene = new THREE.Scene();
scene.userData.shadowMapSize = quality.shadowSize;
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- global starfield + menu orbs ----------
const starfield = createStarfield(1500, 750, 1);
scene.add(starfield);
const menuOrbs = new THREE.Group();
{
  const glowTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    return c;
  })());
  for (let i = 0; i < 12; i++) {
    const hue = i / 12;
    const mat = new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color().setHSL(hue, 1, 0.6),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    });
    const sp = new THREE.Sprite(mat);
    const a = (i / 12) * Math.PI * 2;
    const r = 14 + (i % 5) * 3.4;
    sp.position.set(Math.cos(a) * r, 2 + Math.sin(i * 2.7) * 5, Math.sin(a) * r);
    sp.scale.set(2.2, 2.2, 1);
    sp.userData = { a, r, speed: 0.05 + (i % 3) * 0.04, yBase: sp.position.y, yAmp: 1 + (i % 4) };
    menuOrbs.add(sp);
  }
  scene.add(menuOrbs);
}

// ---------- state ----------
let state = 'menu'; // menu | cockpit | launching | surface | paused | complete
let mission = null;
let cockpit = null;
let world = null;
let hud = null;
let transitioning = false;
let systems = null;   // BaseSystems for habitat missions
let inChoice = false; // system choice modal open
let teamNetwork = null;
let lastPoseBroadcast = 0;

const player = {
  pos: new THREE.Vector3(0, 1.7, 0),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  grounded: false,
  bobPhase: 0,
  moving: false
};

const keys = {};
let interactPressed = false;
let o2 = 100;
let startTime = 0;
let elapsed = 0;
let lastAlarm = 0;
let shake = 0;
const raycaster = new THREE.Raycaster();

const $ = (id) => document.getElementById(id);
const graphicsQuality = $('graphics-quality');
graphicsQuality.value = QUALITY_PRESETS[qualityPreset] ? qualityPreset : 'high';
graphicsQuality.addEventListener('change', () => {
  localStorage.setItem('jsa-quality', graphicsQuality.value);
  const url = new URL(window.location.href);
  url.searchParams.set('quality', graphicsQuality.value);
  window.location.assign(url);
});
const fadeEl = $('fade');
const musicButton = $('music-toggle');
const musicTrackSelect = $('music-track');
const savedMusicTrack = localStorage.getItem('jsa-track');
if (savedMusicTrack === 'deep-field' || savedMusicTrack === 'space-galaxy-universe') {
  musicTrackSelect.value = savedMusicTrack;
  setMusicTrack(savedMusicTrack);
}
let musicEnabled = localStorage.getItem('jsa-music') !== 'off';
let musicError = null;

function updateMusicButton() {
  musicButton.textContent = musicError ? '♫ MUSIC ERROR' : musicEnabled ? '♫ MUSIC ON' : '♫ MUSIC OFF';
  musicButton.setAttribute('aria-pressed', String(musicEnabled));
  musicButton.setAttribute('aria-label', musicError || (musicEnabled ? 'Turn music off' : 'Turn music on'));
  musicButton.title = musicError || '';
}

function startGameMusic() {
  try {
    startMusic().then(() => {
      musicError = null;
      updateMusicButton();
    }).catch((error) => {
      musicError = 'Music could not be played. Check that the track is available.';
      console.error('Could not start game music:', error);
      updateMusicButton();
    });
  } catch (error) {
    musicError = error.message || 'Music could not be played in this browser.';
    console.error('Could not start game music:', error);
    updateMusicButton();
  }
}

function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  musicError = null;
  localStorage.setItem('jsa-music', enabled ? 'on' : 'off');
  if (enabled) startGameMusic();
  else stopMusic();
  updateMusicButton();
}

window.addEventListener('game-music-error', (event) => {
  musicError = event.detail.message;
  console.error('Could not load game music:', event.detail);
  updateMusicButton();
});

musicButton.addEventListener('click', () => {
  click();
  setMusicEnabled(!musicEnabled);
});
musicTrackSelect.addEventListener('change', () => {
  setMusicTrack(musicTrackSelect.value);
  localStorage.setItem('jsa-track', musicTrackSelect.value);
  musicError = null;
  if (musicEnabled) startGameMusic();
  updateMusicButton();
});
updateMusicButton();
window.addEventListener('pointerdown', (event) => {
  if (musicEnabled) startGameMusic();
}, true);

function fade(opacity, dur = 0.7, cb) {
  fadeEl.style.transition = 'opacity ' + dur + 's ease';
  fadeEl.style.opacity = String(opacity);
  if (cb) setTimeout(cb, dur * 1000);
}

function show(el, on) { el.classList.toggle('hidden', !on); }

const academyIntro = $('academy-intro');
const introCinematic = $('intro-cinematic');
let enteringHangar = false;

function completeHangarEntry() {
  click();
  show($('menu'), true);
  academyIntro.classList.add('is-leaving');
  const exitDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
  setTimeout(() => {
    show(academyIntro, false);
    $('single-player-title').focus();
  }, exitDelay);
}

function enterHangar() {
  if (enteringHangar) return;
  enteringHangar = true;
  if (musicEnabled) startGameMusic();
  const hasCinematicSource = !!(introCinematic && (introCinematic.currentSrc || introCinematic.querySelector('source')?.src));
  if (!hasCinematicSource) {
    completeHangarEntry();
    return;
  }

  let cinematicFinished = false;
  let cinematicFallback = null;
  const endCinematic = () => {
    if (cinematicFinished) return;
    cinematicFinished = true;
    if (cinematicFallback) clearTimeout(cinematicFallback);
    introCinematic.classList.remove('is-playing');
    introCinematic.pause();
    introCinematic.currentTime = 0;
    completeHangarEntry();
  };

  academyIntro.classList.add('is-cinematic');
  introCinematic.classList.add('is-playing');
  introCinematic.currentTime = 0;

  introCinematic.play().catch(() => {
    endCinematic();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTimeout(endCinematic, 150);
    return;
  }

  cinematicFallback = setTimeout(endCinematic, 3000);
  introCinematic.addEventListener('ended', endCinematic, { once: true });
}

$('intro-enter').addEventListener('click', enterHangar);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !academyIntro.classList.contains('hidden')) {
    event.preventDefault();
    enterHangar();
  }
});

function missionClone(m) {
  return {
    ...m,
    env: m.env,
    objectives: m.objectives.map((o) => ({ ...o, progress: 0, done: false }))
  };
}

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  if (musicEnabled) startGameMusic();
  keys[e.code] = true;
  if (e.code === 'KeyE') interactPressed = true;
  if (e.code === 'Enter' && state === 'cockpit' && !$('briefing').classList.contains('hidden')) launch();
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
});

const touchControls = $('touch-controls');
const touchStick = $('touch-stick');
const touchStickKnob = $('touch-stick-knob');
const touchLook = $('touch-look');
const coarsePointer = window.matchMedia('(pointer: coarse)');
const isTouchDevice = () => coarsePointer.matches || navigator.maxTouchPoints > 0;
let stickPointerId = null;
let lookPointerId = null;
let lookX = 0;
let lookY = 0;

function setStickKeys(x, y) {
  keys.KeyW = y < -0.25;
  keys.KeyS = y > 0.25;
  keys.KeyA = x < -0.25;
  keys.KeyD = x > 0.25;
}

function resetStick() {
  stickPointerId = null;
  setStickKeys(0, 0);
  touchStickKnob.style.left = '50%';
  touchStickKnob.style.top = '50%';
}

touchStick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  stickPointerId = e.pointerId;
  touchStick.setPointerCapture(e.pointerId);
  updateStick(e);
});

function updateStick(e) {
  const rect = touchStick.getBoundingClientRect();
  const radius = rect.width * 0.34;
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  const scale = distance > radius ? radius / distance : 1;
  const x = dx * scale / radius;
  const y = dy * scale / radius;
  touchStickKnob.style.left = `${50 + x * 34}%`;
  touchStickKnob.style.top = `${50 + y * 34}%`;
  setStickKeys(x, y);
}

touchStick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickPointerId) return;
  e.preventDefault();
  updateStick(e);
});
touchStick.addEventListener('pointerup', resetStick);
touchStick.addEventListener('pointercancel', resetStick);
touchStick.addEventListener('lostpointercapture', resetStick);

touchLook.addEventListener('pointerdown', (e) => {
  if (lookPointerId !== null) return;
  e.preventDefault();
  lookPointerId = e.pointerId;
  lookX = e.clientX;
  lookY = e.clientY;
  touchLook.setPointerCapture(e.pointerId);
});
touchLook.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPointerId) return;
  e.preventDefault();
  player.yaw -= (e.clientX - lookX) * 0.006;
  player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - lookY) * 0.006, -1.45, 1.45);
  lookX = e.clientX;
  lookY = e.clientY;
});
function resetLook(e) {
  if (e.pointerId === lookPointerId) lookPointerId = null;
}
touchLook.addEventListener('pointerup', resetLook);
touchLook.addEventListener('pointercancel', resetLook);
touchLook.addEventListener('lostpointercapture', resetLook);

$('touch-buttons').querySelectorAll('[data-touch-key]').forEach((button) => {
  const code = button.dataset.touchKey;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys[code] = true;
  });
  const release = () => { keys[code] = false; };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

$('touch-interact').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  interactPressed = true;
});
$('touch-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state !== 'surface') return;
  state = 'paused';
  resetStick();
  $('touch-buttons').querySelectorAll('[data-touch-key]').forEach((button) => {
    keys[button.dataset.touchKey] = false;
  });
  show($('pause'), true);
});

function lockPointer() {
  if (isTouchDevice()) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* pointer lock unavailable */ }
}

canvas.addEventListener('click', () => {
  if (!coarsePointer.matches && (state === 'surface' || state === 'cockpit')) {
    if (document.pointerLockElement !== canvas) lockPointer();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!isTouchDevice() && !locked && (state === 'surface' || state === 'cockpit') && !transitioning && !inChoice) {
    state = 'paused';
    show($('pause'), true);
  }
});

// ---------- menu ----------
let pilotName = localStorage.getItem('jsa-team-name') || 'CADET';
let dashboardMission = null;
let dashboardMissionStatus = 'READY TO FLY';

function updateDashboardSidebar() {
  $('sidebar-player').textContent = pilotName;
  $('sidebar-footer-player').textContent = pilotName;
  $('sidebar-avatar').textContent = pilotName.slice(0, 1).toUpperCase();
  $('sidebar-avatar-small').textContent = pilotName.slice(0, 1).toUpperCase();
  $('sidebar-mission').textContent = dashboardMission?.title || 'No mission selected';
  $('sidebar-mission-world').textContent = dashboardMission?.world || 'Hangar';
  $('sidebar-mission-status').textContent = dashboardMissionStatus;
}

function initializeDashboardProfile() {
  $('team-name').value = pilotName;
  updateDashboardSidebar();
}

document.querySelectorAll('.sidebar-nav-link[href], .sidebar-rail-link[href], .sidebar-logo').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.sidebar-nav-link[href], .sidebar-rail-link[href]').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('href') === link.getAttribute('href'));
    });
  });
});
$('sidebar-guide-btn').addEventListener('click', () => $('guide-btn').click());
$('sidebar-guide-icon').addEventListener('click', () => $('guide-btn').click());

function buildMenu() {
  const singleWrap = $('mission-cards');
  const teamWrap = $('team-mission-cards');
  singleWrap.innerHTML = '';
  teamWrap.innerHTML = '';
  for (const m of MISSIONS) {
    const wrap = m.team ? teamWrap : singleWrap;
    const card = document.createElement('div');
    card.className = 'mcard';
    const best = localStorage.getItem('jsa-best-' + m.id);
    const supportLabel = m.oxygenReserveHours
      ? m.oxygenReserveHours + ' HOUR O2 RESERVE | ' + Math.round(m.env.timeBudget / 60) + ' MIN SIM'
      : Math.round(m.env.timeBudget / 60) + (m.flight ? ' MIN LIFE SUPPORT' : ' MIN O2');
    card.innerHTML =
      '<div class="chip ' + m.chip + '">' + m.world + '</div>' +
      '<h3>' + m.title + '</h3>' +
      '<div class="tag">' + m.tagline + '</div>' +
      (m.team ? '<div class="team-size">2-4 CREW &nbsp;|&nbsp; SOLO-READY</div>' : '') +
      '<p>' + m.brief + '</p>' +
      '<div class="stats">' + (m.flight ? 'SPACECRAFT FLIGHT' : 'GRAVITY ' + m.env.gravity.toFixed(2) + ' m/s2') +
      ' &nbsp;|&nbsp; ' + m.objectives.length + ' OBJECTIVES &nbsp;|&nbsp; ' +
      supportLabel + '</div>' +
      (best ? '<div class="best-score">BEST: ' + best + '</div>' : '');
    card.addEventListener('mouseenter', () => hover());
    card.addEventListener('click', () => {
      click();
      if (m.team && teamNetwork?.room) {
        if (teamNetwork.room.hostId !== teamNetwork.playerId) {
          setTeamError('Only the team leader can select a team mission.');
          return;
        }
        if (!teamNetwork.startMission(m.id)) {
          setTeamError('Could not send mission selection to the team.');
          return;
        }
      }
      startMission(m);
    });
    wrap.appendChild(card);
  }
}

function startMission(m) {
  document.body.classList.add('mission-active');
  dashboardMission = m;
  dashboardMissionStatus = 'MISSION BRIEFING';
  updateDashboardSidebar();
  missionRaw = m;
  mission = missionClone(m);
  lastPoseBroadcast = 0;
  document.body.classList.toggle('flight-mode', !!mission.flight);
  if (world) { world.dispose(); world = null; }
  if (cockpit) { cockpit.dispose(); cockpit = null; }
  systems = null;
  inChoice = false;
  state = 'cockpit';
  transitioning = false;
  show($('menu'), false);
  show($('hud'), false);
  show($('complete'), false);
  show($('pause'), false);
  show($('choice'), false);

  cockpit = new Cockpit(scene, mission);
  starfield.visible = true;
  menuOrbs.visible = false;
  player.yaw = 0;
  player.pitch = 0;

  // briefing overlay
  $('brief-title').textContent = mission.title;
  $('brief-badge').textContent = mission.world;
  $('brief-badge').className = 'brief-badge ' + mission.chip;
  $('brief-text').textContent = mission.brief;
  const ul = $('brief-objectives');
  ul.innerHTML = '';
  for (const o of mission.objectives) {
    const li = document.createElement('li');
    li.textContent = o.label;
    ul.appendChild(li);
  }
  $('brief-env').textContent = mission.oxygenReserveHours
    ? mission.oxygenReserveHours + ' HOUR O2 RESERVE  |  ' + Math.round(mission.env.timeBudget / 60) +
      ' MIN SIMULATION  |  RESTORE POWER AND REPAIR ECLSS'
    : mission.flight
    ? 'SPACECRAFT FLIGHT  |  LIFE SUPPORT ' + Math.round(mission.env.timeBudget / 60) +
      ' MIN  |  WASD THRUST, MOUSE STEER, X BRAKE, E ACTION'
    : 'GRAVITY ' + mission.env.gravity.toFixed(2) + ' m/s2  |  O2 SUPPLY ' +
      Math.round(mission.env.timeBudget / 60) + ' MIN  |  WATCH YOUR SUIT';
  const waitingForLeader = mission.team && teamNetwork?.room && teamNetwork.room.hostId !== teamNetwork.playerId;
  $('launch-btn').disabled = !!waitingForLeader;
  $('launch-btn').textContent = waitingForLeader ? 'WAITING FOR TEAM LEADER' : 'LAUNCH  [ENTER]';
  $('hint').innerHTML = mission.flight
    ? 'WASD THRUST &nbsp; MOUSE STEER &nbsp; SPACE UP &nbsp; C DOWN &nbsp; X BRAKE &nbsp; SHIFT BOOST &nbsp; E ACTION &nbsp; ESC PAUSE'
    : 'WASD move &nbsp; MOUSE look &nbsp; E interact &nbsp; SHIFT run &nbsp; SPACE jump &nbsp; ESC pause';
  show($('briefing'), true);
  // pointer is NOT locked yet: briefing buttons must stay clickable.
  // Lock happens when launch begins.
}

$('launch-btn').addEventListener('click', () => { click(); launch(); });
$('brief-back').addEventListener('click', () => {
  click();
  if (mission?.team && teamNetwork?.room && teamNetwork.room.hostId !== teamNetwork.playerId) {
    hud.toast('Wait for the team leader to return to the hangar.');
    return;
  }
  if (mission?.team && teamNetwork?.room) teamNetwork.abortMission();
  if (cockpit) { cockpit.dispose(); cockpit = null; }
  dashboardMissionStatus = 'READY TO FLY';
  updateDashboardSidebar();
  show($('briefing'), false);
  document.exitPointerLock();
  goMenu();
});
$('resume-btn').addEventListener('click', () => {
  click();
  state = world ? 'surface' : 'cockpit';
  show($('pause'), false);
  if (!isTouchDevice()) lockPointer();
});
$('abort-btn').addEventListener('click', () => {
  click();
  if (mission?.team && teamNetwork?.room && teamNetwork.room.hostId !== teamNetwork.playerId) {
    hud.toast('Only the team leader can abort the shared mission.');
    return;
  }
  if (mission?.team && teamNetwork?.room) teamNetwork.abortMission();
  abortMissionLocally();
});

function abortMissionLocally() {
  dashboardMissionStatus = 'MISSION ABORTED';
  updateDashboardSidebar();
  show($('pause'), false);
  fade(1, 0.5, () => {
    if (world) { world.dispose(); world = null; }
    if (cockpit) { cockpit.dispose(); cockpit = null; }
    goMenu();
    fade(0, 0.8);
  });
}
$('replay-btn').addEventListener('click', () => {
  click();
  if (!missionRaw) return;
  if (missionRaw.team && teamNetwork?.room) {
    if (teamNetwork.room.hostId !== teamNetwork.playerId) {
      hud.toast('The team leader must restart the mission.');
      return;
    }
    teamNetwork.startMission(missionRaw.id);
  }
  show($('complete'), false);
  startMission(missionRaw);
});
$('menu-btn').addEventListener('click', () => { click(); show($('complete'), false); goMenu(); });

let missionRaw = null;
function goMenu() {
  document.body.classList.remove('mission-active');
  state = 'menu';
  document.body.classList.remove('flight-mode');
  transitioning = false;
  systems = null;
  inChoice = false;
  show($('hud'), false);
  show($('briefing'), false);
  show($('pause'), false);
  show($('complete'), false);
  show($('choice'), false);
  show($('menu'), true);
  starfield.visible = true;
  menuOrbs.visible = true;
  buildMenu();
}

function setTeamError(message) {
  const el = $('team-error');
  el.textContent = message;
  show(el, !!message);
}

function renderTeamRoom() {
  const room = teamNetwork?.room;
  const playerId = teamNetwork?.playerId;
  show($('team-connect-controls'), !room);
  show($('team-room'), !!room);
  setTeamError('');
  if (!room) {
    $('team-roster').innerHTML = '';
    syncRemotePlayerRoster();
    return;
  }
  $('team-room-code').textContent = room.code;
  const isHost = room.hostId === playerId;
  $('team-room-status').textContent = isHost
    ? 'You are team leader. Choose a Team Mission below to brief the crew.'
    : 'Waiting for ' + (room.players.find((player) => player.id === room.hostId)?.name || 'team leader') + ' to choose a mission.';
  const roster = $('team-roster');
  roster.innerHTML = '';
  for (const playerInfo of room.players) {
    const li = document.createElement('li');
    li.textContent = playerInfo.name + (playerInfo.id === room.hostId ? ' · LEADER' : '') +
      (playerInfo.id === playerId ? ' (YOU)' : '');
    roster.appendChild(li);
  }
  syncRemotePlayerRoster();
}

function syncRemotePlayerRoster() {
  if (!world?.remotePlayers) return;
  const players = mission?.team ? teamNetwork?.room?.players || [] : [];
  const activeIds = new Set(players.filter((entry) => entry.id !== teamNetwork.playerId).map((entry) => entry.id));
  for (const id of world.remotePlayers.keys()) {
    if (!activeIds.has(id)) world.removeRemotePlayer(id);
  }
  for (const entry of players) {
    if (entry.id !== teamNetwork.playerId) world.addRemotePlayer(entry.id, entry.name);
  }
}

function initializeTeamNetwork() {
  teamNetwork = new TeamNetwork({
    onRoomChanged: renderTeamRoom,
    onDisconnected: () => {
      renderTeamRoom();
      setTeamError('Disconnected from the multiplayer server.');
    },
    onRoomClosed: (message) => {
      renderTeamRoom();
      setTeamError(message);
    },
    onError: setTeamError,
    onStartMission: (missionId) => {
      const selectedMission = MISSIONS.find((entry) => entry.id === missionId && entry.team);
      if (!selectedMission) {
        setTeamError('The team server selected an unknown mission.');
        return;
      }
      startMission(selectedMission);
    },
    onLaunch: () => { launchMissionSequence(); },
    onPose: (pose) => {
      if (!mission?.team) return;
      const name = teamNetwork.room?.players.find((entry) => entry.id === pose.playerId)?.name || 'TEAMMATE';
      world?.addRemotePlayer(pose.playerId, name);
      world?.updateRemotePlayer(pose.playerId, pose);
    },
    onAction: (interactableIndex) => {
      const target = world?.interactables[interactableIndex];
      if (!target || target.done) return;
      target.onInteract();
      if (target.objectiveId) addProgress(target.objectiveId);
    },
    onFinishRequest: () => {
      if (teamNetwork.room?.hostId === teamNetwork.playerId && world?.returnReady) finishMission(null);
    },
    onMissionFinished: () => { finishMission(null, true); },
    onAbortMission: abortMissionLocally
  });

  const savedName = localStorage.getItem('jsa-team-name') || '';
  $('team-name').value = savedName;
  $('team-name').addEventListener('change', () => {
    localStorage.setItem('jsa-team-name', $('team-name').value.trim().slice(0, 20));
  });
  $('team-code').addEventListener('input', () => {
    $('team-code').value = $('team-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  });
  $('team-create-btn').addEventListener('click', () => {
    click();
    const name = $('team-name').value.trim();
    if (!name) return setTeamError('Enter your pilot name to create a team.');
    localStorage.setItem('jsa-team-name', name.slice(0, 20));
    setTeamError('Connecting to the team server…');
    teamNetwork.create(name);
  });
  $('team-join-btn').addEventListener('click', () => {
    click();
    const name = $('team-name').value.trim();
    const code = $('team-code').value.trim().toUpperCase();
    if (!name) return setTeamError('Enter your pilot name before joining.');
    if (code.length !== 6) return setTeamError('Enter the 6-character team code.');
    localStorage.setItem('jsa-team-name', name.slice(0, 20));
    setTeamError('Connecting to the team server…');
    teamNetwork.join(name, code);
  });
  $('team-leave-btn').addEventListener('click', () => {
    click();
    teamNetwork.leave();
  });
}

// ---------- systems guide modal ----------
$('guide-btn').addEventListener('click', () => { click(); show($('guide'), true); });
$('guide-close').addEventListener('click', () => { click(); show($('guide'), false); });

// ---------- launch sequence ----------
let countdownEl = $('countdown');
async function launch() {
  if (state !== 'cockpit' || transitioning) return;
  if (mission.team && teamNetwork?.room) {
    if (teamNetwork.room.hostId !== teamNetwork.playerId) return;
    if (!teamNetwork.launch()) {
      setTeamError('Could not notify the team to launch.');
      return;
    }
  }
  launchMissionSequence();
}

async function launchMissionSequence() {
  if (state !== 'cockpit' || transitioning) return;
  transitioning = true;
  show($('briefing'), false);
  lockPointer(); // user gesture still active
  const nums = [5, 4, 3, 2, 1];
  for (const n of nums) {
    cockpit.setCountdown(n);
    countdownEl.classList.remove('hidden');
    $('countnum').textContent = String(n);
    $('countnum').style.animation = 'none';
    void $('countnum').offsetWidth;
    $('countnum').style.animation = 'countZoom 1s ease';
    countBeep();
    shake = 0.12;
    await sleep(950);
  }
  countGo();
  countdownEl.classList.add('hidden');
  cockpit.setCountdown(0);
  show($('boost'), true);
  state = 'launching';
  shake = 0.5;
  await sleep(2200);
  fade(1, 0.6, async () => {
    // swap scenes
    show($('boost'), false);
    shake = 0;
    cockpit.dispose();
    cockpit = null;
    starfield.visible = false;
    world = mission.flight ? new SpaceflightWorld(scene, mission, camera) : new SurfaceWorld(scene, mission);
    hud.setWorldRef(world);
    syncRemotePlayerRoster();
    systems = mission.habitat ? new BaseSystems(mission.env.habitat) : null;
    hud.showSystemsPanel(!!systems);
    hud.setEventBanner(null);
    spawnPlayer();
    hud.showMission(mission);
    hud.setWorldRef(world);
    hud.toast('Welcome to ' + mission.world + ', cadet! Complete all objectives.', true, 4000);
    state = 'surface';
    dashboardMissionStatus = 'MISSION IN PROGRESS';
    updateDashboardSidebar();
    transitioning = false;
    o2 = 100;
    startTime = performance.now();
    elapsed = 0;
    lastAlarm = 0;
    show($('hud'), true);
    await sleep(100);
    fade(0, 1.4);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function spawnPlayer() {
  if (mission.flight) {
    player.pos.set(0, 0, 0);
    player.vel.set(0, 0, 0);
    player.grounded = false;
    player.moving = false;
    player.yaw = 0;
    player.pitch = 0;
    return;
  }
  const sx = 13, sz = 13;
  const gy = world.heightAt(sx, sz);
  player.pos.set(sx, gy + 1.7, sz);
  player.vel.set(0, 0, 0);
  player.grounded = true;
  // face the lander at origin (forward = -sin(yaw), -cos(yaw))
  player.yaw = Math.atan2(sx, sz);
  player.pitch = -0.15;
}

// ---------- objectives ----------
function addProgress(objId) {
  const obj = mission.objectives.find((o) => o.id === objId);
  if (!obj || obj.done) return;
  obj.progress++;
  hud.setObjectiveProgress(obj.id, obj.progress, obj.target);
  pickupBeep();
  if (obj.progress >= obj.target) {
    obj.done = true;
    hud.completeObjective(obj.id);
    hud.toast('OBJECTIVE COMPLETE - ' + obj.label, true, 3200);
    arpeggio();
    world.dimObjective(obj.id);
    const allDone = mission.objectives.every((o) => o.done);
    if (allDone) {
      world.setReturnReady(true);
      hud.toast(mission.flight ? 'All objectives complete! Return to the orbital station.' : 'All objectives complete! Return to the lander.', true, 4200);
    }
  } else {
    hud.toast(obj.label + ' ' + obj.progress + '/' + obj.target);
  }
}

function findInteractable(obj3d) {
  let o = obj3d;
  while (o) {
    if (o.userData && o.userData.interactable) return o.userData.interactable;
    o = o.parent;
  }
  return null;
}

// ---------- player physics ----------
function updatePlayer(dt) {
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const r = new THREE.Vector3(-f.z, 0, f.x);
  const sprint = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
  const movingInput = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
  const speed = movingInput ? (sprint ? 9.5 : 5.2) : 0;
  let mx = 0, mz = 0;
  if (keys['KeyW']) { mx += f.x; mz += f.z; }
  if (keys['KeyS']) { mx -= f.x; mz -= f.z; }
  if (keys['KeyA']) { mx -= r.x; mz -= r.z; }
  if (keys['KeyD']) { mx += r.x; mz += r.z; }
  const len = Math.hypot(mx, mz) || 1;
  mx /= len; mz /= len;
  player.moving = len > 0 && speed > 0;

  const g = mission.env.gravity;
  player.vel.y -= g * dt;
  player.pos.x += mx * speed * dt;
  player.pos.z += mz * speed * dt;
  player.pos.y += player.vel.y * dt;

  const B = 320;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -B, B);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -B, B);

  const ground = world.heightAt(player.pos.x, player.pos.z);
  if (player.pos.y <= ground + 1.7) {
    player.pos.y = ground + 1.7;
    player.vel.y = 0;
    player.grounded = true;
    if (keys['Space']) player.vel.y = Math.sqrt(2 * g * 1.2);
  } else {
    player.grounded = false;
  }

  if (player.grounded && player.moving) player.bobPhase += dt * speed * 1.55;
  const bob = (player.grounded && player.moving) ? Math.sin(player.bobPhase) * 0.04 * Math.min(1, speed / 5.2) : 0;

  const shX = (Math.random() - 0.5) * 0.06 * shake;
  const shY = (Math.random() - 0.5) * 0.06 * shake;
  camera.position.set(player.pos.x + shX, player.pos.y + bob + shY, player.pos.z);
  camera.rotation.y = player.yaw + shX * 0.5;
  camera.rotation.x = player.pitch + shY * 0.5;
}

function updateFlightPlayer(dt) {
  const forward = new THREE.Vector3(
    -Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * Math.cos(player.pitch)
  );
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const thrust = new THREE.Vector3();
  if (keys['KeyW']) thrust.add(forward);
  if (keys['KeyS']) thrust.sub(forward);
  if (keys['KeyD']) thrust.add(right);
  if (keys['KeyA']) thrust.sub(right);
  if (keys['Space']) thrust.y += 1;
  if (keys['KeyC']) thrust.y -= 1;
  if (thrust.lengthSq() > 1) thrust.normalize();

  const boost = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
  const braking = !!keys['KeyX'];
  player.vel.addScaledVector(thrust, (boost ? 65 : 42) * dt);
  player.vel.multiplyScalar(Math.exp(-(braking ? 3.8 : thrust.lengthSq() ? 0.08 : 0.22) * dt));
  const maxSpeed = boost ? 78 : 48;
  if (player.vel.length() > maxSpeed) player.vel.setLength(maxSpeed);
  player.pos.addScaledVector(player.vel, dt);
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -950, 950);
  player.pos.y = THREE.MathUtils.clamp(player.pos.y, -950, 950);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -1700, 500);
  player.moving = player.vel.lengthSq() > 0.25;

  camera.position.copy(player.pos);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(player.pitch, player.yaw, -THREE.MathUtils.clamp(thrust.dot(right) * 0.08, -0.12, 0.12));
}

// ---------- surface interact ----------
function habitatPrompt(target) {
  if (target.kind === 'power') return systems.powerOnline ? 'Power systems online (' + systems.powerMode + ')' : 'Bring power online';
  if (target.kind === 'eclss') return systems.eclssOnline ? 'Power down ECLSS' : 'Activate life support (ECLSS)';
  if (target.kind === 'shield') {
    if (mission && mission.id === 'mars-radiation-alert') {
      return systems.radiationPlan ? 'Radiation plan active: ' + systems.radiationPlan.toUpperCase() : 'Choose radiation response';
    }
    if (!systems.shieldMode) return 'Deploy radiation shielding';
    return systems.shieldOnline ? 'Power down shielding' : 'Power up shielding';
  }
  if (target.kind === 'food') return systems.foodOnline ? 'Power down hydroponics' : 'Start hydroponics bay';
  return target.label;
}

function handleHabitatInteract(target) {
  switch (target.kind) {
    case 'power':
      if (!systems.powerOnline) openChoice('power');
      else hud.toast('Power generation online: ' + systems.powerMode.toUpperCase());
      break;
    case 'shield':
      if (mission && mission.id === 'mars-radiation-alert') {
        if (!systems.radiationPlan) openChoice('radiation');
        else hud.toast('Radiation plan locked: ' + systems.radiationPlan.toUpperCase());
        break;
      }
      if (!systems.shieldMode) openChoice('shield');
      else {
        systems.shieldOnline = !systems.shieldOnline;
        world.setShieldState(systems.shieldOnline);
        hud.toast(systems.shieldOnline ? 'Radiation shielding powered up' : 'Shielding powered down');
      }
      break;
    case 'eclss':
      if (!systems.eclssOnline) {
        if (!systems.powerOnline) { hud.toast('Bring power online first!'); break; }
        systems.eclssOnline = true;
        world.setEclssState(true);
        addProgress('eclss');
      } else {
        systems.eclssOnline = false;
        world.setEclssState(false);
        hud.toast('ECLSS powered down - recycling stopped');
      }
      break;
    case 'food':
      if (!systems.foodOnline) {
        if (!systems.powerOnline) { hud.toast('Bring power online first!'); break; }
        if (systems.water <= 0) { hud.toast('No water reserves left!'); break; }
        systems.foodOnline = true;
        world.setFoodState(true);
        addProgress('food');
      } else {
        systems.foodOnline = false;
        world.setFoodState(false);
        hud.toast('Hydroponics powered down');
      }
      break;
  }
}

// ---------- system choice modal ----------
const CHOICE_DATA = {
  power: {
    title: 'POWER GENERATION',
    sub: 'Provides: Electricity',
    a: { title: 'SOLAR ARRAY', desc: 'Lightweight and inexpensive, but output collapses during Martian dust storms and the lunar night.', value: 'solar' },
    b: { title: 'NUCLEAR RTG', desc: 'Constant baseline power in any weather - but the heavy reactor costs score (-150 points).', value: 'nuclear' }
  },
  shield: {
    title: 'RADIATION SHIELDING',
    sub: 'Provides: Crew health & safety',
    a: { title: 'REGOLITH MOUND', desc: 'Bury the habitat in local soil. Strong protection but requires rover / equipment power (+10W demand).', value: 'regolith' },
    b: { title: 'WATER WALLS', desc: 'Shield with stored water - no power needed, but the walls slowly drink into your water reserves.', value: 'water' }
  },
  radiation: {
    title: 'RADIATION RESPONSE',
    sub: 'Best protection strategy for the incoming surge',
    a: { title: 'SHELTER IN PLACE', desc: 'Keep the crew in the habitat, conserve power, and ride out the wave with limited risk but tighter resource use.', value: 'shelter' },
    b: { title: 'BURROW IN DEEP', desc: 'Dig below the surface to minimize exposure. Safer during the spike, but the habitat loses mobility and uses more power to maintain the sealed air loop.', value: 'burrow' }
  }
};

function openChoice(kind) {
  const data = CHOICE_DATA[kind];
  if (!data) return;
  inChoice = true;
  $('choice-title').textContent = data.title;
  $('choice-sub').textContent = data.sub;
  $('choice-a-title').textContent = data.a.title;
  $('choice-a-desc').textContent = data.a.desc;
  $('choice-b-title').textContent = data.b.title;
  $('choice-b-desc').textContent = data.b.desc;
  show($('choice'), true);
  document.exitPointerLock();
}

function closeChoice() {
  inChoice = false;
  show($('choice'), false);
  if (state === 'surface') lockPointer();
}

$('choice-a-btn').addEventListener('click', () => {
  click();
  const kind = $('choice-title').textContent === 'POWER GENERATION' ? 'power' : $('choice-title').textContent === 'RADIATION RESPONSE' ? 'radiation' : 'shield';
  applyChoice(kind, 'a');
});
$('choice-b-btn').addEventListener('click', () => {
  click();
  const kind = $('choice-title').textContent === 'POWER GENERATION' ? 'power' : $('choice-title').textContent === 'RADIATION RESPONSE' ? 'radiation' : 'shield';
  applyChoice(kind, 'b');
});

function applyChoice(kind, side) {
  const data = CHOICE_DATA[kind];
  const opt = side === 'a' ? data.a : data.b;
  if (kind === 'power') {
    systems.powerMode = opt.value;
    systems.powerOnline = true;
    if (opt.value === 'nuclear') systems.scoreBonus -= 150;
    world.applyPowerChoice(opt.value);
    addProgress('power');
    hud.toast(opt.value === 'solar' ? 'Solar array online - watch the weather' : 'Nuclear RTG online - constant power', true);
  } else if (kind === 'radiation') {
    systems.radiationPlan = opt.value;
    systems.shieldMode = opt.value === 'burrow' ? 'regolith' : 'water';
    systems.shieldOnline = true;
    if (opt.value === 'shelter') world.applyRadiationShelter();
    else world.applyShieldChoice(systems.shieldMode);
    addProgress('shield');
    hud.toast(opt.value === 'burrow' ? 'Burrow plan set: deep shielding engaged' : 'Shelter plan set: stay in place and conserve power', true);
  } else {
    systems.shieldMode = opt.value;
    systems.shieldOnline = true;
    world.applyShieldChoice(opt.value);
    addProgress('shield');
    hud.toast(opt.value === 'regolith' ? 'Regolith shielding deployed' : 'Water wall shielding active', true);
  }
  closeChoice();
}

// ---------- surface interact ----------
function updateInteract() {
  if (!world) return;
  if (mission.flight) {
    updateFlightInteract();
    return;
  }
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 3.4;
  const hits = raycaster.intersectObjects(world.interactMeshes, true);
  let target = null;
  for (const h of hits) {
    const entry = findInteractable(h.object);
    if (entry && !entry.done) { target = entry; break; }
  }
  if (target) {
    const label = systems ? habitatPrompt(target) : target.label;
    hud.showPrompt('[E] ' + label);
    if (interactPressed) {
      interactPressed = false;
      if (target.kind === 'return') {
        if (world.returnReady) {
          finishMission(null);
        } else {
          hud.toast('Complete all objectives first!', false, 2200);
        }
      } else if (systems) {
        handleHabitatInteract(target);
      } else {
        const interactableIndex = world.interactables.indexOf(target);
        target.onInteract();
        if (target.objectiveId) addProgress(target.objectiveId);
        if (mission.team && teamNetwork?.room && interactableIndex >= 0) {
          teamNetwork.sendAction(interactableIndex);
        }
      }
    }
  } else {
    hud.showPrompt(null);
  }
  interactPressed = false;
}

function updateFlightInteract() {
  const nearby = world.nearestTarget(player.pos, 28);
  if (nearby) {
    const labels = {
      satellite: 'Repair satellite',
      cargo: 'Recover supply pod',
      asteroid: 'Scan asteroid',
      capsule: 'Recover pilot or probe',
      relay: 'Repair relay buoy',
      beacon: 'Deploy navigation beacon',
      sample: 'Collect ice sample'
    };
    hud.showPrompt('[E] ' + labels[nearby.target.kind]);
    if (interactPressed) {
      world.completeTarget(nearby.target);
      addProgress(nearby.target.objectiveId);
      if (nearby.target.kind === 'capsule') hud.toast('Pilot secured - return to the station!', true);
    }
  } else if (player.pos.distanceTo(world.landerPos) < 30) {
    hud.showPrompt('[E] Return to orbital station');
    if (interactPressed) {
      if (world.returnReady) finishMission(null);
      else hud.toast('Complete all mission objectives first!', false, 2200);
    }
  } else {
    hud.showPrompt(null);
  }
  interactPressed = false;
}

// ---------- mission end ----------
function finishMission(reason, fromNetwork = false) { // reason: null | 'oxygen' | 'crew'
  if (transitioning || state !== 'surface') return;
  if (mission.team && teamNetwork?.room && !fromNetwork && reason === null) {
    if (teamNetwork.room.hostId !== teamNetwork.playerId) {
      teamNetwork.requestFinish();
      return;
    }
    teamNetwork.finishMission();
  }
  transitioning = true;
  state = 'complete';
  dashboardMissionStatus = reason ? 'MISSION FAILED' : 'MISSION COMPLETE';
  updateDashboardSidebar();
  document.exitPointerLock();
  hud.showPrompt(null);
  hud.setAlarm(false);
  hud.setEventBanner(null);

  const objectivesDone = mission.objectives.filter((o) => o.done).length;
  const totalObjectives = mission.objectives.length;
  const timeLeft = Math.max(0, mission.env.timeBudget - elapsed);
  const sysBonus = systems ? Math.round(systems.crew * 2) + systems.scoreBonus : 0;
  const score = Math.max(0, Math.round(objectivesDone * 500 + timeLeft * 1.5 + o2 * 2.5 + sysBonus));
  const maxScore = totalObjectives * 500 + mission.env.timeBudget * 1.5 + 250 + (systems ? 200 : 0);
  const ratio = score / maxScore;
  const starCount = reason ? 1 : (ratio >= 0.72 ? 3 : ratio >= 0.5 ? 2 : 1);

  const bestKey = 'jsa-best-' + mission.id;
  const prevBest = Number(localStorage.getItem(bestKey)) || 0;
  const isBest = score > prevBest;
  if (isBest) localStorage.setItem(bestKey, String(score));

  const titles = { null: 'MISSION COMPLETE', oxygen: 'OXYGEN DEPLETED', crew: 'CREW DOWN' };
  $('complete-title').textContent = titles[reason || 'null'];
  $('complete-title').style.background = reason
    ? 'linear-gradient(90deg,#ff5566,#ffb64d)'
    : 'linear-gradient(90deg,#4de3ff,#a78bfa)';
  $('complete-title').style.webkitBackgroundClip = 'text';
  $('complete-title').style.backgroundClip = 'text';
  $('complete-title').style.color = 'transparent';

  const starsEl = $('stars');
  starsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = i < starCount ? 'on' : 'off';
    s.textContent = '★';
    starsEl.appendChild(s);
  }
  const mm = Math.floor(elapsed / 60), ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  const crewLine = systems ? ' &nbsp;|&nbsp; crew <b>' + Math.round(systems.crew) + '%</b>' : '';
  $('stats').innerHTML =
    '<b>' + objectivesDone + '/' + totalObjectives + '</b> objectives &nbsp;|&nbsp; time <b>' + mm + ':' + ss + '</b>' +
    ' &nbsp;|&nbsp; O2 left <b>' + Math.round(o2) + '%</b>' + crewLine + '<br>SCORE <b>' + score + '</b>';
  $('best').textContent = isBest ? 'NEW RECORD!' : 'BEST SCORE: ' + prevBest;

  fade(1, 0.7, () => {
    show($('hud'), false);
    show($('complete'), true);
    fade(0, 0.9);
    arpeggio();
    transitioning = false;
  });
}

// ---------- menu camera ----------
function updateMenuCamera(t) {
  const a = t * 0.07;
  camera.position.set(Math.cos(a) * 30, 9 + Math.sin(t * 0.3) * 2, Math.sin(a) * 30);
  camera.lookAt(0, 1, 0);
  starfield.rotation.y += 0.0004;
  for (const sp of menuOrbs.children) {
    const u = sp.userData;
    u.a += u.speed * 0.016;
    sp.position.x = Math.cos(u.a) * u.r;
    sp.position.z = Math.sin(u.a) * u.r;
    sp.position.y = u.yBase + Math.sin(t * 0.8 + u.a) * u.yAmp;
    sp.material.color.setHSL((t * 0.05 + u.a) % 1, 1, 0.6);
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let t = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  touchControls.classList.toggle('hidden', !isTouchDevice() || state !== 'surface');

  if (state === 'menu') {
    updateMenuCamera(t);
  } else if (state === 'cockpit') {
    cockpit.update(dt, t);
    // Rear-cabin view keeps the cockpit layout visible before launch.
    camera.position.set(0, 1.65, 3.2);
    camera.rotation.y = player.yaw + (Math.random() - 0.5) * 0.05 * shake;
    camera.rotation.x = player.pitch + (Math.random() - 0.5) * 0.05 * shake;
    shake *= 0.94;
    starfield.rotation.y += dt * 0.005;
  } else if (state === 'launching') {
    if (cockpit) cockpit.update(dt, t);
    camera.position.set(0, 1.65, 3.2);
    camera.rotation.y = player.yaw + (Math.random() - 0.5) * 0.1 * shake;
    camera.rotation.x = player.pitch + (Math.random() - 0.5) * 0.1 * shake;
    starfield.rotation.y += dt * 0.05;
  } else if (state === 'surface') {
    elapsed += dt;
    if (mission.flight) {
      updateFlightPlayer(dt);
      world.update(dt, t, player, o2);
    } else {
      updatePlayer(dt);
      world.update(dt, t, player, player.moving && player.grounded);
    }
    updateInteract();

    // habitat core systems
    if (systems) {
      systems.update(dt);
      if (systems.stormJustEnded) {
        systems.stormJustEnded = false;
        world.setStorm(false);
        addProgress('storm');
        hud.toast(mission.env.habitat.stormName + ' has passed - systems nominal', true, 3600);
      }
      if (systems.spikeJustStarted) {
        hud.toast('WARNING: radiation spike detected!', false, 2800);
        alarmBeep();
      }
      if (systems.stormActive && mission.env.habitat.stormName === 'DUST STORM') world.setStorm(true);
      hud.setEventBanner(systems.eventBanner());
      hud.updateSystems(systems);
      if (systems.crew <= 0) {
        hud.setAlarm(false);
        finishMission('crew');
      }
    }

    // oxygen
    const drainRate = 100 / (mission.env.timeBudget * (mission.flight ? 1 : 0.75));
    let o2Mult = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.6 : 1;
    if (systems) o2Mult *= systems.o2Multiplier();
    o2 -= drainRate * dt * o2Mult;
    if (o2 <= 0) {
      o2 = 0;
      hud.setAlarm(false);
      finishMission('oxygen');
    }
    const lowCrew = systems && systems.crew < 30;
    if (o2 < 25 || lowCrew) {
      hud.setAlarm(true);
      if (t - lastAlarm > 2.2) { alarmBeep(); lastAlarm = t; }
    } else {
      hud.setAlarm(false);
    }

    const bearing = ((-player.yaw) * 180 / Math.PI % 360 + 360) % 360;
    const speed = mission.flight
      ? player.vel.length()
      : player.moving ? ((keys['ShiftLeft'] || keys['ShiftRight']) ? 9.5 : 5.2) : 0;
    hud.update(o2, mission.env.timeBudget - elapsed, player.pos, speed, bearing);
    if (mission.team && teamNetwork?.room) {
      lastPoseBroadcast += dt;
      if (lastPoseBroadcast >= 0.08) {
        teamNetwork.sendPose(player.pos, player.yaw, player.pitch);
        lastPoseBroadcast = 0;
      }
    }
  } else if (state === 'paused' || state === 'complete') {
    // render only, no updates
  }

  renderer.render(scene, camera);
}

// ---------- boot ----------
hud = new HUD();
initializeTeamNetwork();
initializeDashboardProfile();
buildMenu();
$('pause').querySelectorAll('.btn').forEach((b) => b.addEventListener('mouseenter', () => hover()));
loop();

// debug hook (used by automated verification)
window.__jsa = {
  get player() { return player; },
  get world() { return world; },
  get state() { return state; },
  get mission() { return mission; },
  get systems() { return systems; },
  get teamNetwork() { return teamNetwork; }
};
