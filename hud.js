// ============================================================
// Dashboard HUD: objectives, O2, timer, compass, minimap, toasts
// ============================================================
import { OBJECTIVE_HUES } from './mission.js?v=mission-pack-2';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      missionTitle: document.getElementById('mission-title'),
      objectives: document.getElementById('objectives'),
      o2: document.getElementById('o2fill'),
      timer: document.getElementById('timer'),
      coords: document.getElementById('coords'),
      speed: document.getElementById('speed'),
      compass: document.getElementById('compass'),
      minimap: document.getElementById('minimap'),
      interact: document.getElementById('interact'),
      toast: document.getElementById('toast'),
      vignette: document.getElementById('vignette'),
      boost: document.getElementById('boost'),
      sysPanel: document.getElementById('hud-systems'),
      sysPwr: document.getElementById('sys-pwr'),
      sysPwrTxt: document.getElementById('sys-pwr-txt'),
      sysH2o: document.getElementById('sys-h2o'),
      sysH2oTxt: document.getElementById('sys-h2o-txt'),
      sysFood: document.getElementById('sys-food'),
      sysFoodTxt: document.getElementById('sys-food-txt'),
      sysCrew: document.getElementById('sys-crew'),
      sysCrewTxt: document.getElementById('sys-crew-txt'),
      sysStatus: document.getElementById('sys-status'),
      sysWarning: document.getElementById('sys-warning'),
      eventBanner: document.getElementById('event-banner')
    };
    this.compassCtx = this.el.compass.getContext('2d');
    this.mapCtx = this.el.minimap.getContext('2d');
    this.worldRef = null;
    this.toastTimer = null;
    this.hue = 0;
  }

  showMission(mission) {
    this.el.missionTitle.textContent = mission.title + ' - ' + mission.world;
    this.el.objectives.innerHTML = '';
    for (const o of mission.objectives) {
      const li = document.createElement('li');
      li.id = 'obj-' + o.id;
      li.textContent = o.label + ' 0/' + o.target;
      this.el.objectives.appendChild(li);
    }
    this.el.o2.style.width = '100%';
    this.el.o2.className = '';
    this.el.vignette.className = '';
    this.el.timer.textContent = '00:00';
    this.worldRef = null;
  }

  setObjectiveProgress(objId, p, target) {
    const li = document.getElementById('obj-' + objId);
    if (li) li.textContent = this.objLabel(objId, p, target);
  }

  objLabel(objId, p, target) {
    const li = document.getElementById('obj-' + objId);
    if (!li) return '';
    const base = li.textContent.replace(/ \d+\/\d+$/, '');
    return base + ' ' + p + '/' + target;
  }

  completeObjective(objId) {
    const li = document.getElementById('obj-' + objId);
    if (li) li.classList.add('done');
  }

  update(o2, timeLeft, pos, speed, bearing) {
    // O2
    const fill = this.el.o2;
    fill.style.width = Math.max(0, o2) + '%';
    fill.className = o2 < 15 ? 'crit' : o2 < 30 ? 'low' : '';
    // time
    const t = Math.max(0, Math.ceil(timeLeft));
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    this.el.timer.textContent = mm + ':' + ss;
    this.el.coords.textContent = pos.x.toFixed(0) + ' | ' + pos.z.toFixed(0);
    this.el.speed.textContent = 'SPD ' + speed.toFixed(1) + ' m/s';
    this.drawCompass(bearing);
    this.drawMinimap(pos, bearing);
  }

  drawCompass(bearingDeg) {
    const ctx = this.compassCtx;
    const w = 360, h = 34;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(3,8,16,0.6)';
    ctx.fillRect(0, 0, w, h);
    const center = w / 2;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let deg = 0; deg < 360; deg += 15) {
      const x = ((deg - bearingDeg) % 360 + 360) % 360 * 4 - 360 + center;
      if (x < -20 || x > w + 20) continue;
      const major = deg % 45 === 0;
      ctx.strokeStyle = major ? 'rgba(120,230,255,0.9)' : 'rgba(120,200,240,0.4)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, major ? 6 : 12);
      ctx.lineTo(x, major ? 16 : 18);
      ctx.stroke();
      if (labels[deg]) {
        ctx.fillStyle = 'rgba(180,240,255,0.95)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[deg], x, 32);
      }
    }
    // center marker
    ctx.fillStyle = '#ff3b9d';
    ctx.fillRect(center - 1, 0, 2, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(bearingDeg)).padStart(3, '0') + ' deg', center, h - 4);
  }

  setWorldRef(world) { this.worldRef = world; }

  drawMinimap(playerPos, bearingDeg) {
    const ctx = this.mapCtx;
    const w = 170, h = 170;
    const S = this.worldRef?.mapScale ?? 0.27;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(3,10,20,0.78)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(77,227,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const p = i * (w / 6);
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
    const cx = w / 2, cy = h / 2;

    // beacons
    if (this.worldRef) {
      for (const b of this.worldRef.beaconList) {
        if (b.done || b.dead) continue;
        const bx = cx + (b.pos.x - playerPos.x) * S;
        const by = cy + (b.pos.z - playerPos.z) * S;
        if (bx < -6 || bx > w + 6 || by < -6 || by > h + 6) continue;
        const hue = b.hue ?? OBJECTIVE_HUES.return;
        const col = 'hsl(' + Math.round(hue * 360) + ',100%,65%)';
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(bx, by, b.objId === 'return' ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // lander
      const lx = cx + (this.worldRef.landerPos.x - playerPos.x) * S;
      const ly = cy + (this.worldRef.landerPos.z - playerPos.z) * S;
      ctx.fillStyle = this.worldRef.returnReady ? '#39ff8e' : '#e8f4ff';
      ctx.fillRect(lx - 3, ly - 3, 6, 6);
      ctx.strokeStyle = this.worldRef.returnReady ? '#39ff8e' : '#e8f4ff';
      ctx.strokeRect(lx - 5, ly - 5, 10, 10);
    }

    // player arrow (north = -z = up on the map)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bearingDeg * Math.PI / 180);
    ctx.fillStyle = '#4de3ff';
    ctx.shadowColor = '#4de3ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  showPrompt(text) {
    const el = this.el.interact;
    if (text) {
      el.innerHTML = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  toast(text, good = false, ms = 2800) {
    const el = this.el.toast;
    el.textContent = text;
    el.className = good ? 'good' : '';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  setAlarm(on) {
    this.el.vignette.className = on ? 'alarm' : '';
  }

  showSystemsPanel(on) {
    if (this.el.sysPanel) this.el.sysPanel.classList.toggle('hidden', !on);
  }

  updateSystems(s) {
    const supply = s.supply(), demand = s.demand();
    const pwrPct = supply > 0 ? Math.min(100, (supply / 60) * 100) : 0;
    this.el.sysPwr.style.width = pwrPct + '%';
    this.el.sysPwr.className = demand > supply ? 'bad' : '';
    this.el.sysPwrTxt.textContent = supply + '/' + demand + 'W';
    this.el.sysH2o.style.width = s.water + '%';
    this.el.sysH2o.className = s.water < 25 ? 'bad' : '';
    this.el.sysH2oTxt.textContent = Math.round(s.water) + '%';
    this.el.sysFood.style.width = s.foodStock + '%';
    this.el.sysFood.className = s.foodStock < 25 ? 'bad' : '';
    this.el.sysFoodTxt.textContent = Math.round(s.foodStock) + '%';
    this.el.sysCrew.style.width = s.crew + '%';
    this.el.sysCrew.className = s.crew < 35 ? 'bad' : '';
    this.el.sysCrewTxt.textContent = Math.round(s.crew) + '%';
    const pwr = s.powerOnline ? s.powerMode.toUpperCase() : 'OFFLINE';
    const eclss = s.eclssOnline ? 'ON' : 'OFF';
    const shield = s.shieldMode ? (s.shieldMode === 'regolith' ? 'REGOLITH' : 'WATER') : 'NONE';
    const hydro = s.foodOnline ? 'ON' : 'OFF';
    this.el.sysStatus.textContent =
      'PWR:' + pwr + '  ECLSS:' + eclss + '  SHIELD:' + shield + '  HYDRO:' + hydro;
    this.el.sysWarning.classList.toggle('hidden', !s.brownout);
  }

  setEventBanner(evt) {
    const el = this.el.eventBanner;
    if (!evt) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = evt.text;
    el.className = evt.kind;
  }
}
