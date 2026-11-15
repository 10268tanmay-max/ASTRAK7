// ============================================================
// First-person spaceship cockpit: interior, console, screens,
// utility lighting, and navigation hologram
// ============================================================
import * as THREE from 'three';

function makeScreenTexture(w = 256, h = 160) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: c.getContext('2d'), tex };
}

export class Cockpit {
  constructor(scene, mission) {
    this.scene = scene;
    this.mission = mission;
    this.group = new THREE.Group();
    this.countdown = -1;
    this.build();
    scene.add(this.group);
  }

  build() {
    const g = this.group;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x929a98, roughness: 0.72, metalness: 0.24, side: THREE.DoubleSide
    });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x555d5c, roughness: 0.82, metalness: 0.2 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x7e8784, roughness: 0.76, metalness: 0.24 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xa8aeaa, roughness: 0.58, metalness: 0.38 });
    const insetMat = new THREE.MeshStandardMaterial({ color: 0x202729, roughness: 0.64, metalness: 0.3 });
    const utilityMat = new THREE.MeshBasicMaterial({ color: 0x9ab9b8 });
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xd5964e });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x4b5250, roughness: 0.92, metalness: 0.04 });
    const seatFrameMat = new THREE.MeshStandardMaterial({ color: 0x7c8582, roughness: 0.5, metalness: 0.58 });
    const addBox = (w, h, d, x, y, z, material, rotationZ = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      g.add(mesh);
      return mesh;
    };

    // room shell (open at the front for the window)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 9.6), floorMat);
    floor.rotation.x = -Math.PI / 2;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(11, 9.6), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 3.7;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3.7), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.x = -5.5;
    left.position.z = -0.2;
    const right = left.clone();
    right.position.x = 5.5;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.7), wallMat);
    back.position.z = 4.4;
    back.rotation.y = Math.PI;
    g.add(floor, ceil, left, right, back);

    // Structural ribs and access panels break up the broad cabin surfaces.
    for (const z of [-3.2, -1.2, 0.8, 2.8]) {
      addBox(0.16, 3.55, 0.24, -5.28, 1.82, z, panelMat);
      addBox(0.16, 3.55, 0.24, 5.28, 1.82, z, panelMat);
      addBox(10.35, 0.13, 0.2, 0, 3.48, z, panelMat);
    }
    for (const x of [-4.25, 4.25]) {
      addBox(1.45, 1.05, 0.12, x, 2.25, 4.12, insetMat);
      addBox(1.18, 0.045, 0.16, x, 2.78, 4.02, utilityMat);
      addBox(0.72, 0.035, 0.16, x, 1.78, 4.02, amberMat);
    }

    // Floor armor and restrained aisle markers frame the path to the viewport.
    for (const x of [-3.9, -2.6, 2.6, 3.9]) {
      addBox(0.035, 0.018, 7.8, x, 0.012, -0.15, utilityMat);
    }
    for (const z of [-3.3, -1.8, -0.3, 1.2, 2.7]) {
      addBox(8.2, 0.018, 0.025, 0, 0.014, z, insetMat);
    }
    addBox(0.045, 0.02, 7.8, -1.25, 0.018, -0.15, amberMat);
    addBox(0.045, 0.02, 7.8, 1.25, 0.018, -0.15, amberMat);

    // window glass + frame
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 2.7),
      new THREE.MeshStandardMaterial({
        color: 0x93a9aa, emissive: 0x080e10, roughness: 0.16, metalness: 0.22,
        transparent: true, opacity: 0.12, side: THREE.DoubleSide
      })
    );
    glass.position.set(0, 1.95, -4.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x858d89, roughness: 0.52, metalness: 0.58 });
    const makeFrame = (w, h, d, x, y, z) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      f.position.set(x, y, z);
      g.add(f);
      return f;
    };
    makeFrame(11.2, 0.35, 0.35, 0, 0.42, -4.85);
    makeFrame(0.3, 3.3, 0.35, -4.95, 1.95, -4.85);
    makeFrame(0.3, 3.3, 0.35, 4.95, 1.95, -4.85);
    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-4.85, 1.72, -4.62),
      new THREE.Vector3(0, 4.85, -4.62),
      new THREE.Vector3(4.85, 1.72, -4.62)
    );
    const archRail = new THREE.Mesh(
      new THREE.TubeGeometry(archCurve, 48, 0.22, 10, false),
      frameMat
    );
    const archSeal = new THREE.Mesh(
      new THREE.TubeGeometry(archCurve, 48, 0.055, 8, false),
      insetMat
    );
    archRail.position.z -= 0.08;
    archSeal.position.z -= 0.13;
    g.add(archRail, archSeal);
    addBox(8.75, 0.045, 0.08, 0, 0.62, -4.62, amberMat);

    // console deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.24, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x59615e, roughness: 0.62, metalness: 0.4 })
    );
    deck.position.set(0, 0.9, -2.7);
    deck.rotation.x = -0.42;
    g.add(deck);
    addBox(7.15, 0.055, 0.09, 0, 0.84, -1.63, utilityMat);

    // screens
    this.screens = [];
    const screenPos = [[-2.2, 1.62, -3.42], [0, 1.62, -3.42], [2.2, 1.62, -3.42]];
    for (let i = 0; i < screenPos.length; i++) {
      const p = screenPos[i];
      const st = makeScreenTexture();
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(1.98, 1.28, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x777f7f, roughness: 0.5, metalness: 0.52 })
      );
      housing.position.set(p[0], p[1], p[2] - 0.12);
      housing.rotation.x = -0.42;
      g.add(housing);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.1),
        new THREE.MeshBasicMaterial({ map: st.tex, toneMapped: false })
      );
      screen.position.set(...p);
      screen.rotation.x = -0.42;
      g.add(screen);
      const screenAccent = addBox(1.38, 0.035, 0.035, p[0], 2.12, -3.64, i === 1 ? amberMat : utilityMat);
      screenAccent.rotation.x = -0.42;
      this.screens.push(st);
    }

    // button bank
    const btnPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.18, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x454d4d, roughness: 0.62, metalness: 0.42 })
    );
    btnPanel.position.set(3.1, 0.92, -2.1);
    btnPanel.rotation.x = -0.25;
    g.add(btnPanel);
    const btnGeo = new THREE.BoxGeometry(0.14, 0.07, 0.14);
    const btnMat = new THREE.MeshStandardMaterial({ roughness: 0.52, metalness: 0.28 });
    this.buttons = new THREE.InstancedMesh(btnGeo, btnMat, 42);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 42; i++) {
      const col = Math.floor(i / 7), row = i % 7;
      m.makeTranslation(3.1 + (row - 3) * 0.24, 1.06, -2.1 - 0.15 + (col - 3) * 0.3);
      this.buttons.setMatrixAt(i, m);
      const color = i % 7 === 0 ? 0xe0a34f : i % 5 === 0 ? 0xb65c50 : 0x8da69b;
      this.buttons.setColorAt(i, new THREE.Color(color));
    }
    this.buttons.instanceMatrix.needsUpdate = true;
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
    g.add(this.buttons);

    // joystick + throttle
    const joy = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x555e5b, roughness: 0.58, metalness: 0.46 }));
    joy.position.set(-3.3, 0.8, -1.7);
    joy.rotation.z = 0.3;
    const joyBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x8d9d91, roughness: 0.42, metalness: 0.22 }));
    joyBall.position.set(-3.05, 1.05, -1.66);
    g.add(joy, joyBall);
    const throttle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x555e5b, roughness: 0.58, metalness: 0.46 }));
    throttle.position.set(-3.9, 0.85, -2.1);
    g.add(throttle);

    // lockers
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x656d6c, roughness: 0.62, metalness: 0.38 });
    for (const lx of [-4.4, 4.4]) {
      const locker = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.5), lockerMat);
      locker.position.set(lx, 1.3, 2.6);
      g.add(locker);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.52), panelMat);
      edge.position.set(lx, 2.58, 2.6);
      g.add(edge);
      addBox(0.045, 1.95, 0.04, lx + (lx < 0 ? 0.55 : -0.55), 1.28, 2.33, frameMat);
      addBox(0.16, 0.16, 0.06, lx + (lx < 0 ? 0.55 : -0.55), 1.3, 2.29, amberMat);
    }

    // Twin pilot seats flank the center aisle.
    for (const sx of [-2.4, 2.4]) {
      const seatZ = -0.4;
      addBox(0.16, 0.72, 0.16, sx - 0.3, 0.38, seatZ, seatFrameMat);
      addBox(0.16, 0.72, 0.16, sx + 0.3, 0.38, seatZ, seatFrameMat);
      addBox(0.92, 0.2, 0.76, sx, 0.78, seatZ, seatMat);
      addBox(0.92, 1.08, 0.2, sx, 1.38, seatZ + 0.3, seatMat, -0.08);
      addBox(0.62, 0.34, 0.22, sx, 2.02, seatZ + 0.32, seatMat, -0.08);
      addBox(0.1, 0.42, 0.46, sx - 0.58, 0.96, seatZ - 0.18, seatFrameMat);
      addBox(0.1, 0.42, 0.46, sx + 0.58, 0.96, seatZ - 0.18, seatFrameMat);
      addBox(0.1, 0.78, 0.22, sx - 0.4, 1.38, seatZ + 0.18, amberMat);
      addBox(0.1, 0.78, 0.22, sx + 0.4, 1.38, seatZ + 0.18, amberMat);
    }

    // Angled side consoles leave the center aisle clear.
    for (const side of [-1, 1]) {
      const sideDeck = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.2, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x59615e, roughness: 0.62, metalness: 0.4 })
      );
      sideDeck.position.set(side * 3.8, 1.26, -2.45);
      sideDeck.rotation.x = -0.32;
      sideDeck.rotation.z = side * -0.08;
      g.add(sideDeck);
      const sideScreen = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 0.035, 0.65),
        new THREE.MeshBasicMaterial({ color: 0x18211e })
      );
      sideScreen.position.set(side * 3.8, 1.39, -2.45);
      sideScreen.rotation.x = -0.32;
      g.add(sideScreen);
      for (let i = 0; i < 5; i++) {
        addBox(0.12, 0.055, 0.12, side * (3.05 + i * 0.28), 1.4, -1.78, i === 0 ? amberMat : utilityMat);
      }
    }

    // Overhead instrument panels and practical cabin lights.
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0xb9c1bb, emissive: 0x66736b, emissiveIntensity: 0.3,
      roughness: 0.72, metalness: 0.08
    });
    for (const z of [-2.2, 0.2, 2.6]) {
      addBox(1.35, 0.09, 0.48, 0, 3.39, z, fixtureMat);
      addBox(1.08, 0.025, 0.3, 0, 3.32, z, utilityMat);
      for (const side of [-1, 1]) {
        addBox(0.78, 0.035, 0.34, side * 2.65, 3.42, z, insetMat);
        for (let i = 0; i < 4; i++) {
          addBox(0.08, 0.025, 0.08, side * (2.4 + i * 0.16), 3.39, z, i === 0 ? amberMat : utilityMat);
        }
      }
    }

    // Low-output cabin markers replace the decorative RGB strips.
    const strip1 = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.045, 0.06), utilityMat);
    strip1.position.set(0, 3.62, -1.2);
    const strip2 = strip1.clone();
    strip2.position.set(0, 3.62, 1.6);
    const strip3 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.05, 0.05), utilityMat);
    strip3.position.set(0, 0.7, -3.9);
    const strip4 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.4, 0.05), utilityMat);
    strip4.position.set(-5.45, 1.85, 1.5);
    const strip5 = strip4.clone();
    strip5.position.set(5.45, 1.85, 1.5);
    g.add(strip1, strip2, strip3, strip4, strip5);

    // hologram planet
    this.holo = new THREE.Group();
    const holoSphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x83bbb0, wireframe: true, transparent: true, opacity: 0.42 }));
    const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.015, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xd5a45c, transparent: true, opacity: 0.65 }));
    holoRing.rotation.x = Math.PI / 2.3;
    this.holo.add(holoSphere, holoRing);
    this.holo.position.set(4.3, 1.85, -2.9);
    g.add(this.holo);

    // lights
    g.add(new THREE.AmbientLight(0xb0b8b5, 1.8));
    const white = new THREE.PointLight(0xdce4dc, 2.1, 22, 1.45);
    white.position.set(0, 3.2, -1);
    this.cabinLight = white;
    const fill = new THREE.PointLight(0xb8c8bd, 0.72, 15, 1.8);
    fill.position.set(0, 2.7, 2);
    const amber = new THREE.PointLight(0xd49a58, 0.3, 8, 2);
    amber.position.set(-3.6, 1.5, 1.8);
    g.add(white, fill, amber);

    // blinking status LEDs
    this.leds = [];
    for (let i = 0; i < 4; i++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x55ff99 : 0xff5566 }));
      led.position.set(-2.9 + i * 0.3, 1.45, -3.55);
      led.rotation.x = -0.42;
      g.add(led);
      this.leds.push({ led, phase: i * 1.7 });
    }
  }

  drawRadar(ctx, t) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#111916';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(157,190,160,0.36)';
    ctx.lineWidth = 1.5;
    for (const r of [30, 55, 80]) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
    // blips
    for (let i = 0; i < 5; i++) {
      const a = t * 0.25 + i * 1.9;
      const d = 35 + (i * 53) % 90;
      const bx = w / 2 + Math.cos(a) * d, by = h / 2 + Math.sin(a) * d;
      ctx.fillStyle = i % 2 ? '#a9c8b1' : '#d5a45c';
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // sweep
    const sweepA = t * 1.6;
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweepA, w / 2, h / 2) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(157,190,160,0.38)');
      grad.addColorStop(0.25, 'rgba(157,190,160,0)');
      grad.addColorStop(1, 'rgba(157,190,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.arc(w / 2, h / 2, 82, sweepA, sweepA + Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(195,210,193,0.85)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('RADAR', 10, 18);
    ctx.fillText(this.mission.world, w - 52, h - 10);
  }

  drawNav(ctx, t) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#030810';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b0c8b8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(this.mission.title, 14, 26);
    ctx.fillStyle = 'rgba(191,202,191,0.88)';
    ctx.font = '11px monospace';
    const lines = [
      'TARGET: ' + this.mission.world,
      'FUEL ..... 98%',
      'O2 ........ 100%',
      'GYRO ...... OK',
      'COMMS ..... OK',
      'SYSTEMS NOMINAL'
    ];
    lines.forEach((l, i) => {
      ctx.fillStyle = i === lines.length - 1 ? '#a5c49d' : 'rgba(191,202,191,0.88)';
      ctx.fillText(l, 14, 52 + i * 19);
    });
    if (this.countdown >= 0) {
      ctx.fillStyle = '#d5a45c';
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('T-' + this.countdown, w / 2, h - 28);
      ctx.textAlign = 'left';
    }
    // heartbeat line
    ctx.strokeStyle = 'rgba(157,190,160,0.78)';
    ctx.beginPath();
    const baseY = h - 22;
    ctx.moveTo(14, baseY);
    for (let x = 14; x < w - 14; x += 2) {
      ctx.lineTo(x, baseY - Math.sin(x * 0.25 + t * 6) * 4 - Math.max(0, Math.sin(x * 0.9 + t * 12)) * 10);
    }
    ctx.stroke();
  }

  drawMissionScreen(ctx, t) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = '#030810';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d7b274';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('OBJECTIVES', 14, 26);
    ctx.font = '11px monospace';
    this.mission.objectives.forEach((o, i) => {
      const blink = Math.sin(t * 3 + i) > 0;
      ctx.fillStyle = blink ? 'rgba(224,227,213,0.94)' : 'rgba(166,177,165,0.68)';
      ctx.fillText((i + 1) + '. ' + o.label, 14, 52 + i * 22);
    });
    ctx.fillStyle = 'rgba(255,180,90,0.9)';
    ctx.fillText('GRAV ' + this.mission.env.gravity.toFixed(2) + ' m/s2', 14, h - 24);
  }

  update(dt, t) {
    this.cabinLight.intensity = 1.4 + Math.sin(t * 0.7) * 0.035;
    this.holo.rotation.y += dt * 0.9;
    this.holo.position.y = 1.85 + Math.sin(t * 1.4) * 0.1;

    // LEDs blink
    for (const { led, phase } of this.leds) {
      led.material.color.setHex(Math.sin(t * 2.5 + phase) > 0 ? 0x9abf91 : 0xd49a58);
    }
    // screens
    this.drawRadar(this.screens[0].ctx, t);
    this.screens[0].tex.needsUpdate = true;
    this.drawNav(this.screens[1].ctx, t);
    this.screens[1].tex.needsUpdate = true;
    this.drawMissionScreen(this.screens[2].ctx, t);
    this.screens[2].tex.needsUpdate = true;
  }

  setCountdown(n) { this.countdown = n; }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
