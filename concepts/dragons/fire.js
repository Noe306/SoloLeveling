/* ==========================================================================
   dragons/fire.js: Fire dragon, full evolution chain (own design).

     Egg        dark crimson scaled shell with glowing lava veins, resting in a
                small nest of basalt stones and embers (Hatchery)
     Hatchling  chubby, sitting, big head and eyes, tiny wing stubs, horn nubs,
                a little flame on the tail tip (Lv 1-9)
     Juvenile   standing on four legs, longer neck and tail, half-folded wings,
                first horns and back spikes, bigger tail flame (Lv 10-19)
     Adult      powerful, long curved neck, swept-back horns, cheek spikes, fangs,
                wings raised, burning tail, smoke from the nostrils, embers (Lv 20+)

   Built with DK (dragons/dragonkit.js); this file only holds the palette,
   the proportions per stage and the fire effects.
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;

  // glow = colour of the lava veins / belly seams; spikeTip/membraneEdge glow a little too.
  var PALETTE = {
    body: '#b8281a', top: '#5e140e', belly: '#ff9a2e', horn: '#f3e2bd', hornBase: '#3a1e18', claw: '#1e1210',
    spike: '#2a100c', spikeTip: '#ff8a2a', spikeGlow: 0.55, bone: '#4a160e',
    membrane: '#ff6a22', membraneEdge: '#ffc35a', edgeGlow: 0.45, vein: '#6a140c',
    eye: '#ffd23a', glow: '#ff6a14', glowI: 2.0, mouth: '#c2300e'
  };
  // The hatchling is a brighter, softer red with no dark armour yet.
  var BABY = Object.assign({}, PALETTE, { body: '#e0482a', top: '#b02e1a', belly: '#ffb04a', spike: '#b02e1a', spikeTip: '#ffb04a', spikeGlow: 0.2, bone: '#a52a18', vein: '#a52a18', edgeGlow: 0.2 });

  var SPECS = {
    hatchling: {
      palette: BABY, bodyR: 0.2, bodyLen: 0.26, legLen: 0.12, legR: 0.066, sit: 1, chestRise: 0.02,
      neckLen: 0.1, neckR: 0.13, tailLen: 0.5, tailR: 0.12, tailCurl: 0.9, scaleSize: 0.07, phase: 0.3,
      stripes: 0, veins: { amount: 0.3, freq: 6, width: 0.035 },
      head: { len: 0.37, w: 0.19, h: 0.18, snout: 0.6, eye: 0.066, pitch: 0.05, angry: 0.02, cute: true,
        horns: [{ t: 0.24, x: 0.55, len: 0.09, r: 0.028, up: 0 }] },
      wings: { len: 0.32, fold: 0.2, raise: 0.15, sweep: 0.4, tilt: 0.25, flap: 0.25, bone: 0.05 },
      spikes: { count: 5, h: 0.06 },
      flame: 0.12
    },
    juvenile: {
      palette: PALETTE, bodyR: 0.23, bodyLen: 0.5, legLen: 0.22, legR: 0.085, chestRise: 0.06,
      neckLen: 0.38, neckR: 0.095, tailLen: 0.8, tailR: 0.14, tailCurl: 0.5, scaleSize: 0.08, phase: 1.1,
      stripes: 6, veins: { amount: 0.55, freq: 4, width: 0.04 },
      head: { len: 0.38, w: 0.15, h: 0.135, snout: 0.75, eye: 0.04, pitch: 0.3, angry: 0.22, cheek: 1, fangs: true,
        horns: [{ t: 0.2, x: 0.6, len: 0.24, r: 0.034, up: 0.1 }] },
      wings: { len: 0.72, fold: 0.45, raise: 0.1, sweep: 0.45, tilt: 0.3, flap: 0.08, bone: 0.035 },
      spikes: { count: 7, h: 0.11 },
      flame: 0.24
    },
    adult: {
      palette: PALETTE, bodyR: 0.34, bodyLen: 0.74, legLen: 0.28, legR: 0.12, chestRise: 0.12,
      neckLen: 0.58, neckR: 0.13, tailLen: 1.15, tailR: 0.2, tailCurl: 0.45, scaleSize: 0.1, phase: 2.3,
      stripes: 8, veins: { amount: 0.85, freq: 3, width: 0.04 }, detail: 1.4,
      head: { len: 0.54, w: 0.2, h: 0.165, snout: 1, eye: 0.042, pitch: 0.34, angry: 0.4, cheek: 3, jaw: 0.2,
        horns: [{ t: 0.16, x: 0.55, len: 0.5, r: 0.055, up: 0.18 }, { t: 0.3, x: 0.85, len: 0.24, r: 0.032, up: 0 }] },
      wings: { len: 1.25, fold: 0.05, raise: 0.16, sweep: 0.42, tilt: 0.35, flap: 0.12, bone: 0.032 },
      spikes: { count: 10, h: 0.2 },
      flame: 0.42, smoke: true, embers: true
    }
  };

  /* ------------------------- fire effects ------------------------- */
  var FX = null;
  function fx() {
    if (FX) return FX;
    function flameTex() {
      var c = document.createElement('canvas'); c.width = 64; c.height = 128;
      var x = c.getContext('2d'); x.translate(32, 100); x.scale(1, 2.2);
      var g = x.createRadialGradient(0, 0, 0, 0, -6, 30);
      g.addColorStop(0, 'rgba(255,248,220,1)'); g.addColorStop(0.22, 'rgba(255,214,90,0.95)');
      g.addColorStop(0.5, 'rgba(255,110,25,0.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, -10, 32, 0, Math.PI * 2); x.fill();
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    function dotTex() {
      var c = document.createElement('canvas'); c.width = c.height = 32;
      var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
    }
    var dot = dotTex();
    FX = {
      flame: new THREE.SpriteMaterial({ map: flameTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      ember: new THREE.PointsMaterial({ map: dot, color: col('#ffa040'), size: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      smoke: new THREE.SpriteMaterial({ map: dot, color: col('#6a6460'), transparent: true, opacity: 0.5, depthWrite: false }),
      basalt: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#8a7f80' }),
      coal: K3.mat('glow', { color: '#ff5a1a', intensity: 2.0 })
    };
    return FX;
  }

  // Flickering flame sprite with its base at the parent's origin.
  function flame(ctx, w, h, phase) {
    var s = new THREE.Sprite(fx().flame); s.center.set(0.5, 0.1); s.scale.set(w, h, 1);
    ctx.anim(function (t) { var f = 1 + 0.18 * Math.sin(t * 13 + phase) + 0.1 * Math.sin(t * 7.3 + phase * 2); s.scale.set(w * (1.1 - (f - 1) * 0.6), h * f, 1); });
    return s;
  }

  // Embers rising around the dragon.
  function embers(ctx, R, n, spread, height) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * spread; pos[i * 3 + 1] = R() * height; pos[i * 3 + 2] = (R() - 0.5) * spread; seed.push(R() * 6.28); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        pos[q * 3 + 1] += dt * (0.25 + (q % 5) * 0.05); pos[q * 3] += Math.sin(t * 2 + seed[q]) * dt * 0.06;
        if (pos[q * 3 + 1] > height) pos[q * 3 + 1] = 0.05;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, fx().ember);
  }

  // Smoke puffs drifting up from the nostrils (local to the head).
  function smoke(ctx, nose) {
    var g = new THREE.Group(), puffs = [];
    for (var i = 0; i < 4; i++) { var s = new THREE.Sprite(fx().smoke.clone()); g.add(s); puffs.push(s); }
    ctx.anim(function (t) {
      puffs.forEach(function (s, i) {
        var k = ((t * 0.45 + i / puffs.length) % 1);
        s.position.set(nose.x + Math.sin(i * 2 + t) * 0.02, nose.y + 0.03 + k * 0.35, nose.z + k * 0.08);
        s.scale.setScalar(0.05 + k * 0.16); s.material.opacity = 0.45 * (1 - k) * Math.min(1, k * 6);
      });
    });
    return g;
  }

  /* ------------------------- build ------------------------- */
  function build(stage, ctx) {
    var R = ctx.rng(5);
    if (stage === 'egg') return buildEgg(ctx, R);
    var spec = SPECS[stage], d = DK.dragon(spec, ctx), parts = d.userData.parts;
    // Flame burning on the tail tip
    var tipFlame = new THREE.Group(); tipFlame.position.copy(parts.tailTip); parts.tail.add(tipFlame);
    var core = new THREE.Mesh(new THREE.SphereGeometry(spec.flame * 0.12, 10, 8), fx().coal); tipFlame.add(core);
    tipFlame.add(flame(ctx, spec.flame * 0.55, spec.flame, 1.7));
    if (spec.flame > 0.3) tipFlame.add(flame(ctx, spec.flame * 0.35, spec.flame * 0.7, 4.1));
    var tl = new THREE.PointLight(col('#ff8a3a'), 0.9 * spec.flame / 0.42 + 0.3, 1.5 + spec.flame * 2, 2); tipFlame.add(tl);
    if (spec.smoke) parts.head.add(smoke(ctx, parts.head.userData.nose));
    if (spec.embers) d.add(embers(ctx, R, 40, 2.2, 1.8));
    // Warm glow in the throat/chest (adult + juvenile): a light, so the belly reads as hot
    if (stage !== 'hatchling') { var chest = new THREE.PointLight(col('#ff7a2a'), 0.5, 1.2, 2); chest.position.copy(parts.chest).add(new THREE.Vector3(0, -0.1, 0.35)); d.add(chest); }
    return d;
  }

  function buildEgg(ctx, R) {
    var g = new THREE.Group();
    var egg = DK.egg({ h: 0.5, w: 0.2, shell: '#4a0f0a', shellTop: '#8e2412', scale: '#c8582a', glow: '#ffb040', veins: 6, seed: 9 }, ctx);
    egg.position.y = 0.04; g.add(egg);
    // Nest: ring of basalt stones with glowing coals between them
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2, rk = K3.rock({ radius: 0.07 + R() * 0.03, detail: 2, seed: 30 + i, squash: 0.7, color: '#4d3d3a', top: '#2e2523', topAmount: 0.4, material: fx().basalt });
      rk.position.set(Math.cos(a) * 0.24, 0.03, Math.sin(a) * 0.24); g.add(rk);
      var coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.025 + R() * 0.015, 0), fx().coal);
      coal.position.set(Math.cos(a + 0.35) * 0.2, 0.02, Math.sin(a + 0.35) * 0.2); g.add(coal);
    }
    g.add(embers(ctx, R, 18, 0.5, 0.8));
    var l = new THREE.PointLight(col('#ff8a3a'), 0.8, 1.4, 2); l.position.set(0, 0.15, 0.2); g.add(l);
    g.userData = { height: 0.6 };
    return g;
  }

  DRAGONS.register({ id: 'fire', stages: ['egg', 'hatchling', 'juvenile', 'adult'], build: build });
})();
