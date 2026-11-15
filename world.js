// ============================================================
// Surface world: terrain, sky, celestial bodies, props,
// RGB beacons, particles and interactables
// ============================================================
import * as THREE from 'three';
import { makeFbm, mulberry32 } from './noise.js';
import { OBJECTIVE_HUES, INTERACT_LABELS } from './mission.js?v=mission-pack-2';

// ---------- procedural textures ----------
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(220,235,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePlanetTexture(kind, rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'earth') {
    ctx.fillStyle = '#0a3d7a';
    ctx.fillRect(0, 0, 256, 128);
    const cols = ['#2e7d32', '#558b2f', '#8d6e63', '#33691e'];
    for (let i = 0; i < 16; i++) {
      const x = rng() * 256, y = 36 + rng() * 70, r = 8 + rng() * 26;
      ctx.fillStyle = cols[(rng() * cols.length) | 0];
      ctx.beginPath();
      ctx.ellipse(x, y, r * (0.7 + rng() * 0.8), r * 0.7, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 26; i++) {
      const x = rng() * 256, y = 18 + rng() * 96, r = 3 + rng() * 12;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.9, r * 0.55, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(240,248,255,0.9)';
    ctx.fillRect(0, 0, 256, 10);
    ctx.fillRect(0, 118, 256, 10);
  } else {
    ctx.fillStyle = kind === 'icy' ? '#9fb4c8' : '#8a7d72';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 130; i++) {
      const x = rng() * 256, y = rng() * 128, r = 1 + rng() * 7;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- starfield used on menu + through cockpit window ----------
export function createStarfield(count = 1400, radius = 700, opacity = 1) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.75 + Math.random() * 0.35));
    pos[i * 3] = v.x; pos[i * 3 + 1] = Math.abs(v.y) * 0.9 + radius * 0.08; pos[i * 3 + 2] = v.z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: makeStarTexture(),
    size: 2.4, sizeAttenuation: true,
    transparent: true, opacity,
    depthWrite: false, fog: false
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'starfield';
  return pts;
}

// ============================================================
export class SurfaceWorld {
  constructor(scene, mission) {
    this.scene = scene;
    this.mission = mission;
    this.env = mission.env;
    this.rng = mulberry32(mission.seed);
    this.fbm = makeFbm(mission.seed);
    this.group = new THREE.Group();
    this.interactables = [];      // { mesh, kind, label, objectiveId, done, onInteract }
    this.beaconList = [];         // for minimap { pos, hue, objId }
    this.animators = [];          // fn(dt, t) -> true when finished
    this.dustPool = [];
    this.returnReady = false;
    this.rover = null;
    this.remotePlayers = new Map();

    this.buildTerrain();
    this.buildSky();
    this.buildProps();
    this.buildLander();
    this.buildDust();
    scene.add(this.group);
  }

  // ---------- terrain ----------
  heightAt(x, z) {
    const e = this.env;
    let h = (this.fbm(x * 0.008, z * 0.008, 5) - 0.5) * 22
          + (this.fbm(x * 0.03, z * 0.03, 2) - 0.5) * 5 - 3;
    for (const c of e.craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      h -= c.depth * Math.exp(-(d * d) / (c.r * c.r * 0.55));
    }
    return Math.max(h, -9);
  }

  buildTerrain() {
    const e = this.env;
    const size = 780, seg = 165;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(e.groundA), cB = new THREE.Color(e.groundB), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = this.fbm(x * 0.05 + 13.7, z * 0.05 + 7.3, 3);
      const t = THREE.MathUtils.clamp((h + 9) / 24, 0, 1);
      tmp.copy(cA).lerp(cB, t);
      tmp.offsetHSL(0, 0, (n - 0.5) * 0.05);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.04 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.group.add(this.terrain);
  }

  // ---------- sky / lights / celestial bodies ----------
  buildSky() {
    const e = this.env;
    this.scene.background = new THREE.Color(e.sky);
    this.scene.fog = new THREE.Fog(e.sky, 110, 430);

    // sun light
    const dir = new THREE.Vector3(...e.sunPos).normalize();
    this.sunLight = new THREE.DirectionalLight(e.sunColor, e.sunIntensity);
    this.sunLight.position.copy(dir).multiplyScalar(300);
    this.sunLight.castShadow = true;
    const shadowSize = this.scene.userData.shadowMapSize || 2048;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sunLight.shadow.camera;
    sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150;
    sc.near = 40; sc.far = 640;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.target.position.set(0, 0, 0);
    this.group.add(this.sunLight, this.sunLight.target);

    // sun disc + glow
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(e.sunSize, 24, 24),
      new THREE.MeshBasicMaterial({ color: e.sunColor, fog: false })
    );
    sun.position.copy(dir).multiplyScalar(1500);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: e.sunColor,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    glow.position.copy(dir).multiplyScalar(1500);
    glow.scale.set(e.sunSize * 9, e.sunSize * 9, 1);
    this.group.add(sun, glow);

    // ambient bounce
    this.hemi = new THREE.HemisphereLight(e.hemiSky, e.hemiGround, e.hemiIntensity);
    this.group.add(this.hemi);

    // stars
    if (e.stars > 0.01) {
      this.stars = createStarfield(1500, 850, e.stars);
      this.group.add(this.stars);
    }

    // celestial bodies
    for (const b of e.bodies || []) {
      const rng = mulberry32(this.mission.seed + b.pos[0] | 0);
      const tex = makePlanetTexture(b.kind, rng);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(b.scale, 48, 48),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, fog: false })
      );
      mesh.position.set(...b.pos);
      this.group.add(mesh);
    }
  }

  // ---------- beacons (RGB light pillars) ----------
  createBeacon(x, z, hue, objId, h = 46) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    const col = new THREE.Color().setHSL(hue, 1, 0.6);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.4, h, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    cyl.position.y = h / 2 - 5;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
    );
    core.position.y = 2.2;
    g.add(cyl, core);
    g.position.set(x, y + 0.2, z);
    this.group.add(g);
    const beacon = { group: g, cyl, core, hue, objId, pulse: this.rng() * Math.PI * 2, fading: false, fadeT: 0, dead: false };
    const entry = { pos: new THREE.Vector3(x, y, z), hue, objId };
    beacon.listEntry = entry;
    this.beaconList.push(entry);
    return beacon;
  }

  dimObjective(objId) {
    for (const b of this.beaconList) {
      if (b.objId === objId) b.done = true;
    }
    for (const b of this.beacons || []) {
      if (b.objId === objId) { b.fading = true; b.fadeT = 0; }
    }
  }

  addRemotePlayer(id, name) {
    if (this.remotePlayers.has(id)) return;
    const group = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({
      color: 0x63d9ff,
      emissive: 0x12415c,
      emissiveIntensity: 0.65,
      roughness: 0.55,
      metalness: 0.2
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x253647, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.72, 4, 8), suit);
    torso.position.y = 1.05;
    torso.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xa8efff, emissive: 0x28718b, emissiveIntensity: 0.55, metalness: 0.4 })
    );
    visor.position.set(0, 1.85, -0.06);
    visor.castShadow = true;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.24), dark);
    pack.position.set(0, 1.05, 0.34);
    pack.castShadow = true;

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d');
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2, 10, 20, 0.78)';
    ctx.fillRect(8, 8, 240, 48);
    ctx.strokeStyle = '#63d9ff';
    ctx.strokeRect(8, 8, 240, 48);
    ctx.fillStyle = '#eafaff';
    const label = name.length > 18 ? name.slice(0, 18) : name;
    ctx.fillText(label, 128, 41, 220);
    const texture = new THREE.CanvasTexture(labelCanvas);
    const nameTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    nameTag.position.set(0, 2.55, 0);
    nameTag.scale.set(2.8, 0.7, 1);
    group.add(torso, visor, pack, nameTag);
    this.group.add(group);
    this.remotePlayers.set(id, { group, label: name });
  }

  updateRemotePlayer(id, pose) {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    remote.group.position.set(pose.x, pose.y - 1.7, pose.z);
    remote.group.rotation.y = pose.yaw;
  }

  removeRemotePlayer(id) {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    this.group.remove(remote.group);
    remote.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (!object.material) return;
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    this.remotePlayers.delete(id);
  }

  // ---------- props ----------
  pickSpot(minD = 22, maxD = 250) {
    for (let tries = 0; tries < 40; tries++) {
      const a = this.rng() * Math.PI * 2;
      const d = minD + this.rng() * (maxD - minD);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x, z) < 18) continue; // keep clear of lander
      let ok = true;
      for (const s of this.spots) {
        if (Math.hypot(x - s.x, z - s.z) < 20) { ok = false; break; }
      }
      if (ok) { this.spots.push({ x, z }); return { x, z }; }
    }
    return { x: minD, z: minD };
  }

  buildProps() {
    this.spots = [];
    this.beacons = [];
    this.interactMeshes = [];
    const e = this.env;

    // scattered boulders
    const rockCount = 16;
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: e.rockColor, roughness: 0.92, metalness: 0.05, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < rockCount; i++) {
      const s = this.pickSpot(25, 265);
      const sc = 0.6 + this.rng() * 1.9;
      q.setFromAxisAngle(up, this.rng() * Math.PI * 2);
      m.compose(
        new THREE.Vector3(s.x, this.heightAt(s.x, s.z) + sc * 0.3, s.z),
        q, new THREE.Vector3(sc, sc * (0.7 + this.rng() * 0.5), sc)
      );
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.group.add(rocks);

    if (this.mission.habitat) {
      this.buildHabitat();
      return;
    }

    // objective props
    for (const obj of this.mission.objectives) {
      for (let i = 0; i < obj.target; i++) {
        if (obj.type === 'collect') this.createSample(obj, i);
        else if (obj.type === 'repair') this.createRepairTarget(obj, i);
        else if (obj.type === 'plant') this.createPlantTarget(obj);
        else if (obj.type === 'deploy') this.createDeploySite(obj, i);
        else if (obj.type === 'fix') this.createRover(obj);
      }
    }
  }

  registerInteract(mesh, kind, label, objectiveId, onInteract) {
    const entry = { mesh, kind, label, objectiveId, done: false, onInteract };
    mesh.userData.interactable = entry;
    this.interactables.push(entry);
    this.interactMeshes.push(mesh);
    return entry;
  }

  createSample(obj, i) {
    const isCrystal = obj.collectKind === 'crystal';
    const s = this.pickSpot(24, 235);
    const y = this.heightAt(s.x, s.z);
    const g = new THREE.Group();
    const mat = isCrystal
      ? new THREE.MeshStandardMaterial({ color: 0xd08cff, emissive: 0xb44aff, emissiveIntensity: 1.4, roughness: 0.3 })
      : new THREE.MeshStandardMaterial({ color: 0xd9a05e, emissive: 0x5a3a10, emissiveIntensity: 0.55, roughness: 0.5 });
    const mesh = new THREE.Mesh(isCrystal ? new THREE.OctahedronGeometry(0.4, 0) : new THREE.IcosahedronGeometry(0.34, 1), mat);
    mesh.position.y = 0.9;
    mesh.castShadow = true;
    g.add(mesh);
    g.position.set(s.x, y, s.z);
    this.group.add(g);

    const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.collect, obj.id);
    this.beacons.push(beacon);

    const entry = this.registerInteract(mesh, 'collect',
      isCrystal ? 'Collect glowing crystal' : 'Collect sample', obj.id, () => {
        entry.done = true;
        mesh.visible = false;
        beacon.fading = true;
        beacon.listEntry.done = true;
        this.burst(new THREE.Vector3(s.x, y + 0.9, s.z), isCrystal ? 0xd08cff : 0xffb64d, 14);
      });
    this.animators.push((dt, t) => {
      if (entry.done) return true;
      mesh.rotation.y += dt * 1.4;
      mesh.position.y = 0.9 + Math.sin(t * 2 + i) * 0.12;
      if (isCrystal) mat.emissiveIntensity = 1.2 + Math.sin(t * 3 + i) * 0.5;
      return false;
    });
  }

  createRepairTarget(obj, i) {
    const isRelay = obj.repairKind === 'relay';
    const s = this.pickSpot(24, 240);
    const y = this.heightAt(s.x, s.z);
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.3 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a626e, roughness: 0.6, metalness: 0.5 });

    if (isRelay) {
      // comm relay: mast + dish + control box
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8), frameMat);
      mast.position.y = 1.7;
      mast.castShadow = true;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.4), dark);
      box.position.y = 0.5;
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.2, 0.35, 12), dark);
      dish.position.set(0, 3.2, 0.15);
      dish.rotation.x = -0.4;
      g.add(mast, box, dish);
      g.position.set(s.x, y, s.z);
      this.group.add(g);

      const entry = this.registerInteract(box, 'repair', 'Repair comm relay', obj.id, () => {
        entry.done = true;
        dark.color.set('#3d4a5c');
        dish.material = new THREE.MeshStandardMaterial({ color: 0x9adcff, emissive: 0x33aaff, emissiveIntensity: 1.6, roughness: 0.3 });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x55ff99 }));
        led.position.set(0, 3.35, 0.15);
        g.add(led);
        beacon.fading = true;
        beacon.listEntry.done = true;
      });
      const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.repair, obj.id);
      this.beacons.push(beacon);
      this.animators.push((dt, t) => {
        if (entry.done) return true;
        g.rotation.y += dt * 0.3;
        return false;
      });
    } else {
      // solar panel array
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.9, 8), frameMat);
      mast.position.y = 0.95;
      mast.castShadow = true;
      const panelGeo = new THREE.BoxGeometry(2.3, 0.06, 1.5);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c2129, roughness: 0.4, metalness: 0.4, emissive: 0x000000, emissiveIntensity: 0 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.y = 2.1;
      panel.rotation.z = (i % 2 === 0 ? 0.55 : -0.55);
      panel.castShadow = true;
      g.add(mast, panel);
      g.rotation.y = this.rng() * Math.PI * 2;
      g.position.set(s.x, y, s.z);
      this.group.add(g);

      const entry = this.registerInteract(panel, 'repair', 'Repair solar panel', obj.id, () => {
        entry.done = true;
        let p = 0;
        this.animators.push((dt) => {
          p = Math.min(1, p + dt * 1.6);
          panel.rotation.z *= 1 - p * 0.85;
          panelMat.color.set('#0d2a44');
          panelMat.emissive.set('#3ac8ff');
          panelMat.emissiveIntensity = p * 1.5;
          return p >= 1;
        });
        beacon.fading = true;
        beacon.listEntry.done = true;
        this.burst(new THREE.Vector3(s.x, y + 2.1, s.z), 0x3ac8ff, 10);
      });
      const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.repair, obj.id);
      this.beacons.push(beacon);
    }
  }

  createPlantTarget(obj) {
    const s = this.pickSpot(26, 230);
    const y = this.heightAt(s.x, s.z);
    const g = new THREE.Group();
    g.position.set(s.x, y, s.z);
    this.group.add(g);
    const isBeacon = obj.plantKind === 'beacon';

    let entry;
    if (isBeacon) {
      // RGB beacon tower: three stacked glowing cubes on a mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a626e, roughness: 0.5, metalness: 0.6 }));
      mast.position.y = 1.2;
      g.add(mast);
      const cols = [0xff3355, 0x33ff77, 0x33aaff];
      const cubes = cols.map((c, i) => {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55),
          new THREE.MeshStandardMaterial({ color: 0x222233, emissive: c, emissiveIntensity: 0.08, roughness: 0.4 }));
        cube.position.y = 2.55 + i * 0.6;
        g.add(cube);
        return cube;
      });
      g.userData.tower = { cubes, built: false };
      entry = this.registerInteract(g, 'plant', 'Raise the RGB beacon', obj.id, () => {
        entry.done = true;
        g.userData.tower.built = true;
        let p = 0;
        this.animators.push((dt) => {
          p = Math.min(1, p + dt * 0.9);
          for (const c of g.userData.tower.cubes) c.material.emissiveIntensity = 0.08 + p * 1.7;
          return p >= 1;
        });
        this.burst(new THREE.Vector3(s.x, y + 3.5, s.z), 0xa78bfa, 16);
        this.dimObjective(obj.id);
      });
    } else {
      // academy flag
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.4, metalness: 0.8 }));
      pole.position.y = 2;
      pole.castShadow = true;
      g.add(pole);
      const cloth = this.makeFlagCloth();
      cloth.position.set(0.75, 3.55, 0);
      g.add(cloth);
      g.userData.cloth = cloth;
      entry = this.registerInteract(pole, 'plant', 'Plant the academy flag', obj.id, () => {
        entry.done = true;
        let p = 0;
        this.animators.push((dt) => {
          p = Math.min(1, p + dt * 1.1);
          cloth.scale.x = p;
          return p >= 1;
        });
        this.burst(new THREE.Vector3(s.x, y + 3.6, s.z), 0x4de3ff, 12);
        this.dimObjective(obj.id);
      });
    }

    const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.plant, obj.id);
    this.beacons.push(beacon);
    this.animators.push((dt, t) => {
      if (entry.done) return true;
      const cloth = g.userData.cloth;
      if (cloth) {
        const posAttr = cloth.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          posAttr.setZ(i, Math.sin(x * 4 + t * 3.2) * 0.07 * cloth.scale.x);
        }
        posAttr.needsUpdate = true;
      }
      const tower = g.userData.tower;
      if (tower && tower.built) g.rotation.y += dt * 0.8;
      return false;
    });
  }

  makeFlagCloth() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 80;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 128, 80);
    grad.addColorStop(0, '#0b3a6b');
    grad.addColorStop(1, '#0a2a55');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 80);
    ctx.strokeStyle = 'rgba(140,220,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 124, 76);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('JSA', 46, 34);
    ctx.beginPath();
    ctx.arc(40, 58, 7, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1.5, 0.95, 8, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.x = 0.02;
    return mesh;
  }

  createDeploySite(obj, i) {
    const s = this.pickSpot(24, 240);
    const y = this.heightAt(s.x, s.z);
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x454d58, roughness: 0.7, metalness: 0.3 }));
    pad.position.y = 0.08;
    pad.receiveShadow = true;
    g.add(pad);

    // folded instrument
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.4, metalness: 0.7 }));
    mast.position.y = 1.1;
    mast.scale.y = 0.02;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.18, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.35, metalness: 0.8 }));
    dish.position.y = 2.3;
    dish.rotation.x = -0.5;
    dish.scale.set(0.02, 0.02, 0.02);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3355 }));
    led.position.y = 2.55;
    led.visible = false;
    g.add(mast, dish, led);
    g.position.set(s.x, y, s.z);
    this.group.add(g);

    const entry = this.registerInteract(pad, 'deploy', 'Deploy instrument', obj.id, () => {
      entry.done = true;
      let p = 0;
      this.animators.push((dt, t) => {
        p = Math.min(1, p + dt * 0.85);
        mast.scale.y = p;
        dish.scale.setScalar(p);
        if (p >= 1) {
          led.visible = true;
          led.material.color.setHSL((t * 0.25) % 1, 1, 0.6);
        }
        return p >= 1;
      });
      this.burst(new THREE.Vector3(s.x, y + 1.4, s.z), 0x4de3ff, 12);
      beacon.fading = true;
      beacon.listEntry.done = true;
    });

    const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.deploy, obj.id);
    this.beacons.push(beacon);
    this.animators.push((dt, t) => {
      if (entry.done) return true;
      pad.material.emissive = new THREE.Color().setHSL((t * 0.3 + i * 0.5) % 1, 1, 0.5);
      pad.material.emissiveIntensity = 0.25;
      return false;
    });
  }

  createRover(obj) {
    const s = this.pickSpot(30, 220);
    const y = this.heightAt(s.x, s.z);
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc98a3a, roughness: 0.6, metalness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.1), bodyMat);
    body.position.y = 0.62;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMat);
    head.position.set(0, 1.05, 0.85);
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.9 });
    for (const wx of [-0.85, 0, 0.85]) {
      for (const wz of [-0.7, 0.7]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.32, wz);
        w.castShadow = true;
        g.add(w);
        wheels.push(w);
      }
    }
    g.add(body, head);
    g.rotation.z = 0.42; // broken / tipped over
    g.rotation.y = this.rng() * Math.PI * 2;
    g.position.set(s.x, y, s.z);
    this.group.add(g);
    this.rover = { group: g, body, wheels, home: new THREE.Vector3(s.x, y, s.z), fixed: false, angle: this.rng() * Math.PI * 2 };

    const entry = this.registerInteract(body, 'fix', 'Restore survey rover', obj.id, () => {
      entry.done = true;
      this.rover.fixed = true;
      let p = 0;
      this.animators.push((dt) => {
        p = Math.min(1, p + dt * 1.2);
        g.rotation.z = 0.42 * (1 - p);
        return p >= 1;
      });
      this.burst(new THREE.Vector3(s.x, y + 1, s.z), 0xffb64d, 14);
      this.dimObjective(obj.id);
    });

    const beacon = this.createBeacon(s.x, s.z, OBJECTIVE_HUES.fix, obj.id);
    this.beacons.push(beacon);
  }

  // ---------- lander ----------
  buildLander() {
    const x = 0, z = 0;
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.45, metalness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b3442, roughness: 0.6, metalness: 0.4 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.1, 18), bodyMat);
    body.position.y = 2.1;
    body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 18), darkMat);
    nose.position.y = 3.75;
    nose.castShadow = true;
    g.add(body, nose);

    // legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.5, metalness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), legMat);
      leg.position.set(Math.cos(a) * 1.1, 1.0, Math.sin(a) * 1.1);
      leg.rotation.z = Math.cos(a) * 0.55;
      leg.rotation.x = -Math.sin(a) * 0.55;
      leg.castShadow = true;
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8), legMat);
      foot.position.set(Math.cos(a) * 1.8, 0.08, Math.sin(a) * 1.8);
      g.add(foot);
    }

    // RGB accent ring
    this.landerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.07, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xff3355 })
    );
    this.landerRing.position.y = 1.7;
    this.landerRing.rotation.x = Math.PI / 2;
    g.add(this.landerRing);

    // landing pad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.14, 24),
      new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.8, metalness: 0.3 }));
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    g.add(pad);

    // door light strip
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x141a24, emissive: 0x66ddff, emissiveIntensity: 0.5, roughness: 0.4 }));
    door.position.set(0, 1.9, 1.72);
    g.add(door);

    g.position.set(x, y, z);
    this.group.add(g);
    this.landerGroup = g;
    this.landerPos = new THREE.Vector3(x, y, z);

    // RGB strip light under the lander
    const strip = new THREE.PointLight(0x3355ff, 1.4, 14, 1.6);
    strip.position.set(0, 2.4, 0);
    g.add(strip);
    this.landerLight = strip;

    this.doorBeacon = this.createBeacon(x, z + 2, OBJECTIVE_HUES.return, 'return', 26);

    this.registerInteract(door, 'return', 'Board the lander', null, () => {
      if (this.returnReady) return true; // main handles completion
      return false;
    });
  }

  setReturnReady(ready) {
    this.returnReady = ready;
    const hue = ready ? 0.33 : OBJECTIVE_HUES.return;
    for (const b of this.beaconList) {
      if (b.objId === 'return') b.hue = hue;
    }
    if (ready) {
      this.doorBeacon.cyl.material.color.setHSL(0.33, 1, 0.6);
      this.doorBeacon.cyl.material.opacity = 0.3;
    }
  }

  // ---------- dust particles ----------
  buildDust() {
    const tex = makeGlowTexture('rgba(200,200,200,0.9)', 'rgba(200,200,200,0)');
    const geo = new THREE.PlaneGeometry(0.35, 0.35);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 44; i++) {
      const sp = new THREE.Mesh(geo, mat.clone());
      sp.visible = false;
      sp.userData = { life: 0 };
      this.group.add(sp);
      this.dustPool.push(sp);
    }
  }

  emitDust(x, y, z, n = 2) {
    let placed = 0;
    for (const sp of this.dustPool) {
      if (sp.userData.life <= 0) {
        sp.visible = true;
        sp.position.set(
          x + (this.rng() - 0.5) * 0.5,
          y + this.rng() * 0.4,
          z + (this.rng() - 0.5) * 0.5
        );
        sp.userData.vy = 0.4 + this.rng() * 0.7;
        sp.userData.life = 1.1 + this.rng() * 0.5;
        placed++;
        if (placed >= n) break;
      }
    }
  }

  burst(pos, color, n) {
    for (const sp of this.dustPool) {
      if (n <= 0) break;
      if (sp.userData.life > 0) continue;
      sp.visible = true;
      sp.position.copy(pos).add(new THREE.Vector3((this.rng() - 0.5) * 1.2, (this.rng() - 0.5) * 1.2, (this.rng() - 0.5) * 1.2));
      sp.userData.vy = 1.2 + this.rng() * 1.6;
      sp.userData.life = 0.8 + this.rng() * 0.5;
      sp.material.color.set(color);
      sp.material.opacity = 1;
      n--;
    }
  }

  // ---------- per-frame update ----------
  update(dt, t, player, movingOnGround) {
    // animators
    for (let i = this.animators.length - 1; i >= 0; i--) {
      if (this.animators[i](dt, t)) this.animators.splice(i, 1);
    }

    // beacons
    for (const b of this.beacons) {
      if (b.dead) continue;
      if (b.fading) {
        b.fadeT += dt * 1.6;
        b.cyl.material.opacity = Math.max(0, 0.14 * (1 - b.fadeT));
        b.core.material.opacity = Math.max(0, 1 - b.fadeT);
        if (b.fadeT >= 1) { b.dead = true; b.group.visible = false; }
        continue;
      }
      const pulse = 0.1 + Math.sin(t * 2.1 + b.pulse) * 0.06;
      b.cyl.material.opacity = pulse;
      b.cyl.material.color.setHSL(b.hue + Math.sin(t * 0.6 + b.pulse) * 0.03, 1, 0.6);
    }
    // return beacon hue shimmer
    if (!this.returnReady) {
      this.doorBeacon.cyl.material.color.setHSL(OBJECTIVE_HUES.return, 1, 0.55 + Math.sin(t * 3) * 0.1);
    }

    // lander RGB
    this.landerRing.material.color.setHSL((t * 0.18) % 1, 1, 0.55);
    this.landerLight.color.setHSL((t * 0.18 + 0.33) % 1, 1, 0.55);

    // rover
    const rv = this.rover;
    if (rv && rv.fixed) {
      rv.angle += dt * 0.55;
      const r = 7.5;
      const nx = rv.home.x + Math.cos(rv.angle) * r;
      const nz = rv.home.z + Math.sin(rv.angle) * r;
      rv.group.position.set(nx, this.heightAt(nx, nz), nz);
      rv.group.rotation.y = -rv.angle + Math.PI / 2;
      for (const w of rv.wheels) w.rotation.x += dt * 7;
      if (Math.random() < dt * 4) this.emitDust(nx, rv.home.y + 0.2, nz, 1);
    }

    // habitat station effects
    if (this.stations) {
      const e = this.stations.eclss;
      if (e && e.online && e.fan) e.fan.rotation.y += dt * 7;
      const f = this.stations.food;
      if (f && f.online && f.glow) f.glow.material.emissiveIntensity = 1.2 + Math.sin(t * 2.5) * 0.4;
      const w = this.stations.shield;
      if (w && w.online && w.wall) w.wall.rotation.y += dt * 0.3;
    }

    // dust storm particles
    if (this.stormVisual && Math.random() < dt * 30) {
      this.emitDust(
        player.pos.x + (this.rng() - 0.5) * 24,
        this.heightAt(player.pos.x, player.pos.z) + this.rng() * 6,
        player.pos.z + (this.rng() - 0.5) * 24, 2
      );
    }

    // dust pool
    for (const sp of this.dustPool) {
      if (sp.userData.life > 0) {
        sp.userData.life -= dt;
        sp.position.y += sp.userData.vy * dt;
        sp.userData.vy *= 0.94;
        sp.material.opacity = Math.max(0, sp.userData.life * 0.9);
        if (sp.userData.life <= 0) sp.visible = false;
      }
    }

    // footsteps
    if (movingOnGround && Math.random() < dt * 9) {
      this.emitDust(player.pos.x, this.heightAt(player.pos.x, player.pos.z) + 0.05, player.pos.z, 1);
    }
  }

  // ---------- habitat core systems ----------
  buildHabitat() {
    this.stations = {};
    this.buildHabModule();
    const specs = [
      { kind: 'power', label: 'Bring power online', hue: OBJECTIVE_HUES.fix, angle: 0.6, r: 19 },
      { kind: 'eclss', label: 'Activate life support (ECLSS)', hue: OBJECTIVE_HUES.repair, angle: 2.1, r: 16 },
      { kind: 'shield', label: 'Deploy radiation shielding', hue: OBJECTIVE_HUES.deploy, angle: 3.6, r: 20 },
      { kind: 'food', label: 'Start the hydroponics bay', hue: OBJECTIVE_HUES.plant, angle: 5.2, r: 17 }
    ];
    for (const sp of specs) {
      const x = Math.cos(sp.angle) * sp.r;
      const z = Math.sin(sp.angle) * sp.r;
      const y = this.heightAt(x, z);
      const st = this.buildStation(sp.kind, x, y, z);
      this.stations[sp.kind] = st;
      const beacon = this.createBeacon(x, z, sp.hue, sp.kind);
      this.beacons.push(beacon);
      st.beacon = beacon;
      const entry = this.registerInteract(st.mesh, sp.kind, sp.label, sp.kind, () => true);
      st.entry = entry;
    }
  }

  buildHabModule() {
    const x = -9, z = 6;
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.5, metalness: 0.4 })
    );
    dome.castShadow = true;
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2b3442, emissive: 0x4de3ff, emissiveIntensity: 0.35, roughness: 0.5 }));
    hatch.position.set(2.0, 0.6, 0);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 0.7, roughness: 0.4 }));
    antenna.position.set(0.6, 2.6, 0);
    g.add(dome, hatch, antenna);
    g.position.set(x, y, z);
    this.group.add(g);
    this.habModule = g;
  }

  buildStation(kind, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.75, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.6, metalness: 0.4 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.14, 18), padMat);
    pad.position.y = 0.07;
    pad.receiveShadow = true;
    g.add(pad);

    const st = { group: g, mesh: pad, online: false };

    if (kind === 'power') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.8), darkMat);
      box.position.set(0, 0.35, 0);
      box.castShadow = true;
      g.add(box);
      st.mesh = box;
    } else if (kind === 'eclss') {
      const module = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.0), darkMat);
      module.position.y = 0.65;
      module.castShadow = true;
      g.add(module);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x9aa8b8, roughness: 0.4, metalness: 0.7 });
      for (const tx of [-0.95, 0.95]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 10), tankMat);
        tank.position.set(tx, 0.55, 0);
        tank.castShadow = true;
        g.add(tank);
      }
      st.strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x39ff8e, emissiveIntensity: 0.08 }));
      st.strip.position.set(0, 1.25, 0.52);
      g.add(st.strip);
      st.fan = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), padMat);
      st.fan.position.set(0, 1.25, 0);
      g.add(st.fan);
      st.mesh = module;
    } else if (kind === 'shield') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), darkMat);
      box.position.set(0, 0.4, 0);
      box.castShadow = true;
      g.add(box);
      st.mesh = box;
    } else if (kind === 'food') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 8, 24), padMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      g.add(ring);
      st.dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.16, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide })
      );
      st.dome.position.y = 0.14;
      g.add(st.dome);
      st.glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x2eff7a, emissiveIntensity: 0 }));
      st.glow.position.y = 0.5;
      st.glow.scale.setScalar(0.01);
      g.add(st.glow);
      st.planters = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), darkMat);
        planter.position.set(Math.cos(a) * 0.62, 0.2, Math.sin(a) * 0.62);
        planter.scale.setScalar(0.01);
        g.add(planter);
        st.planters.push(planter);
      }
      st.mesh = st.dome;
    }

    this.group.add(g);
    return st;
  }

  finishStation(st) {
    st.entry.done = true;
    st.beacon.fading = true;
    st.beacon.listEntry.done = true;
  }

  applyPowerChoice(mode) {
    const st = this.stations.power;
    const g = st.group;
    const build = [];
    if (mode === 'solar') {
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x0d2a44, emissive: 0x3ac8ff, emissiveIntensity: 0.2, roughness: 0.35, metalness: 0.5 });
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x5a626e, roughness: 0.5, metalness: 0.6 });
      for (const px of [-2.4, 0, 2.4]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.7, 8), mastMat);
        mast.position.set(px, 0.85, -1.4);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.4), panelMat);
        panel.position.set(px, 1.75, -1.4);
        panel.rotation.x = -0.5;
        panel.castShadow = true;
        g.add(mast, panel);
        build.push(panel);
        panel.scale.setScalar(0.01);
      }
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.1, 14),
        new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.4, metalness: 0.7 }));
      body.position.set(0, 0.9, -1.4);
      body.castShadow = true;
      const finMat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff5a1e, emissiveIntensity: 0.5, roughness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.4), finMat);
        fin.position.set(Math.cos(a) * 0.55, 0.9, -1.4 + Math.sin(a) * 0.55);
        g.add(fin);
      }
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3355 }));
      led.position.set(0, 1.55, -1.4);
      g.add(body, led);
      build.push(body, led);
      body.scale.setScalar(0.01);
      led.scale.setScalar(0.01);
    }
    let p = 0;
    this.animators.push((dt) => {
      p = Math.min(1, p + dt * 1.3);
      for (const m of build) m.scale.setScalar(Math.max(0.01, p));
      return p >= 1;
    });
    this.burst(g.position.clone().add(new THREE.Vector3(0, 1, -1.4)), mode === 'solar' ? 0x3ac8ff : 0xff8a3c, 12);
    this.finishStation(st);
  }

  applyShieldChoice(mode) {
    const st = this.stations.shield;
    const g = st.group;
    if (mode === 'regolith') {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: this.env.groundB, roughness: 1, flatShading: true })
      );
      mound.position.set(0, 0, -1.6);
      mound.scale.y = 0.7;
      mound.castShadow = true;
      mound.scale.multiplyScalar(0.01);
      mound.scale.y = 0.007;
      g.add(mound);
      let p = 0;
      this.animators.push((dt) => {
        p = Math.min(1, p + dt * 1.1);
        mound.scale.set(p, 0.7 * p, p);
        return p >= 1;
      });
      this.burst(g.position.clone().add(new THREE.Vector3(0, 1, -1.6)), 0xb8a888, 12);
    } else {
      st.wallMat = new THREE.MeshStandardMaterial({
        color: 0x4dd8ff, transparent: true, opacity: 0.22,
        emissive: 0x22aadd, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.2
      });
      st.wall = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.6, 24, 1, true), st.wallMat);
      st.wall.position.set(0, 0.95, -1.6);
      st.wall.scale.set(0.01, 0.01, 0.01);
      g.add(st.wall);
      let p = 0;
      this.animators.push((dt) => {
        p = Math.min(1, p + dt * 1.1);
        st.wall.scale.set(p, p, p);
        return p >= 1;
      });
      this.burst(g.position.clone().add(new THREE.Vector3(0, 1, -1.6)), 0x4dd8ff, 12);
    }
    this.finishStation(st);
  }

  applyRadiationShelter() {
    const g = this.habModule;
    if (!g) return;

    const shelter = new THREE.Group();
    const radius = 5.4;
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xcbd8e4,
      emissive: 0x24425c,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.35,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      shellMat
    );
    shell.scale.set(1.35, 1.05, 1.15);
    shell.position.y = 0.12;
    shell.castShadow = true;
    shelter.add(shell);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x536779,
      metalness: 0.65,
      roughness: 0.35
    });
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.2, 8, 40), frameMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.scale.set(1.35, 1.15, 1);
    baseRing.position.y = 0.18;
    shelter.add(baseRing);

    const airlock = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.6, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x354555,
        emissive: 0x2bbdff,
        emissiveIntensity: 0.25,
        metalness: 0.45,
        roughness: 0.4
      })
    );
    airlock.position.set(5.1, 1.3, 0);
    airlock.castShadow = true;
    shelter.add(airlock);

    const beacon = new THREE.PointLight(0x55cfff, 2.2, 12);
    beacon.position.set(5.1, 2.6, 0);
    shelter.add(beacon);
    shelter.scale.setScalar(0.01);
    g.add(shelter);

    let p = 0;
    this.animators.push((dt) => {
      p = Math.min(1, p + dt * 0.8);
      shelter.scale.setScalar(Math.max(0.01, p));
      return p >= 1;
    });
    this.burst(g.position.clone().add(new THREE.Vector3(0, 2, 0)), 0x55cfff, 20);
  }

  setEclssState(on) {
    const st = this.stations.eclss;
    if (!st) return;
    st.online = on;
    st.strip.material.emissiveIntensity = on ? 1.8 : 0.08;
  }

  setFoodState(on) {
    const st = this.stations.food;
    if (!st) return;
    st.online = on;
    let p = 0;
    const from = on ? 0.01 : 1;
    const to = on ? 1 : 0.01;
    st.glow.scale.setScalar(from);
    this.animators.push((dt) => {
      p = Math.min(1, p + dt * 1.4);
      const s = from + (to - from) * p;
      st.glow.scale.setScalar(Math.max(0.01, s));
      st.glow.material.emissiveIntensity = on ? s * 1.4 : (1 - p) * 1.4;
      for (const pl of st.planters) pl.scale.setScalar(Math.max(0.01, s));
      return p >= 1;
    });
    if (on && !st.firstOnline) {
      st.firstOnline = true;
      this.finishStation(st);
      this.burst(st.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x2eff7a, 12);
    }
  }

  setShieldState(on) {
    const st = this.stations.shield;
    if (!st) return;
    st.online = on;
    if (st.wallMat) st.wallMat.opacity = on ? 0.22 : 0.05;
  }

  setStorm(on) {
    this.stormVisual = on;
    if (this.scene.fog) {
      this.scene.fog.near = on ? 30 : 110;
      this.scene.fog.far = on ? 170 : 430;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.fog = null;
    this.scene.background = null;
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
