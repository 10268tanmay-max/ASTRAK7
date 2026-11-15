import * as THREE from 'three';
import { OBJECTIVE_HUES } from './mission.js';

export class SpaceflightWorld {
  constructor(scene, mission, camera) {
    this.scene = scene;
    this.mission = mission;
    this.camera = camera;
    scene.background = new THREE.Color(0x02050e);
    scene.fog = null;
    this.group = new THREE.Group();
    this.targets = [];
    this.beaconList = [];
    this.returnReady = false;
    this.mapScale = 0.2;
    this.landerPos = new THREE.Vector3(0, 0, 90);
    this.buildStars();
    this.buildPlanet();
    this.buildStation();
    this.buildShip();
    this.buildTargets();
    this.buildCockpitView();
    scene.add(this.group);
  }

  buildStars() {
    const positions = new Float32Array(2400 * 3);
    for (let i = 0; i < positions.length / 3; i++) {
      const direction = new THREE.Vector3().randomDirection().multiplyScalar(1500 + Math.random() * 1600);
      positions.set(direction.toArray(), i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xc8e5ff,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    this.group.add(new THREE.Points(geometry, material));
    this.group.add(new THREE.AmbientLight(0x6b83b4, 1.1));
    const sun = new THREE.DirectionalLight(0xffe8c4, 2.4);
    sun.position.set(-350, 500, 300);
    this.group.add(sun);
  }

  buildPlanet() {
    const theme = this.mission.flightTheme || (this.mission.id === 'orbital-rescue' ? 'earth' : 'deep-space');
    const appearances = {
      earth: { radius: 430, color: 0x276ca6, position: [450, -580, -1450] },
      moon: { radius: 320, color: 0x858694, position: [-450, -540, -1500] },
      'deep-space': { radius: 280, color: 0x6c5660, position: [-560, -420, -1450] },
      comet: { radius: 150, color: 0x57958e, position: [350, -380, -1200] }
    };
    const appearance = appearances[theme] ?? appearances['deep-space'];
    const earth = theme === 'earth';
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(appearance.radius, 48, 32),
      new THREE.MeshStandardMaterial({
        color: appearance.color,
        roughness: 0.95,
        metalness: 0.02
      })
    );
    planet.position.set(...appearance.position);
    this.group.add(planet);
    if (earth) {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(438, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0x38aaff, transparent: true, opacity: 0.09, side: THREE.BackSide })
      );
      atmosphere.position.copy(planet.position);
      this.group.add(atmosphere);
    }
  }

  buildStation() {
    const station = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x8799ac, metalness: 0.72, roughness: 0.38 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x253449, metalness: 0.6, roughness: 0.4 });
    const solar = new THREE.MeshStandardMaterial({ color: 0x235b99, metalness: 0.5, roughness: 0.3, emissive: 0x092c5b });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 18, 12), hull);
    core.rotation.x = Math.PI / 2;
    station.add(core);
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(38, 1.2, 1.5), hull);
      beam.position.x = side * 13;
      station.add(beam);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(28, 0.45, 15), solar);
      panel.position.set(side * 32, 0, 0);
      station.add(panel);
      const pod = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), dark);
      pod.position.set(side * 10, 0, 0);
      station.add(pod);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(13, 0.7, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x64eaff })
    );
    ring.position.z = 10;
    station.add(ring);
    station.position.copy(this.landerPos);
    this.stationRing = ring;
    this.group.add(station);

    const beacon = this.makeBeacon(this.landerPos, 'return');
    this.returnBeacon = beacon;
  }

  buildShip() {
    const ship = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xd8e2ec, metalness: 0.72, roughness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x36c9e8, metalness: 0.45, roughness: 0.25, emissive: 0x063b56 });
    const canopy = new THREE.MeshPhysicalMaterial({ color: 0x2798bb, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.2 });
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(2.6, 12, 10), hull);
    fuselage.rotation.x = -Math.PI / 2;
    fuselage.position.z = -1;
    ship.add(fuselage);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 8, 10), hull);
    body.rotation.x = Math.PI / 2;
    body.position.z = 4.5;
    ship.add(body);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 12), canopy);
    cockpit.scale.set(1, 0.7, 1.5);
    cockpit.position.set(0, 1.3, -1);
    ship.add(cockpit);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.45, 3.3), hull);
      wing.position.set(side * 3.4, -0.2, 2.3);
      wing.rotation.y = side * -0.1;
      ship.add(wing);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.16, 0.18), accent);
      stripe.position.set(side * 3.5, 0.1, 2.2);
      ship.add(stripe);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 2.2, 10), accent);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 1.3, 0, 7.6);
      ship.add(engine);
    }
    this.thruster = new THREE.PointLight(0x45dfff, 2.2, 24, 2);
    this.thruster.position.z = 8;
    ship.add(this.thruster);
    ship.visible = false;
    this.ship = ship;
    this.group.add(ship);
  }

  buildCockpitView() {
    const cockpit = new THREE.Group();
    cockpit.name = 'flight-cockpit-view';
    this.scene.add(this.camera);
    const shell = new THREE.MeshStandardMaterial({ color: 0x101b2b, metalness: 0.78, roughness: 0.3 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x263d52, metalness: 0.82, roughness: 0.24 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x58eaff });
    const amber = new THREE.MeshBasicMaterial({ color: 0xffb85d });

    const addBox = (w, h, d, x, y, z, material, rotationZ = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      cockpit.add(mesh);
      return mesh;
    };

    addBox(0.16, 3.4, 0.22, -3.4, 0.1, -3.25, trim, -0.08);
    addBox(0.16, 3.4, 0.22, 3.4, 0.1, -3.25, trim, 0.08);
    addBox(6.9, 0.13, 0.22, 0, 1.72, -3.25, trim);
    addBox(6.9, 0.07, 0.16, 0, 1.61, -3.16, glow);
    addBox(0.07, 3.15, 0.14, -3.29, 0.1, -3.12, glow);
    addBox(0.07, 3.15, 0.14, 3.29, 0.1, -3.12, glow);

    addBox(7.8, 0.72, 0.68, 0, -2.08, -3.05, shell);
    addBox(8.2, 0.16, 0.84, 0, -2.47, -2.88, trim, -0.025);
    addBox(7.55, 0.055, 0.07, 0, -1.7, -2.68, glow);
    addBox(0.11, 0.5, 0.08, -3.65, -1.95, -2.66, amber);
    addBox(0.11, 0.5, 0.08, 3.65, -1.95, -2.66, amber);

    this.flightScreens = [];
    const makeScreen = (x, y, width, height, title, accent = '#58eaff') => {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 192;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.13, height + 0.13, 0.12), trim);
      frame.position.set(x, y, -2.69);
      cockpit.add(frame);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      screen.position.set(x, y, -2.61);
      cockpit.add(screen);
      this.flightScreens.push({ canvas, texture, title, accent });
    };

    makeScreen(-2.15, -1.55, 1.55, 0.57, 'FLIGHT RADAR');
    makeScreen(0, -1.48, 1.76, 0.76, 'NAV COMPUTER');
    makeScreen(2.15, -1.55, 1.55, 0.57, 'MISSION DATA', '#ffbd61');

    for (let i = 0; i < 5; i++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), i % 2 ? glow : amber);
      led.position.set(-1.15 + i * 0.58, -2.42, -2.48);
      cockpit.add(led);
    }

    addBox(0.8, 0.055, 0.09, 0, -1.37, -2.7, glow);
    addBox(0.055, 0.8, 0.09, 0, -1.37, -2.7, glow);

    this.cockpitView = cockpit;
    this.camera.add(cockpit);
    this.drawFlightScreens(0, null, null, 0);
  }

  drawFlightScreens(t, player, nearby, o2) {
    if (!this.flightScreens) return;
    for (const screen of this.flightScreens) {
      const { canvas, texture, title, accent } = screen;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#04101d';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(91,220,255,.38)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = accent;
      ctx.font = 'bold 19px monospace';
      ctx.fillText(title, 18, 32);

      if (title === 'FLIGHT RADAR') {
        const cx = w / 2, cy = 120;
        ctx.strokeStyle = 'rgba(91,220,255,.35)';
        for (const radius of [25, 48, 72]) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx, 42); ctx.lineTo(cx, h - 8);
        ctx.moveTo(42, cy); ctx.lineTo(w - 42, cy);
        ctx.stroke();
        if (player) {
          for (const beacon of this.beaconList) {
            if (beacon.dead) continue;
            const dx = (beacon.pos.x - player.pos.x) * 0.24;
            const dz = (beacon.pos.z - player.pos.z) * 0.24;
            ctx.fillStyle = beacon.objId === 'return' ? '#ff637d' : '#63f5dc';
            ctx.beginPath();
            ctx.arc(cx + THREE.MathUtils.clamp(dx, -66, 66), cy + THREE.MathUtils.clamp(dz, -66, 66), 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#c4f5ff';
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      } else if (title === 'NAV COMPUTER') {
        const distance = nearby ? Math.round(nearby.distance) + ' m' : 'SCANNING';
        ctx.fillStyle = '#d9f6ff';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(nearby ? nearby.target.kind.toUpperCase() : 'NEXT TARGET', 18, 67);
        ctx.font = '16px monospace';
        ctx.fillText('RANGE  ' + distance, 18, 94);
        ctx.fillText('SPD    ' + (player ? player.vel.length().toFixed(1) : '0.0') + ' m/s', 18, 119);
        ctx.fillStyle = o2 < 25 ? '#ff526b' : '#57ffc5';
        ctx.fillText('O2     ' + Math.round(o2) + '%', 18, 145);
        ctx.fillStyle = 'rgba(87,255,197,.76)';
        ctx.fillRect(18, 159, (w - 36) * THREE.MathUtils.clamp(o2 / 100, 0, 1), 7);
      } else {
        const objective = this.mission.objectives.find((item) => !item.done);
        ctx.fillStyle = '#d9f6ff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(objective ? objective.label.toUpperCase() : 'RETURN TO STATION', 18, 68, w - 36);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#9bbbd0';
        ctx.fillText(objective ? 'PROGRESS  ' + objective.progress + '/' + objective.target : 'DOCKING BEACON ACTIVE', 18, 99);
        ctx.fillStyle = '#57ffc5';
        ctx.fillText('FLIGHT SYSTEMS NOMINAL', 18, 132);
        ctx.strokeStyle = accent;
        ctx.beginPath();
        for (let x = 18; x < w - 18; x += 3) {
          const y = 165 + Math.sin(x * 0.055 + t * 5) * 8;
          if (x === 18) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      texture.needsUpdate = true;
    }
  }

  buildTargets() {
    const hues = { satellite: 0.53, cargo: 0.12, asteroid: 0.78, capsule: 0.33, relay: 0.78, beacon: 0.48, sample: 0.47 };
    for (const batch of this.mission.flightTargets) {
      for (const position of batch.positions) {
        const pos = new THREE.Vector3(...position);
        const target = this.makeTarget(batch.kind, pos, batch.objectiveId);
        this.targets.push(target);
        this.beaconList.push({
          pos,
          hue: hues[batch.kind] ?? OBJECTIVE_HUES.repair,
          objId: batch.objectiveId,
          target
        });
      }
    }
  }

  makeTarget(kind, position, objectiveId) {
    const group = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xa8bac9, metalness: 0.6, roughness: 0.45 });
    const signal = new THREE.MeshBasicMaterial({ color: 0x63eaff });
    const amber = new THREE.MeshBasicMaterial({ color: 0xffbd61 });
    if (kind === 'satellite') {
      const core = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 5), hull);
      group.add(core);
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(13, 0.35, 5), new THREE.MeshStandardMaterial({ color: 0x235b99, metalness: 0.45, roughness: 0.35 }));
        panel.position.x = side * 10;
        group.add(panel);
      }
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 12), amber);
      beacon.position.y = 4;
      group.add(beacon);
    } else if (kind === 'cargo') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshStandardMaterial({ color: 0xffb45c, metalness: 0.25, roughness: 0.55 }));
      group.add(crate);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 0.45), hull);
      group.add(stripe);
    } else if (kind === 'asteroid') {
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(9, 1),
        new THREE.MeshStandardMaterial({ color: 0x777682, roughness: 1, flatShading: true })
      );
      rock.scale.set(1.15, 0.8, 1);
      group.add(rock);
      const marker = new THREE.Mesh(new THREE.TorusGeometry(13, 0.35, 6, 40), signal);
      marker.rotation.x = Math.PI / 2;
      marker.position.y = -2;
      group.add(marker);
    } else if (kind === 'relay') {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 6, 12), hull);
      group.add(core);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), signal);
      dish.position.y = 4;
      dish.rotation.x = -Math.PI / 2;
      group.add(dish);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 8), hull);
      mast.position.y = 7;
      group.add(mast);
    } else if (kind === 'beacon') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2, 8, 8), hull);
      group.add(body);
      const light = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10), signal);
      light.position.y = 5;
      group.add(light);
      const fins = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 1.4), amber);
      fins.position.y = -2;
      group.add(fins);
    } else if (kind === 'sample') {
      const ice = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.2, 1),
        new THREE.MeshStandardMaterial({ color: 0x98f2e7, emissive: 0x237d83, emissiveIntensity: 0.6, roughness: 0.24, metalness: 0.08, flatShading: true })
      );
      ice.scale.set(0.8, 1.3, 0.85);
      group.add(ice);
    } else {
      const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 5, 5, 10), hull);
      capsule.rotation.x = Math.PI / 2;
      group.add(capsule);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), signal);
      lamp.position.y = 2;
      group.add(lamp);
    }
    group.position.copy(position);

    const glowColor = kind === 'cargo' ? 0xffa443 : kind === 'sample' ? 0x78ffe8 : 0x59deff;
    const glow = new THREE.PointLight(glowColor, 1.8, 48, 2);
    glow.position.y = 5;
    group.add(glow);
    this.group.add(group);
    return { group, kind, objectiveId, position, done: false, phase: Math.random() * Math.PI * 2 };
  }

  makeBeacon(position, objId) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xff526b, transparent: true, opacity: 0.72 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 28, 8), material);
    beam.position.y = 14;
    group.add(beam);
    group.position.copy(position);
    this.group.add(group);
    const beacon = { group, beam, material, pos: position, objId, hue: OBJECTIVE_HUES.return, dead: false };
    this.beaconList.push(beacon);
    return beacon;
  }

  nearestTarget(position, range) {
    let nearest = null;
    let nearestDistance = range;
    for (const target of this.targets) {
      if (target.done) continue;
      const distance = position.distanceTo(target.position);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    return nearest ? { target: nearest, distance: nearestDistance } : null;
  }

  completeTarget(target) {
    target.done = true;
    target.group.visible = false;
    for (const beacon of this.beaconList) {
      if (beacon.target === target) beacon.dead = true;
    }
  }

  dimObjective(objectiveId) {
    for (const target of this.targets) {
      if (target.objectiveId === objectiveId) target.group.visible = false;
    }
    for (const beacon of this.beaconList) {
      if (beacon.objId === objectiveId) beacon.dead = true;
    }
  }

  setReturnReady(ready) {
    this.returnReady = ready;
    this.returnBeacon.hue = ready ? 0.33 : OBJECTIVE_HUES.return;
    this.returnBeacon.material.color.setHSL(this.returnBeacon.hue, 1, 0.62);
  }

  update(dt, t, player, o2 = 100) {
    this.cockpitView.scale.x = Math.min(1, Math.max(0.62, this.camera.aspect / 1.35));
    this.ship.position.copy(player.pos);
    this.ship.rotation.order = 'YXZ';
    this.ship.rotation.set(player.pitch, player.yaw, 0);
    this.stationRing.rotation.z = t * 0.25;
    this.thruster.intensity = 1.2 + Math.min(player.vel.length() / 40, 1.5);
    if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
      this.drawFlightScreens(t, player, this.nearestTarget(player.pos, Infinity), o2);
    }
    for (const target of this.targets) {
      if (!target.done && target.kind !== 'asteroid') {
        target.group.rotation.y += dt * 0.18;
        target.group.position.y = target.position.y + Math.sin(t * 1.3 + target.phase) * 1.5;
      }
    }
    this.returnBeacon.material.opacity = this.returnReady ? 0.78 : 0.46 + Math.sin(t * 3) * 0.15;
    if (this.returnReady) this.returnBeacon.material.color.setHSL(0.33, 1, 0.62 + Math.sin(t * 3) * 0.12);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    });
    if (this.cockpitView) {
      this.camera.remove(this.cockpitView);
      this.cockpitView.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
    }
  }
}
