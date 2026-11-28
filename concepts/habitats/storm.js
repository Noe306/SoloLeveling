/* ==========================================================================
   habitats/storm.js: Storm Habitat (element 13). Inspiration: grey rocks with
   mist (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): jagged pinnacles at the BACK-left (the storm
   cloud gathers above them), the dragon rests on the storm perch at the
   FRONT-right. Palette: slate grey, blue-white lightning, dark clouds.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  craggy grey island, jagged rocks, low mist, puddles, wind-bent grey grass,
          drizzle
     2  + cluster of tall jagged pinnacles (focal point) with a glowing blue storm
          crystal on top
     3  + iron lightning rod on the pinnacles, dark storm cloud above raining,
          lightning strikes the rod with a flash
     4  + storm perch: grey slab with glowing blue runes, four standing stones with
          small arcs crackling between them
     5  + tempest: a ring of dark clouds turning above the island, heavier rain,
          extra strikes, swirling wind
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var PEAK = { x: -0.55, z: -0.55 };

  var M = null;
  function mats() {
    if (M) return M;
    var dot = dotTexture();
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#c8ccd4' }),
      ground: K3.mat('stone', { repeat: 2, color: '#8a909c' }),
      slab: K3.mat('stone', { flat: true, repeat: 1, color: '#9aa0aa' }),
      iron: K3.mat('metal', { color: '#4a505a', roughness: 0.45 }),
      copper: K3.mat('metal', { color: '#c8784a', roughness: 0.35 }),
      // dark and not too shiny: the front puddle caught the sky and showed as a white patch
      puddle: new THREE.MeshStandardMaterial({ color: col('#2a3240'), roughness: 0.55, metalness: 0, envMapIntensity: 0.15 }),
      blade: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, flatShading: true }),
      rune: K3.mat('glow', { color: '#8fd8ff', intensity: 2.2 }),
      cloud: new THREE.MeshStandardMaterial({ color: col('#3a404e'), roughness: 1, flatShading: true }),
      bolt: new THREE.MeshBasicMaterial({ color: col('#eef8ff'), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      boltGlow: new THREE.MeshBasicMaterial({ color: col('#7fc8ff'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      rain: new THREE.LineBasicMaterial({ color: col('#c8dcf0'), transparent: true, opacity: 0.45 }),
      mist: new THREE.SpriteMaterial({ map: dot, color: col('#d0d6e0'), transparent: true, opacity: 0.25, depthWrite: false }),
      streak: new THREE.MeshBasicMaterial({ color: col('#e8f0ff'), transparent: true, opacity: 0.4, depthWrite: false })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }

  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }
  function Y(x, z) { return domeY(Math.hypot(x, z)); }
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  function island() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 161, squash: 0.45, lumpy: 0.3, color: '#7a808c', top: '#9aa0aa', topAmount: 0.3, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.04; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 20, squash: 0.08, lumpy: 0.06, flat: false, material: M.ground });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Jagged rock: tall rock pinched to a point (shard-like).
  function crag(r, h, seed) {
    var m = K3.rock({ radius: r, detail: 3, seed: seed, squash: h / r, lumpy: 0.35, color: '#7a808c', top: '#a8aeb8', topAmount: 0.3, material: M.rock });
    var p = m.geometry.attributes.position;
    for (var i = 0; i < p.count; i++) { var y = p.getY(i), k = y > 0 ? Math.max(0.08, 1 - y / (h * 1.05)) : 1; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    m.geometry.computeVertexNormals();
    return m;
  }

  // Lightning bolt of thin glowing segments; zap(a, b, jitter, R) re-shapes it (same idea as electric.js).
  function bolt(n, r) {
    var g = new THREE.Group(), segs = [], up = new V(0, 1, 0);
    var core = new THREE.CylinderGeometry(r, r, 1, 4, 1, true), halo = new THREE.CylinderGeometry(r * 3, r * 3, 1, 6, 1, true);
    for (var i = 0; i < n; i++) { var s = new THREE.Mesh(core, M.bolt); s.add(new THREE.Mesh(halo, M.boltGlow)); g.add(s); segs.push(s); }
    g.zap = function (a, b, jitter, R) {
      var prev = a.clone(), dir = new V();
      for (var i = 0; i < n; i++) {
        var p = a.clone().lerp(b, (i + 1) / n);
        if (i < n - 1) p.add(new V((R() - 0.5) * jitter, (R() - 0.5) * jitter * 0.4, (R() - 0.5) * jitter));
        dir.subVectors(p, prev); var len = dir.length();
        segs[i].position.copy(prev).addScaledVector(dir, 0.5); segs[i].quaternion.setFromUnitVectors(up, dir.normalize()); segs[i].scale.set(1, len, 1);
        prev = p;
      }
    };
    return g;
  }

  // Rain: short falling line segments inside a cylinder (cx, cz, radius) from y1 down to the ground.
  function rain(ctx, R, n, cx, cz, rad, y1, speed) {
    var pos = new Float32Array(n * 6), drops = [];
    for (var i = 0; i < n; i++) { var a = R() * 6.28, r = Math.sqrt(R()) * rad; drops.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: R() * y1, v: speed * (0.8 + R() * 0.4) }); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      drops.forEach(function (d, i) {
        d.y -= d.v * dt; var floor = Y(d.x, d.z); if (d.y < floor) d.y = y1;
        pos[i * 6] = d.x; pos[i * 6 + 1] = d.y; pos[i * 6 + 2] = d.z;
        pos[i * 6 + 3] = d.x + 0.02; pos[i * 6 + 4] = d.y + 0.09; pos[i * 6 + 5] = d.z + 0.02;   // slanted by the wind
      });
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.LineSegments(geo, M.rain);
  }

  function cloudPuffs(R, n, spread, s) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var p = K3.rock({ radius: s * (0.7 + R() * 0.5), detail: 2, seed: 700 + Math.floor(R() * 999), squash: 0.55, lumpy: 0.25, flat: true, material: M.cloud });
      p.castShadow = false; p.position.set((R() - 0.5) * spread, (R() - 0.5) * s * 0.4, (R() - 0.5) * spread * 0.6); g.add(p);
    }
    return g;
  }

  function mist(ctx, R, n, spread, y, size) {
    var g = new THREE.Group(), list = [];
    for (var i = 0; i < n; i++) { var s = new THREE.Sprite(M.mist); s.scale.setScalar(size * (0.7 + R() * 0.6)); g.add(s); list.push({ s: s, x: (R() - 0.5) * spread, z: (R() - 0.5) * spread, ph: R() * 6.28 }); }
    ctx.anim(function (t) { list.forEach(function (m) { m.s.position.set(m.x + Math.sin(t * 0.25 + m.ph) * 0.35, y, m.z + Math.cos(t * 0.2 + m.ph) * 0.2); }); });
    return g;
  }

  function streak(ctx, r, arc, y, speed, phase) {
    var m = M.streak.clone(), s = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 4, 40, arc), m);
    s.rotation.x = Math.PI / 2 + 0.2; s.position.y = y;
    var h = new THREE.Group(); h.add(s);
    ctx.anim(function (t) { h.rotation.y = t * speed + phase; m.opacity = 0.45 * Math.sin(((t * 0.6 + phase) % 1) * Math.PI); });
    return h;
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(59), g = new THREE.Group();
    g.add(island());

    /* ===== Level 1 ===== */
    [[1.05, -0.4, 0.14, 0.3, 1], [-1.05, 0.45, 0.12, 0.26, 2], [0.15, 1.08, 0.1, 0.2, 3], [-0.25, -1.05, 0.13, 0.28, 4], [1.08, 0.5, 0.09, 0.18, 5]].forEach(function (c) {
      var cr = crag(c[2], c[3], 30 + c[4]); cr.position.set(c[0], Y(c[0], c[1]), c[1]); cr.rotation.z = (R() - 0.5) * 0.3; g.add(cr);
    });
    [[0.75, -0.75, 0.16], [-0.85, 0.05, 0.13], [0.95, 0.9, 0.12]].forEach(function (p) {
      var s = new THREE.Shape(), n = 16;
      for (var i = 0; i <= n; i++) { var a = i / n * Math.PI * 2, rr = p[2] * (1 + 0.25 * Math.sin(a * 3 + p[0] * 5)); if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      var pd = new THREE.Mesh(new THREE.ShapeGeometry(s), M.puddle); pd.rotation.x = -Math.PI / 2; pd.position.set(p[0], Y(p[0], p[1]) + 0.01, p[1]); g.add(pd);
    });
    var bladeG = new THREE.ConeGeometry(0.01, 0.14, 3); bladeG.translate(0, 0.07, 0);           // wind-bent grey-green grass (see guide 7c)
    var tones = ['#8a9a7a', '#a0a890', '#7a8a6e', '#b0b4a0'];
    g.add(K3.scatter(bladeG, M.blade, 700, function (i, Rr) {
      var a = Rr() * Math.PI * 2, r = Math.sqrt(Rr()) * 1.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.1 || (level >= 2 && Math.hypot(x - PEAK.x, z - PEAK.z) < 0.45)) return null;
      return { x: x, y: domeY(r) - 0.015, z: z, s: 0.6 + Rr() * 0.7, rx: 0.35, rz: -0.45, ry: Rr() * 0.3, color: tones[i % 4] };
    }, 61));
    g.add(mist(ctx, R, 10, 2.4, TOP + 0.08, 0.7));
    g.add(rain(ctx, R, level >= 5 ? 220 : 60, 0, 0, 1.3, TOP + 2.2, 2.4));

    /* ===== Level 2: jagged pinnacles + storm crystal ===== */
    var rodTip = new V(PEAK.x, TOP + 1.78, PEAK.z), crownGlow = null;
    if (level >= 2) {
      [[0, 0, 0.26, 1.35, 1], [0.28, 0.12, 0.17, 0.85, 2], [-0.15, 0.3, 0.15, 0.7, 3], [0.2, -0.25, 0.14, 0.6, 4], [-0.3, -0.12, 0.12, 0.5, 5]].forEach(function (c) {
        var cr = crag(c[2], c[3], 60 + c[4]); cr.position.set(PEAK.x + c[0], TOP - 0.02, PEAK.z + c[1]); cr.rotation.set((R() - 0.5) * 0.15, R() * 3, (R() - 0.5) * 0.15); g.add(cr);
      });
      // Iron storm crown clamped around the top of the peak: band + collar, 8 prongs leaning outwards,
      // copper coils. (Replaces the earlier storm crystal, which read as a white spike.)
      var crown = new THREE.Group(); crown.position.set(PEAK.x, TOP + 1.08, PEAK.z); g.add(crown);
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 12, 1, true), M.iron); band.material.side = THREE.DoubleSide; crown.add(band);
      var collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.016, 6, 24), M.iron); collar.rotation.x = Math.PI / 2; collar.position.y = 0.035; crown.add(collar);
      var lower = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 6, 24), M.copper); lower.rotation.x = Math.PI / 2; lower.position.y = -0.03; crown.add(lower);
      for (var p = 0; p < 8; p++) {
        var pa = p / 8 * Math.PI * 2, prong = new THREE.Mesh(new THREE.ConeGeometry(0.014, p % 2 ? 0.14 : 0.2, 5), M.iron);
        prong.position.set(Math.cos(pa) * 0.1, 0.1, Math.sin(pa) * 0.1); prong.rotation.set(Math.sin(pa) * 0.35, 0, -Math.cos(pa) * 0.35); prong.castShadow = true; crown.add(prong);
        var rivet = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), M.copper); rivet.position.set(Math.cos(pa + 0.4) * 0.115, 0, Math.sin(pa + 0.4) * 0.115); crown.add(rivet);
      }
      crownGlow = new THREE.PointLight(col('#8fd0ff'), 0, 1.5, 2); crownGlow.position.set(PEAK.x, TOP + 1.25, PEAK.z); g.add(crownGlow);
    }

    /* ===== Level 3: lightning rod + storm cloud + strikes ===== */
    if (level >= 3) {
      // Lightning rod rising from the centre of the iron crown, copper coils, pointed tip
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.6, 6), M.iron); rod.position.set(PEAK.x, TOP + 1.42, PEAK.z); rod.castShadow = true; g.add(rod);
      var tipC = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 6), M.copper); tipC.position.set(PEAK.x, TOP + 1.75, PEAK.z); g.add(tipC);
      [0.18, 0.3, 0.42].forEach(function (y) { var coil = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14), M.copper); coil.rotation.x = Math.PI / 2; coil.position.set(PEAK.x, TOP + 1.12 + y, PEAK.z); g.add(coil); });
      var cloud = cloudPuffs(R, 7, 1.1, 0.3); cloud.position.set(PEAK.x + 0.15, TOP + 2.55, PEAK.z + 0.1); g.add(cloud);
      ctx.anim(function (t) { cloud.position.x = PEAK.x + 0.15 + Math.sin(t * 0.3) * 0.06; cloud.rotation.y = Math.sin(t * 0.2) * 0.2; });
      g.add(rain(ctx, R, 70, PEAK.x + 0.15, PEAK.z + 0.1, 0.5, TOP + 2.35, 2.8));
      var strike = bolt(10, 0.016); g.add(strike);
      var flash = new THREE.PointLight(col('#dff0ff'), 0, 5, 2); flash.position.set(PEAK.x, TOP + 2.0, PEAK.z); g.add(flash);
      var KR = K3.rng(31), lastK = -1;
      ctx.anim(function (t) {
        var cyc = t % 3.0, on = cyc < 0.22;
        strike.visible = on; flash.intensity = on ? 4 * (1 - cyc / 0.22) : 0;
        if (crownGlow) crownGlow.intensity = 1.5 * Math.max(0, 1 - cyc / 0.8);   // the crown keeps glowing a moment after each hit
        var k = Math.floor(t * 16); if (!on || k === lastK) return; lastK = k;
        strike.zap(new V(PEAK.x + 0.1, TOP + 2.4, PEAK.z), rodTip, 0.22, KR);
      });
    }

    /* ===== Level 4: storm perch ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var slab = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.05, 0.08, 10), M.slab); slab.position.set(SPOT.x, y0 + 0.02, SPOT.z); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      // Rune: a zig-zag lightning glyph + ring
      var zig = [[-0.18, 0.2], [0.03, 0.05], [-0.06, 0.0], [0.15, -0.2]].map(function (p) { return [SPOT.x + p[0], y0 + 0.065, SPOT.z + p[1]]; });
      for (var z = 0; z < zig.length - 1; z++) {
        var a = new V().fromArray(zig[z]), b = new V().fromArray(zig[z + 1]), d = b.clone().sub(a);
        var seg = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.008, 0.03), M.rune); seg.position.copy(a).addScaledVector(d, 0.5); seg.rotation.y = -Math.atan2(d.z, d.x); g.add(seg);
      }
      var rr = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r * 0.8, 0.01, 4, 48), M.rune); rr.rotation.x = Math.PI / 2; rr.position.set(SPOT.x, y0 + 0.065, SPOT.z); g.add(rr);
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2.2 + Math.sin(t * 2.5) * 0.6; });
      var tops = [45, 135, 225, 315].map(function (deg) {
        var a2 = deg * Math.PI / 180, x = SPOT.x + Math.cos(a2) * (SPOT.r + 0.16), zz = SPOT.z + Math.sin(a2) * (SPOT.r + 0.16);
        var st = crag(0.07, 0.32, 200 + deg); st.position.set(x, Y(x, zz), zz); g.add(st);
        return new V(x, Y(x, zz) + 0.26, zz);
      });
      var arcs = [0, 1, 2, 3].map(function () { var b2 = bolt(5, 0.005); g.add(b2); return b2; });
      var AR = K3.rng(13), lastA = -1;
      ctx.anim(function (t) {
        var k = Math.floor(t * 10); if (k === lastA) return; lastA = k;
        arcs.forEach(function (b2, i) { b2.visible = ((k + i * 4) % 11) < 2; if (b2.visible) b2.zap(tops[i], tops[(i + 1) % 4], 0.1, AR); });
      });
    }

    /* ===== Level 5: tempest ===== */
    if (level >= 5) {
      var ring = new THREE.Group(); ring.position.set(0, TOP + 2.2, 0); g.add(ring);
      for (var c = 0; c < 6; c++) { var ca = c / 6 * Math.PI * 2, puff = cloudPuffs(R, 3, 0.5, 0.2); puff.position.set(Math.cos(ca) * 1.1, Math.sin(c * 2) * 0.08, Math.sin(ca) * 1.1); ring.add(puff); }
      ctx.anim(function (t) { ring.rotation.y = t * 0.15; });
      var strike2 = bolt(9, 0.012); g.add(strike2);
      var KR2 = K3.rng(37), lastK2 = -1, target = new V();
      ctx.anim(function (t) {
        var cyc = (t + 1.4) % 2.2, on = cyc < 0.18; strike2.visible = on;
        var k = Math.floor(t * 16); if (!on || k === lastK2) return; lastK2 = k;
        var a = Math.floor(t / 2.2) * 2.1 + ring.rotation.y;
        target.set(Math.cos(a) * 0.9, Y(Math.cos(a) * 0.9, Math.sin(a) * 0.9) + 0.02, Math.sin(a) * 0.9);
        strike2.zap(new V(Math.cos(a) * 1.1, TOP + 2.15, Math.sin(a) * 1.1), target, 0.2, KR2);
      });
      for (var s = 0; s < 4; s++) g.add(streak(ctx, 0.8 + s * 0.18, 1.3, TOP + 0.4 + s * 0.35, 0.8 + s * 0.15, s * 1.5));
    }
    return g;
  }

  HABITATS.register({ id: 'storm', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.06, z: SPOT.z, r: SPOT.r }, build: build });
})();
