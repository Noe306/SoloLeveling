/* ==========================================================================
   habitats/poison.js: Poison Habitat (element 11). Inspiration: dark rock with
   vines and bones (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): toxic rock spire at the BACK-left, rib cage
   of an ancient beast at the back-right (level 3), the dragon rests at the
   FRONT-right (kept free). Palette: dark purple-grey rock, toxic green, bone.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  dark rock island with green-glowing cracks, bubbling toxic puddles,
          thorny vines, scattered bones, purple spotted mushrooms
     2  + jagged rock spire (focal point) with glowing green veins and vines
          spiralling around it, big bubbling pool at its foot
     3  + half-buried rib cage and skull of an ancient beast, pitcher plants,
          toxic fumes rising from the pool
     4  + the dragon's toxic nest: ring of thorny vines, four bone stakes with skulls
     5  + giant poison flower blooming on the spire, dripping into the pool,
          floating glowing spores
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var SPIRE = { x: -0.55, z: -0.55 };
  var POOL = { x: -0.05, z: -0.6, r: 0.3 };         // level-2 pool at the spire's foot
  var RIBS = { x: 0.68, z: -0.62 };                 // level-3 rib cage

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    var dot = dotTexture();
    M = {
      // Dark rock with toxic-green glowing cracks: stone colour/normals + only the crack pattern of
      // the lava texture as glow (its colour map is orange, so it is not used).
      cracked: (function () {
        var st = K3.tex('stone'), lv = K3.tex('lava');
        return new THREE.MeshStandardMaterial({ map: st.map, normalMap: lv.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), color: col('#5a5266'), roughness: 0.85,
          emissiveMap: lv.emissiveMap, emissive: col('#30ff40'), emissiveIntensity: 4.0 });   // the crack map is dim in green, so push it
      })(),
      ground: K3.mat('stone', { repeat: 2, color: '#6a6276' }),
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#b4aac0' }),
      toxic: new THREE.MeshStandardMaterial({ color: col('#1a5a08'), emissive: col('#4aff1a'), emissiveIntensity: 1.3, roughness: 0.2 }),
      bubble: new THREE.MeshStandardMaterial({ color: col('#9aff5a'), emissive: col('#6aff2a'), emissiveIntensity: 0.8, roughness: 0.1, transparent: true, opacity: 0.85 }),
      vine: new THREE.MeshStandardMaterial({ color: col('#3a5a2a'), roughness: 0.8 }),
      thorn: new THREE.MeshStandardMaterial({ color: col('#2a1e24'), roughness: 0.5 }),
      bone: new THREE.MeshStandardMaterial({ color: col('#e8dcc0'), roughness: 0.65 }),
      socket: new THREE.MeshStandardMaterial({ color: col('#1a0f14'), roughness: 0.9 }),
      capPurple: new THREE.MeshStandardMaterial({ color: col('#7a2a9a'), roughness: 0.5 }),
      dotGreen: new THREE.MeshStandardMaterial({ color: col('#9aff5a'), emissive: col('#6aff2a'), emissiveIntensity: 0.6 }),
      stem: new THREE.MeshStandardMaterial({ color: col('#d8d0c0'), roughness: 0.8 }),
      pitcher: new THREE.MeshStandardMaterial({ color: col('#5a8a2a'), roughness: 0.6, side: THREE.DoubleSide }),
      pitcherLip: new THREE.MeshStandardMaterial({ color: col('#8a2a6a'), roughness: 0.5 }),
      petal: new THREE.MeshStandardMaterial({ color: col('#8a2ab0'), emissive: col('#5a1a7a'), emissiveIntensity: 0.3, roughness: 0.5, side: THREE.DoubleSide, flatShading: true }),
      glowGreen: K3.mat('glow', { color: '#8aff4a', intensity: 2.0 }),
      fume: new THREE.SpriteMaterial({ map: dot, color: col('#8aff5a'), transparent: true, opacity: 0.3, depthWrite: false }),
      spore: new THREE.PointsMaterial({ map: dot, color: col('#b6ff6a'), size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* ------------------------- building blocks ------------------------- */
  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }
  function Y(x, z) { return domeY(Math.hypot(x, z)); }
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  function island() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 121, squash: 0.42, lumpy: 0.24, material: M.cracked });
    under.scale.set(1, 0.85, 1); under.position.y = 0.0; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 17, squash: 0.08, lumpy: 0.06, flat: false, material: M.ground });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Toxic puddle (noisy disc) with bubbles that grow, rise a little and pop.
  function puddle(ctx, R, x, z, r, nb) {
    var g = new THREE.Group(); g.position.set(x, Y(x, z) + 0.012, z);
    var s = new THREE.Shape(), n = 22, seed = R() * 10;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2, rr = r * (1 + 0.2 * K3.fbm3(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, seed, 2));
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    var m = new THREE.Mesh(new THREE.ShapeGeometry(s, 4), M.toxic); m.rotation.x = -Math.PI / 2; g.add(m);
    for (var b = 0; b < nb; b++) {
      var bub = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M.bubble); g.add(bub);
      (function (bm, bx, bz, ph, sz) {
        ctx.anim(function (t) { var k = (t * 0.5 + ph) % 1; bm.position.set(bx, k * 0.03, bz); bm.scale.setScalar(k < 0.9 ? sz * (0.3 + k) : 0.0001); });
      })(bub, (R() - 0.5) * r, (R() - 0.5) * r, R(), 0.015 + R() * 0.02);
    }
    return g;
  }

  // Thorny vine: tube along points with small dark thorns along it.
  function thornVine(pts, r) {
    var g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new V(p[0], p[1], p[2]); }));
    g.add(K3.tube(pts, [r, r * 0.6], M.vine, 24));
    var n = Math.round(curve.getLength() / 0.07);
    for (var i = 1; i < n; i++) {
      var p = curve.getPointAt(i / n), th = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, r * 3, 4), M.thorn), a = i * 2.3;
      th.position.copy(p).add(new V(Math.cos(a) * r, Math.sin(a) * r * 0.5 + r * 0.5, Math.sin(a) * r)); th.rotation.set(Math.cos(a), 0, Math.sin(a) * 1.2); g.add(th);
    }
    return g;
  }

  function bone(len, r) {
    var g = new THREE.Group();
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), M.bone); shaft.rotation.z = Math.PI / 2; shaft.castShadow = true; g.add(shaft);
    [-1, 1].forEach(function (s) { [-1, 1].forEach(function (k) { var knob = new THREE.Mesh(new THREE.SphereGeometry(r * 1.4, 8, 6), M.bone); knob.position.set(s * len / 2, 0, k * r * 0.9); g.add(knob); }); });
    return g;
  }

  // Stylised skull: cranium, snout, dark eye sockets, jaw. s = size.
  function skull(s) {
    var g = new THREE.Group();
    var cr = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 14, 10), M.bone); cr.scale.set(1, 0.9, 1.1); cr.castShadow = true; g.add(cr);
    var sn = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 12, 8), M.bone); sn.scale.set(0.9, 0.7, 1.3); sn.position.set(0, -0.03 * s, 0.09 * s); g.add(sn);
    [-1, 1].forEach(function (k) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 8, 6), M.socket); e.position.set(k * 0.045 * s, 0.015 * s, 0.085 * s); g.add(e); });
    var jaw = K3.roundedBox(0.1 * s, 0.025 * s, 0.13 * s, 0.01 * s, M.bone); jaw.position.set(0, -0.08 * s, 0.06 * s); jaw.rotation.x = 0.25; g.add(jaw);
    return g;
  }

  function mushroom(h, r) {
    var g = new THREE.Group();
    var st = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.36, h, 8), M.stem); st.position.y = h / 2; g.add(st);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.capPurple); cap.scale.y = 0.7; cap.position.y = h; cap.castShadow = true; g.add(cap);
    for (var i = 0; i < 5; i++) { var a = i * 2.5, el = 0.4 + (i % 2) * 0.35, d = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 6, 4), M.dotGreen); d.scale.y = 0.4; d.position.set(Math.cos(a) * Math.cos(el) * r, h + Math.sin(el) * r * 0.7, Math.sin(a) * Math.cos(el) * r); g.add(d); }
    return g;
  }

  // Pitcher plant: a curved cup (lathe) with a purple lip and a little lid.
  function pitcher(h) {
    var g = new THREE.Group();
    var prof = [[0.005, 0], [0.04, 0.02], [0.055, h * 0.4], [0.045, h * 0.8], [0.05, h]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), M.pitcher); cup.castShadow = true; g.add(cup);
    var lip = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16), M.pitcherLip); lip.rotation.x = Math.PI / 2; lip.position.y = h; g.add(lip);
    var lid = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), M.pitcherLip); lid.position.set(0, h + 0.05, -0.03); lid.rotation.x = -0.6; lid.material.side = THREE.DoubleSide; g.add(lid);
    var goo = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), M.toxic); goo.rotation.x = -Math.PI / 2; goo.position.y = h * 0.8; g.add(goo);
    return g;
  }

  function fumes(ctx, x, y, z, spread, n, phase) {
    var g = new THREE.Group(); g.position.set(x, y, z);
    var list = [];
    for (var i = 0; i < n; i++) { var s = new THREE.Sprite(M.fume.clone()); g.add(s); list.push(s); }
    ctx.anim(function (t) {
      list.forEach(function (s, i) {
        var k = (t * 0.25 + i / n + phase) % 1, a = i * 2.4;
        s.position.set(Math.cos(a) * spread * (0.3 + k), k * 0.8, Math.sin(a) * spread * (0.3 + k)); s.scale.setScalar(0.12 + k * 0.35); s.material.opacity = 0.32 * (1 - k) * Math.min(1, k * 5);
      });
    });
    return g;
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(43), g = new THREE.Group();
    g.add(island());

    /* ===== Level 1 ===== */
    [[0.95, -0.15, 0.14, 4], [-0.2, 1.0, 0.16, 5], [-1.0, 0.25, 0.12, 3]].forEach(function (p) { g.add(puddle(ctx, R, p[0], p[1], p[2], p[3])); });
    g.add(thornVine([[-1.15, Y(-1.15, 0.6), 0.6], [-0.8, Y(-0.8, 0.85) + 0.05, 0.85], [-0.45, Y(-0.45, 1.05), 1.05], [-0.2, Y(-0.2, 1.18) + 0.04, 1.18]], 0.022));
    g.add(thornVine([[1.18, Y(1.18, 0.35), 0.35], [1.05, Y(1.05, 0.7) + 0.05, 0.7], [0.75, Y(0.75, 0.98), 0.98]], 0.02));
    [[0.7, 0.98, 0.18, 0.4], [1.1, 0.55, 0.14, 1.6], [-0.65, 0.75, 0.16, 2.6], [0.25, -1.1, 0.15, 0.9]].forEach(function (b) {
      var bn = bone(b[2], 0.012); bn.position.set(b[0], Y(b[0], b[1]) + 0.015, b[1]); bn.rotation.y = b[3]; g.add(bn);
    });
    [[1.0, -0.6, 0.12, 0.08], [1.08, -0.48, 0.08, 0.055], [-1.1, -0.15, 0.1, 0.07]].forEach(function (m) {
      var mu = mushroom(m[2], m[3]); mu.position.set(m[0], Y(m[0], m[1]) - 0.01, m[1]); g.add(mu);
    });
    [[-0.95, 0.65, 0.15, 1], [0.6, -1.08, 0.17, 2]].forEach(function (p) {
      var rk = K3.rock({ radius: p[2], detail: 3, seed: 90 + p[3], squash: 0.75, color: '#5a5060', top: '#4a5a3a', topAmount: 0.35, material: M.rock });
      rk.position.set(p[0], Y(p[0], p[1]), p[1]); g.add(rk);
    });
    var toxL = new THREE.PointLight(col('#7dff3a'), 0.5, 2.5, 2); toxL.position.set(0.3, TOP + 0.4, 0.2); g.add(toxL);

    /* ===== Level 2: toxic spire + big pool ===== */
    var spireTop = null;
    if (level >= 2) {
      // Jagged spire: a tall rock pulled into a point at the top, with leaning shards around it
      var spire = K3.rock({ radius: 0.34, detail: 4, seed: 131, squash: 2.6, lumpy: 0.42, material: M.cracked });
      var sp = spire.geometry.attributes.position;
      for (var v = 0; v < sp.count; v++) { var yy = sp.getY(v), k = yy > 0 ? 1 - (yy / 0.9) * 0.75 : 1; sp.setX(v, sp.getX(v) * k); sp.setZ(v, sp.getZ(v) * k); }
      spire.geometry.computeVertexNormals();
      spire.position.set(SPIRE.x, TOP + 0.55, SPIRE.z); g.add(spire);
      [[0.27, 0.12, -0.35, 132, 0.17], [-0.22, 0.2, 0.4, 133, 0.14], [0.05, -0.28, 0.3, 134, 0.13]].forEach(function (s) {
        var shard = K3.rock({ radius: s[4], detail: 3, seed: s[3], squash: 3.0, lumpy: 0.35, material: M.cracked });
        var shp = shard.geometry.attributes.position;
        for (var w = 0; w < shp.count; w++) { var y2 = shp.getY(w), k2 = y2 > 0 ? Math.max(0.1, 1 - y2 / (s[4] * 3)) : 1; shp.setX(w, shp.getX(w) * k2); shp.setZ(w, shp.getZ(w) * k2); }
        shard.geometry.computeVertexNormals();
        shard.position.set(SPIRE.x + s[0], TOP + 0.2, SPIRE.z + s[1]); shard.rotation.set(s[1] * 0.8, 0, -s[2]); g.add(shard);
      });
      spireTop = new V(SPIRE.x, TOP + 1.45, SPIRE.z);
      // Vines spiralling up the spire
      [0, Math.PI].forEach(function (ph) {
        var pts = [];
        for (var i = 0; i <= 10; i++) { var t = i / 10, a = ph + t * Math.PI * 3, r = 0.36 * (1 - t * 0.6) + 0.03; pts.push([SPIRE.x + Math.cos(a) * r, TOP + 0.05 + t * 1.25, SPIRE.z + Math.sin(a) * r]); }
        g.add(thornVine(pts, 0.018));
      });
      g.add(puddle(ctx, R, POOL.x, POOL.z, POOL.r, 8));
      var poolL = new THREE.PointLight(col('#7dff3a'), 1.0, 2.2, 2); poolL.position.set(POOL.x, TOP + 0.35, POOL.z); g.add(poolL);
      ctx.anim(function (t) { M.toxic.emissiveIntensity = 1.3 + Math.sin(t * 1.7) * 0.25; });
    }

    /* ===== Level 3: rib cage + skull, pitcher plants, fumes ===== */
    if (level >= 3) {
      var cage = new THREE.Group(); cage.position.set(RIBS.x, Y(RIBS.x, RIBS.z) - 0.04, RIBS.z); cage.rotation.y = -Math.PI / 4 + 0.2; g.add(cage);
      cage.add(K3.tube([[-0.45, 0.04, 0], [-0.15, 0.08, 0], [0.15, 0.07, 0], [0.42, 0.03, 0]], [0.035, 0.025], M.bone, 16));   // spine half-buried
      for (var rb = 0; rb < 6; rb++) {
        var x = -0.35 + rb * 0.14, hgt = 0.42 - Math.abs(rb - 2.5) * 0.06;
        [-1, 1].forEach(function (s) {
          cage.add(K3.tube([[x, 0.08, 0], [x + 0.02, hgt * 0.7, s * 0.18], [x + 0.03, hgt, s * 0.08], [x + 0.04, hgt * 0.85, s * 0.0]], [0.02, 0.008], M.bone, 12));
        });
      }
      var sk = skull(1.6); sk.position.set(0.55, 0.1, 0.05); sk.rotation.set(-0.15, Math.PI / 2 - 0.3, 0.2); cage.add(sk);
      [[1.12, 0.05, 0.22], [-0.9, -0.85, 0.26], [0.9, 0.82, 0.18]].forEach(function (p) {
        var pc = pitcher(p[2]); pc.position.set(p[0], Y(p[0], p[1]) - 0.01, p[1]); pc.rotation.y = R() * 6; g.add(pc);
      });
      g.add(fumes(ctx, POOL.x, Y(POOL.x, POOL.z) + 0.02, POOL.z, 0.18, 6, 0));
    }

    /* ===== Level 4: the toxic nest ===== */
    if (level >= 4) {
      var ring = [];
      for (var k = 0; k <= 24; k++) { var a = k / 24 * Math.PI * 2, rr = SPOT.r + 0.05 + Math.sin(k * 1.7) * 0.025; ring.push([SPOT.x + Math.cos(a) * rr, Y(SPOT.x, SPOT.z) + 0.03 + Math.abs(Math.sin(k * 2.1)) * 0.04, SPOT.z + Math.sin(a) * rr]); }
      g.add(thornVine(ring, 0.024));
      [45, 135, 225, 315].forEach(function (deg) {
        var a = deg * Math.PI / 180, x = SPOT.x + Math.cos(a) * (SPOT.r + 0.18), z = SPOT.z + Math.sin(a) * (SPOT.r + 0.18), y = Y(x, z);
        var stake = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.36, 6), M.bone); stake.position.set(x, y + 0.18, z); stake.castShadow = true; g.add(stake);
        var sk2 = skull(0.75); sk2.position.set(x, y + 0.4, z); sk2.rotation.y = Math.atan2(SPOT.x - x, SPOT.z - z) + Math.PI; g.add(sk2);
        [-1, 1].forEach(function (s) {                                       // glowing eyes in the skull sockets
          var ge = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), M.glowGreen); ge.position.set(s * 0.034, 0.012, 0.07); sk2.add(ge);
        });
      });
    }

    /* ===== Level 5: poison flower + drips + spores ===== */
    if (level >= 5 && spireTop) {
      var fl = new THREE.Group(); fl.position.copy(spireTop); g.add(fl);
      for (var p = 0; p < 7; p++) {
        var pa = p / 7 * Math.PI * 2, pet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.petal);
        pet.scale.set(0.55, 0.12, 1); pet.position.set(Math.cos(pa) * 0.13, 0.04, Math.sin(pa) * 0.13); pet.rotation.y = -pa + Math.PI / 2; pet.rotation.x = -0.45; fl.add(pet);
      }
      var heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), M.glowGreen); heart.position.y = 0.06; fl.add(heart);
      ctx.anim(function (t) { fl.rotation.y = t * 0.2; fl.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04); });
      var fLight = new THREE.PointLight(col('#8aff4a'), 1.3, 2.5, 2); fLight.position.copy(spireTop).add(new V(0, 0.2, 0)); g.add(fLight);
      // Drips falling from the flower into the pool
      var drips = [];
      for (var d = 0; d < 4; d++) { var dr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.toxic); dr.scale.y = 1.6; g.add(dr); drips.push(dr); }
      var from = spireTop.clone().add(new V(0.16, -0.02, 0.1)), to = new V(POOL.x, Y(POOL.x, POOL.z) + 0.02, POOL.z);
      ctx.anim(function (t) {
        drips.forEach(function (dr, i) {
          var k = (t * 0.45 + i / drips.length) % 1, e = k * k;
          dr.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * k);
        });
      });
      // Floating spores
      var n = 40, pos = new Float32Array(n * 3), seed = [];
      for (var s = 0; s < n; s++) { pos[s * 3] = (R() - 0.5) * 2.4; pos[s * 3 + 1] = TOP + R() * 1.6; pos[s * 3 + 2] = (R() - 0.5) * 2.4; seed.push(R() * 6.28); }
      var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      ctx.anim(function (t, dt) {
        for (var q = 0; q < n; q++) {
          pos[q * 3 + 1] += dt * 0.08; pos[q * 3] += Math.sin(t * 0.7 + seed[q]) * dt * 0.05;
          if (pos[q * 3 + 1] > TOP + 1.8) pos[q * 3 + 1] = TOP + 0.05;
        }
        sg.attributes.position.needsUpdate = true;
      });
      g.add(new THREE.Points(sg, M.spore));
    }
    return g;
  }

  HABITATS.register({ id: 'poison', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.02, z: SPOT.z, r: SPOT.r }, build: build });
})();
