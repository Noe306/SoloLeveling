/* ==========================================================================
   habitats/light.js: Light Habitat (element 9). Inspiration: white marble arches
   on clouds (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): marble portico of three arches along the
   BACK (facing the camera), reflecting pool front-left (level 3), the dragon
   rests on the sun dais at the FRONT-right. Palette: white marble, gold, warm light.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  white marble island with golden veins underneath, soft clouds below,
          white flowers, small marble pedestals with golden orbs, light motes
     2  + portico of three marble arches (focal point), a golden sun disc with
          rays turning inside the central arch
     3  + reflecting pool with white lotuses, two golden braziers with white flames
     4  + sun dais: round marble platform with glowing golden sun-ray inlays
     5  + halo crown: big glowing halo above the arches, soft light beams
          falling from the sky, rising motes
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var PORT = { x: -0.38, z: -0.58 };                // centre of the portico (back)
  var ALONG = new V(1, 0, -1).normalize();          // the portico runs across the view
  var POOL = { x: -0.78, z: 0.5, r: 0.28 };

  var M = null;
  function mats() {
    if (M) return M;
    var dot = dotTexture(), st = K3.tex('stone'), lv = K3.tex('lava');
    // Marble is kept slightly warm/grey and not too shiny: pure white + bloom turns into a white blob.
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#f4f0e6' }),
      veins: new THREE.MeshStandardMaterial({ map: st.map, color: col('#e6e0d2'), roughness: 0.6, normalMap: lv.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
        emissiveMap: lv.emissiveMap, emissive: col('#ffcc40'), emissiveIntensity: 1.6 }),   // gold veins (glow pattern only)
      marble: new THREE.MeshStandardMaterial({ color: col('#e8e2d6'), roughness: 0.5, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 0.45 }),
      floor: new THREE.MeshStandardMaterial({ map: st.map, color: col('#f2ece0'), roughness: 0.5, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 0.45 }),
      gold: K3.mat('metal', { color: '#e8b84a', roughness: 0.25 }),
      sun: K3.mat('glow', { color: '#ffd76a', intensity: 2.2 }),
      cloud: new THREE.MeshStandardMaterial({ color: col('#fbfcff'), roughness: 1, envMapIntensity: 0.6 }),
      petal: new THREE.MeshStandardMaterial({ color: col('#fffdf6'), emissive: col('#fff2c0'), emissiveIntensity: 0.15, roughness: 0.5, flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ color: col('#8ab86a'), roughness: 0.7, side: THREE.DoubleSide }),
      water: new THREE.MeshStandardMaterial({ color: col('#5a9ccc'), roughness: 0.3, metalness: 0, envMapIntensity: 0.35, emissive: col('#fff0c0'), emissiveIntensity: 0.04 }),
      flame: new THREE.SpriteMaterial({ map: flameTexture(), color: col('#fff4d0'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      beam: new THREE.MeshBasicMaterial({ color: col('#fff2c8'), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      mote: new THREE.PointsMaterial({ map: dot, color: col('#ffe8a0'), size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  }
  function flameTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 128;
    var x = c.getContext('2d'); x.translate(32, 100); x.scale(1, 2.2);
    var g = x.createRadialGradient(0, 0, 0, 0, -6, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,245,200,0.9)'); g.addColorStop(0.6, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, -10, 32, 0, Math.PI * 2); x.fill();
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }
  function Y(x, z) { return domeY(Math.hypot(x, z)); }
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  function island(ctx, R) {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 141, squash: 0.42, lumpy: 0.2, material: M.veins });
    under.scale.set(1, 0.85, 1); under.position.y = 0.0; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 18, squash: 0.08, lumpy: 0.04, flat: false, material: M.floor });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    var trim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.025, 6, 96), M.gold); trim.rotation.x = Math.PI / 2; trim.position.y = 0.47; g.add(trim);   // golden rim band
    for (var i = 0; i < 7; i++) {                                           // soft clouds below the island
      var a = -0.6 + i / 6 * 2.8, c = K3.rock({ radius: 0.2 + R() * 0.08, detail: 2, seed: 400 + i, squash: 0.6, lumpy: 0.18, flat: false, material: M.cloud });
      c.castShadow = false; c.position.set(Math.cos(a) * 1.2, -0.05 + R() * 0.1, Math.sin(a) * 1.2); g.add(c);
      (function (cl, y0, ph) { ctx.anim(function (t) { cl.position.y = y0 + Math.sin(t * 0.5 + ph) * 0.02; }); })(c, c.position.y, i);
    }
    return g;
  }

  // Round marble arch facing the camera: two pillars (base + capital), half-ring on top, gold keystone.
  function arch(w, h, r) {
    var g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      var base = K3.roundedBox(r * 3, 0.06, r * 3, 0.01, M.marble); base.position.set(s * w / 2, 0.03, 0); g.add(base);
      var col1 = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), M.marble); col1.position.set(s * w / 2, 0.06 + h / 2, 0); col1.castShadow = col1.receiveShadow = true; g.add(col1);
      var capi = K3.roundedBox(r * 2.8, 0.05, r * 2.8, 0.01, M.marble); capi.position.set(s * w / 2, 0.085 + h, 0); g.add(capi);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 0.01, 4, 16), M.gold); ring.rotation.x = Math.PI / 2; ring.position.set(s * w / 2, 0.1 + h * 0.6, 0); g.add(ring);
    });
    var top = new THREE.Mesh(new THREE.TorusGeometry(w / 2, r * 0.95, 8, 32, Math.PI), M.marble); top.position.y = 0.11 + h; top.castShadow = true; g.add(top);
    var key = K3.roundedBox(r * 1.8, r * 2.2, r * 2.2, 0.01, M.gold); key.position.y = 0.11 + h + w / 2; g.add(key);
    g.userData.innerY = 0.11 + h;
    return g;
  }

  function sunDisc(ctx, s) {
    var g = new THREE.Group();
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.03, 32), M.sun); disc.rotation.x = Math.PI / 2; g.add(disc);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.13 * s, 0.012, 6, 32), M.gold); g.add(rim);
    var rays = new THREE.Group(); g.add(rays);
    for (var i = 0; i < 12; i++) {
      var ray = new THREE.Mesh(new THREE.ConeGeometry(0.025 * s, (i % 2 ? 0.1 : 0.16) * s, 4), M.gold), a = i / 12 * Math.PI * 2;
      ray.position.set(Math.cos(a) * 0.2 * s, Math.sin(a) * 0.2 * s, 0); ray.rotation.z = a - Math.PI / 2; rays.add(ray);
    }
    ctx.anim(function (t) { rays.rotation.z = t * 0.4; });
    return g;
  }

  function lily(x, z, s) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    var pad = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14, 0.3, Math.PI * 2 - 0.6), M.leaf); pad.rotation.x = -Math.PI / 2; g.add(pad);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), M.petal);
      p.position.set(Math.cos(a) * 0.02, 0.03, Math.sin(a) * 0.02); p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(p);
    }
    return g;
  }

  function brazier(ctx, phase) {
    var g = new THREE.Group();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.32, 10), M.marble); stem.position.y = 0.16; g.add(stem);
    var prof = [[0, 0], [0.06, 0], [0.12, 0.05], [0.13, 0.09], [0.11, 0.08], [0, 0.06]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), M.gold); bowl.position.y = 0.32; g.add(bowl);
    var f = new THREE.Sprite(M.flame); f.center.set(0.5, 0.08); f.position.y = 0.39; g.add(f);
    ctx.anim(function (t) { var k = 1 + 0.15 * Math.sin(t * 9 + phase); f.scale.set(0.24 * (1.1 - (k - 1)), 0.45 * k, 1); });
    var l = new THREE.PointLight(col('#fff0c0'), 0.7, 1.5, 2); l.position.y = 0.5; g.add(l);
    return g;
  }

  function motes(ctx, R, n, spread, y0, y1) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * spread; pos[i * 3 + 1] = y0 + R() * (y1 - y0); pos[i * 3 + 2] = (R() - 0.5) * spread; seed.push(R() * 6.28); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) { pos[q * 3 + 1] += dt * 0.12; pos[q * 3] += Math.sin(t + seed[q]) * dt * 0.04; if (pos[q * 3 + 1] > y1) pos[q * 3 + 1] = y0; }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, M.mote);
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(47), g = new THREE.Group();
    g.add(island(ctx, R));

    /* ===== Level 1 ===== */
    [[1.05, -0.3], [0.05, 1.08], [-1.08, -0.05]].forEach(function (p) {     // marble pedestals with golden orbs
      var y = Y(p[0], p[1]), ped = K3.roundedBox(0.14, 0.2, 0.14, 0.02, M.marble); ped.position.set(p[0], y + 0.1, p[1]); g.add(ped);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), M.gold); orb.position.set(p[0], y + 0.25, p[1]); g.add(orb);
    });
    for (var f = 0; f < 22; f++) {                                           // little white flowers
      var a = R() * Math.PI * 2, r = 0.7 + R() * 0.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.1) continue;
      var fl = new THREE.Group(); fl.position.set(x, Y(x, z), z); g.add(fl);
      for (var k = 0; k < 5; k++) { var p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.petal); p.scale.set(1, 0.4, 0.6); p.position.set(Math.cos(k * 1.26) * 0.018, 0.03, Math.sin(k * 1.26) * 0.018); fl.add(p); }
      var c = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), M.gold); c.position.y = 0.035; fl.add(c);
    }
    g.add(motes(ctx, R, 24, 2.4, TOP, TOP + 1.2));
    var warm = new THREE.PointLight(col('#fff0c8'), 0.5, 3, 2); warm.position.set(0.2, TOP + 1.0, 0.2); g.add(warm);

    /* ===== Level 2: portico + sun disc ===== */
    var bigArch = null;
    if (level >= 2) {
      [[-0.62, 0.38, 0.82, 0.05], [0, 0.62, 1.2, 0.07], [0.62, 0.38, 0.82, 0.05]].forEach(function (a, i) {
        var pos = new V(PORT.x, 0, PORT.z).addScaledVector(ALONG, a[0]);
        var ar = arch(a[1], a[2], a[3]); ar.position.set(pos.x, Y(pos.x, pos.z) - 0.01, pos.z); ar.rotation.y = Math.PI / 4; g.add(ar);
        if (i === 1) bigArch = ar;
      });
      var step = K3.roundedBox(1.9, 0.05, 0.36, 0.015, M.marble); step.position.set(PORT.x, Y(PORT.x, PORT.z) - 0.015, PORT.z); step.rotation.y = Math.PI / 4; g.add(step);
      var sd = sunDisc(ctx, 1.1); sd.position.set(0, bigArch.userData.innerY - 0.05, 0); bigArch.add(sd);
      var sunL = new THREE.PointLight(col('#ffd76a'), 1.4, 3.5, 2); sunL.position.set(PORT.x + 0.3, TOP + 1.2, PORT.z + 0.3); g.add(sunL);
    }

    /* ===== Level 3: reflecting pool + braziers ===== */
    if (level >= 3) {
      var py = Y(POOL.x, POOL.z);
      var rimP = new THREE.Mesh(new THREE.TorusGeometry(POOL.r, 0.035, 8, 40), M.marble); rimP.rotation.x = Math.PI / 2; rimP.position.set(POOL.x, py + 0.02, POOL.z); g.add(rimP);
      var water = new THREE.Mesh(new THREE.CircleGeometry(POOL.r, 40), M.water); water.rotation.x = -Math.PI / 2; water.position.set(POOL.x, py + 0.025, POOL.z); g.add(water);
      [[0.08, 0.05, 1], [-0.12, -0.06, 0.8], [0.02, -0.14, 0.9]].forEach(function (l) { var lp = lily(POOL.x + l[0], POOL.z + l[1], l[2]); lp.position.y = py + 0.028; g.add(lp); });
      [[0.98, -0.62, 0], [-0.25, 1.05, 2]].forEach(function (b) { var br = brazier(ctx, b[2]); br.position.set(b[0], Y(b[0], b[1]), b[1]); g.add(br); });
    }

    /* ===== Level 4: sun dais ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var dais = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.07, 48), M.marble); dais.position.set(SPOT.x, y0 + 0.02, SPOT.z); dais.castShadow = dais.receiveShadow = true; g.add(dais);
      var gring = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.01, 0.02, 8, 64), M.gold); gring.rotation.x = Math.PI / 2; gring.position.set(SPOT.x, y0 + 0.055, SPOT.z); g.add(gring);
      var centre = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 24), M.sun); centre.position.set(SPOT.x, y0 + 0.058, SPOT.z); g.add(centre);
      for (var rr = 0; rr < 12; rr++) {                                     // sun-ray inlays
        var ra = rr / 12 * Math.PI * 2, len = rr % 2 ? 0.22 : 0.32;
        var ray = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.03), M.sun);
        ray.position.set(SPOT.x + Math.cos(ra) * (0.12 + len / 2), y0 + 0.058, SPOT.z + Math.sin(ra) * (0.12 + len / 2)); ray.rotation.y = -ra; g.add(ray);
      }
      ctx.anim(function (t) { M.sun.emissiveIntensity = 2.2 + Math.sin(t * 1.4) * 0.4; });
    }

    /* ===== Level 5: halo + light beams ===== */
    if (level >= 5) {
      var halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 10, 64), M.sun);
      halo.position.set(PORT.x, TOP + 2.0, PORT.z); halo.lookAt(new V(PORT.x, TOP + 2.0, PORT.z).add(new V(1, 0.5, 1))); g.add(halo);
      var halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.008, 6, 64), M.gold); halo2.position.copy(halo.position); halo2.quaternion.copy(halo.quaternion); g.add(halo2);
      ctx.anim(function (t) { halo.position.y = TOP + 2.0 + Math.sin(t * 0.8) * 0.05; halo2.position.y = halo.position.y; halo2.rotation.z = t * 0.3; });
      // One faint beam of light falling on the dais (several solid beams read as glass tubes)
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r * 0.35, SPOT.r * 0.95, 2.6, 32, 1, true), M.beam);
      beam.position.set(SPOT.x, Y(SPOT.x, SPOT.z) + 1.3, SPOT.z); g.add(beam);
      ctx.anim(function (t) { M.beam.opacity = 0.05 + Math.sin(t * 0.6) * 0.02; });
      g.add(motes(ctx, R, 30, 1.6, TOP + 0.5, TOP + 2.4));
      var haloL = new THREE.PointLight(col('#ffe9a0'), 1.2, 3, 2); haloL.position.set(PORT.x, TOP + 2.0, PORT.z); g.add(haloL);
    }
    return g;
  }

  HABITATS.register({ id: 'light', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.06, z: SPOT.z, r: SPOT.r }, build: build });
})();
