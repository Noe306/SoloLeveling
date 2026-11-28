/* ==========================================================================
   habitats/dark.js: Dark Habitat (element 10). Inspiration: dead twisted tree in
   a misty swamp (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): dead tree at the BACK-left, ruined arch at
   the back-right (level 3), the dragon rests at the FRONT-right (kept free).
   Palette: slate-violet ground, black water, violet glow.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  swamp island: dark mossy mud, murky black pools, dead reeds, a dead stump,
          drifting mist, one will-o'-wisp
     2  + giant twisted dead tree (focal point) with crooked branches and hanging
          grey moss, purple shadow crystals
     3  + half-ruined gothic stone arch with a violet rune lantern, fallen blocks
     4  + shadow nest: dark eclipse disc with a glowing violet rim, ring of
          obsidian shards
     5  + eclipse crown: black orb with a violet corona above the tree,
          will-o'-wisps circling, thicker mist
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var TREE = { x: -0.55, z: -0.5 };
  var ARCH = { x: 0.56, z: -0.8 };                  // level-3 arch centre (spans across the view)

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    var dot = dotTexture();
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#b0aac0' }),
      mud: K3.mat('stone', { repeat: 2, color: '#6e6680' }),                 // dark slate-violet ground
      // (not too glossy: a mirror-like pool flashes white in the village view, see guide 7b)
      water: new THREE.MeshStandardMaterial({ color: col('#121426'), roughness: 0.35, metalness: 0, envMapIntensity: 0.35, emissive: col('#2a1450'), emissiveIntensity: 0.3 }),
      bark: K3.mat('bark', { repeat: 2, color: '#7a6e84' }),
      reed: new THREE.MeshStandardMaterial({ color: col('#6a6250'), roughness: 0.9, flatShading: true }),
      moss: new THREE.MeshStandardMaterial({ color: col('#8a907a'), roughness: 0.9 }),
      stone: K3.mat('stone', { flat: true, repeat: 1, color: '#9a96a6' }),
      obsidian: new THREE.MeshPhysicalMaterial({ color: col('#140f1e'), roughness: 0.15, clearcoat: 1, flatShading: true, envMapIntensity: 0.9 }),
      violet: K3.mat('glow', { color: '#b46bff', intensity: 2.2 }),
      orb: new THREE.MeshStandardMaterial({ color: col('#05030a'), roughness: 0.3 }),
      mist: new THREE.SpriteMaterial({ map: dot, color: col('#b8b0d0'), transparent: true, opacity: 0.22, depthWrite: false }),
      halo: new THREE.SpriteMaterial({ map: dot, color: col('#b46bff'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
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
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 111, squash: 0.42, lumpy: 0.24, color: '#5a5468', top: '#4a5040', topAmount: 0.25, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 16, squash: 0.08, lumpy: 0.06, flat: false, material: M.mud });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Irregular flat pool (noisy circle) lying on the dome.
  function pool(x, z, r, seed) {
    var s = new THREE.Shape(), n = 22;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2, rr = r * (1 + 0.22 * K3.fbm3(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, seed, 2));
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    var m = new THREE.Mesh(new THREE.ShapeGeometry(s, 4), M.water); m.rotation.x = -Math.PI / 2; m.position.set(x, Y(x, z) + 0.012, z); m.receiveShadow = true;
    return m;
  }

  function reeds(R, n) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var h = 0.2 + R() * 0.25, a = R() * Math.PI * 2, d = R() * 0.08;
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.01, h, 4), M.reed);
      st.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); st.rotation.set((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5);
      if (i % 3 === 0) { st.rotation.z += 0.9; st.position.y *= 0.6; }      // some broken and bent over
      g.add(st);
    }
    return g;
  }

  // Twisted dead tree. s = size. Trunk spirals; crooked branches split once; moss strands hang.
  function deadTree(ctx, R, s) {
    var g = new THREE.Group(), pts = [];
    for (var i = 0; i <= 6; i++) { var t = i / 6, a = t * 2.4; pts.push([Math.cos(a) * 0.09 * s * (1 - t * 0.4), t * 1.5 * s, Math.sin(a) * 0.09 * s * (1 - t * 0.4)]); }
    g.add(K3.tube(pts, [0.2 * s, 0.07 * s], M.bark, 30));
    for (var r = 0; r < 5; r++) {                                           // gnarled roots
      var ra = r / 5 * Math.PI * 2 + 0.4;
      g.add(K3.tube([[Math.cos(ra) * 0.1 * s, 0.25 * s, Math.sin(ra) * 0.1 * s], [Math.cos(ra) * 0.3 * s, 0.05, Math.sin(ra) * 0.3 * s], [Math.cos(ra) * 0.45 * s, -0.03, Math.sin(ra) * 0.45 * s]], [0.07 * s, 0.02 * s], M.bark, 10));
    }
    var tips = [];
    function branch(from, dir, len, rad, depth) {
      var mid = from.clone().addScaledVector(dir, len * 0.5).add(new V((R() - 0.5) * len * 0.4, (R() - 0.2) * len * 0.3, (R() - 0.5) * len * 0.4));
      var end = from.clone().addScaledVector(dir, len).add(new V((R() - 0.5) * len * 0.3, -len * 0.1, (R() - 0.5) * len * 0.3));
      g.add(K3.tube([[from.x, from.y, from.z], [mid.x, mid.y, mid.z], [end.x, end.y, end.z]], [rad, rad * 0.35], M.bark, 10));
      if (depth > 0) for (var k = 0; k < 2; k++) {
        var nd = dir.clone().add(new V((R() - 0.5) * 1.2, 0.2 + R() * 0.4, (R() - 0.5) * 1.2)).normalize();
        branch(end, nd, len * 0.6, rad * 0.4, depth - 1);
      } else tips.push(end);
    }
    [[0.5, 0.95], [-0.6, 1.1], [0.2, 1.3], [-0.1, 1.45]].forEach(function (b, i) {
      var a = i * 1.7 + 0.5, from = new V(0, b[1] * s, 0);
      branch(from, new V(Math.cos(a), 0.45 + b[0] * 0.2, Math.sin(a)).normalize(), 0.55 * s, 0.06 * s, s > 0.8 ? 1 : 0);
    });
    // Hanging moss strands from the branch tips (swaying)
    tips.forEach(function (tp, i) {
      if (i % 2) return;
      var hg = new THREE.Group(); hg.position.copy(tp); g.add(hg);
      var len = 0.25 + R() * 0.35;
      hg.add(K3.tube([[0, 0, 0], [0.02, -len * 0.5, 0], [0, -len, 0.01]], [0.018, 0.004], M.moss, 8));
      ctx.anim(function (t) { hg.rotation.z = Math.sin(t * 0.7 + i) * 0.08; });
    });
    g.userData.tips = tips;
    return g;
  }

  function shadowCrystal(h, r, seed) {
    var c = K3.crystalCluster({ count: 3, height: h, radius: r, seed: seed, spread: r * 1.3, color: '#3a1f5a', emissive: '#8a3fff', intensity: 0.5 });
    c.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.4; o.material.opacity = 0.92; } });
    return c;
  }

  // Glowing wisp (sprite halo + small core + light) that wanders around a path.
  function wisp(ctx, path, color) {
    var g = new THREE.Group();
    var h = new THREE.Sprite(M.halo.clone()); h.material.color = col(color); h.scale.setScalar(0.22); g.add(h);
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ffffff') })); g.add(core);
    var l = new THREE.PointLight(col(color), 0.7, 1.2, 2); g.add(l);
    ctx.anim(function (t) { var p = path(t); g.position.copy(p); h.material.opacity = 0.6 + Math.sin(t * 5) * 0.2; });
    return g;
  }

  function mist(ctx, R, n, spread, y, size) {
    var g = new THREE.Group(), list = [];
    for (var i = 0; i < n; i++) {
      var s = new THREE.Sprite(M.mist); s.scale.setScalar(size * (0.7 + R() * 0.6)); g.add(s);
      list.push({ s: s, x: (R() - 0.5) * spread, z: (R() - 0.5) * spread, ph: R() * 6.28 });
    }
    ctx.anim(function (t) { list.forEach(function (m) { m.s.position.set(m.x + Math.sin(t * 0.15 + m.ph) * 0.3, y + Math.sin(t * 0.4 + m.ph) * 0.03, m.z + Math.cos(t * 0.12 + m.ph) * 0.3); }); });
    return g;
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(41), g = new THREE.Group();
    g.add(island());

    /* ===== Level 1 ===== */
    [[-0.1, 0.95, 0.28, 1], [0.95, -0.2, 0.22, 2], [-0.95, 0.15, 0.2, 3], [0.1, -0.35, 0.18, 4]].forEach(function (p) { g.add(pool(p[0], p[1], p[2], p[3])); });
    [[0.15, 1.12, 9], [1.12, -0.1, 7], [-1.1, 0.3, 8], [0.75, 0.92, 6]].forEach(function (p) { var rd = reeds(R, p[2]); rd.position.set(p[0], Y(p[0], p[1]), p[1]); g.add(rd); });
    if (level < 2) {                                                         // dead stump where the tree will grow
      var stump = deadTree(ctx, R, 0.35); stump.position.set(TREE.x, Y(TREE.x, TREE.z) - 0.02, TREE.z); g.add(stump);
    }
    [[1.08, 0.55, 0.16, 1], [-0.3, -1.08, 0.18, 2], [-1.05, -0.45, 0.14, 3]].forEach(function (p) {
      var rk = K3.rock({ radius: p[2], detail: 3, seed: 80 + p[3], squash: 0.7, color: '#6a6478', top: '#5a6448', topAmount: 0.45, material: M.rock });
      rk.position.set(p[0], Y(p[0], p[1]), p[1]); g.add(rk);
    });
    g.add(mist(ctx, R, level >= 5 ? 16 : 9, 2.4, TOP + 0.08, 0.7));
    g.add(wisp(ctx, function (t) { return new V(0.6 + Math.sin(t * 0.5) * 0.4, TOP + 0.35 + Math.sin(t * 1.3) * 0.08, -0.2 + Math.cos(t * 0.4) * 0.4); }, '#9fd8ff'));

    /* ===== Level 2: the twisted dead tree ===== */
    var tree = null;
    if (level >= 2) {
      tree = deadTree(ctx, R, 1.15); tree.position.set(TREE.x, Y(TREE.x, TREE.z) - 0.02, TREE.z); g.add(tree);
      [[-0.95, -0.85, 0.42, 5], [0.55, -1.05, 0.32, 6], [-1.12, 0.62, 0.3, 7], [1.1, 0.25, 0.26, 8]].forEach(function (c) {
        var sc = shadowCrystal(c[2], 0.06, 40 + c[3]); sc.position.set(c[0], Y(c[0], c[1]) - 0.02, c[1]); g.add(sc);
      });
      var gloom = new THREE.PointLight(col('#8a4fff'), 1.0, 3, 2); gloom.position.set(TREE.x, TOP + 1.0, TREE.z); g.add(gloom);
    }

    /* ===== Level 3: half-ruined gothic arch ===== */
    if (level >= 3) {
      var along = new V(1, 0, -1).normalize(), half = 0.32, H = 0.95;
      var arch = new THREE.Group(); arch.position.set(ARCH.x, Y(ARCH.x, ARCH.z), ARCH.z); arch.rotation.y = Math.PI / 4; g.add(arch);   // local x = along the span
      [-1, 1].forEach(function (sd) {                                        // pillars (the right one is broken off)
        var ph = sd < 0 ? 0.62 : 0.4;
        for (var b = 0; b < (sd < 0 ? 5 : 3); b++) {
          var blk = K3.roundedBox(0.16, 0.12, 0.16, 0.02, M.stone); blk.position.set(sd * half, 0.06 + b * 0.125, 0); blk.rotation.y = (R() - 0.5) * 0.15; arch.add(blk);
        }
      });
      for (var k = 0; k < 7; k++) {                                          // pointed arch blocks from the left pillar (stops before the right side)
        var u = k / 8, ax = -half + u * 2 * half, ay = 0.62 + Math.sin(u * Math.PI) * 0.36 + (u < 0.5 ? u : 1 - u) * 0.12;
        var ab = K3.roundedBox(0.15, 0.11, 0.15, 0.02, M.stone); ab.position.set(ax, ay, 0); ab.rotation.z = (0.5 - u) * 1.6; arch.add(ab);
        if (k === 3) {                                                       // rune lantern hanging from the keystone
          var lan = new THREE.Group(); lan.position.set(ax, ay - 0.05, 0); arch.add(lan);
          lan.add(K3.tube([[0, 0, 0], [0, -0.16, 0]], 0.004, M.reed, 3));
          var lc = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), M.violet); lc.position.y = -0.2; lan.add(lc);
          var ll = new THREE.PointLight(col('#b46bff'), 0.9, 1.6, 2); ll.position.y = -0.2; lan.add(ll);
          ctx.anim(function (t) { lan.rotation.z = Math.sin(t * 1.1) * 0.12; lc.rotation.y = t; });
        }
      }
      [[0.3, 0.2, 0.3], [0.1, 0.4, 1.1]].forEach(function (f) {             // fallen blocks on the ground (local x, z, spin), kept on the island
        var fb = K3.roundedBox(0.15, 0.11, 0.15, 0.02, M.stone); fb.position.set(f[0], 0.05, f[1]); fb.rotation.set(0.3, f[2], 0.2); arch.add(fb);
      });
      for (var rn = 0; rn < 3; rn++) {                                       // violet runes on the left pillar
        var rune = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, rn % 2 ? 3 : 5), M.violet); rune.position.set(-half, 0.12 + rn * 0.15, 0.085); arch.add(rune);
      }
    }

    /* ===== Level 4: shadow nest ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.05, 48), M.obsidian); disc.position.set(SPOT.x, y0 + 0.01, SPOT.z); disc.receiveShadow = true; g.add(disc);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.02, 0.016, 8, 64), M.violet); rim.rotation.x = Math.PI / 2; rim.position.set(SPOT.x, y0 + 0.035, SPOT.z); g.add(rim);
      var inner = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r * 0.6, 0.008, 6, 48), M.violet); inner.rotation.x = Math.PI / 2; inner.position.set(SPOT.x, y0 + 0.037, SPOT.z); g.add(inner);
      for (var sh = 0; sh < 9; sh++) {                                        // obsidian shards leaning outwards
        var sa = sh / 9 * Math.PI * 2, sx = SPOT.x + Math.cos(sa) * (SPOT.r + 0.14), sz = SPOT.z + Math.sin(sa) * (SPOT.r + 0.14), hh = 0.18 + (sh % 3) * 0.08;
        var shard = new THREE.Mesh(new THREE.ConeGeometry(0.045, hh, 4), M.obsidian); shard.position.set(sx, Y(sx, sz) + hh / 2 - 0.02, sz);
        shard.rotation.set(Math.sin(sa) * 0.25, sa, -Math.cos(sa) * 0.25); shard.castShadow = true; g.add(shard);
      }
      ctx.anim(function (t) { M.violet.emissiveIntensity = 2.2 + Math.sin(t * 1.6) * 0.6; });
    }

    /* ===== Level 5: eclipse crown ===== */
    if (level >= 5) {
      var ec = new THREE.Group(); ec.position.set(TREE.x + 0.1, TOP + 2.35, TREE.z); g.add(ec);
      ec.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), M.orb));
      var corona = new THREE.Sprite(M.halo.clone()); corona.scale.setScalar(0.85); ec.add(corona);
      var cring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 64), M.violet); cring.lookAt(new V(1, 0.4, 1)); ec.add(cring);
      ctx.anim(function (t) { corona.material.opacity = 0.65 + Math.sin(t * 0.8) * 0.15; ec.position.y = TOP + 2.35 + Math.sin(t * 0.5) * 0.04; });
      var el = new THREE.PointLight(col('#b46bff'), 1.4, 3.5, 2); ec.add(el);
      [0, 2.1, 4.2].forEach(function (ph, i) {
        g.add(wisp(ctx, function (t) { var a = t * 0.6 + ph; return new V(TREE.x + Math.cos(a) * 0.8, TOP + 1.1 + Math.sin(t * 1.4 + i) * 0.2, TREE.z + Math.sin(a) * 0.8); }, i === 1 ? '#9fd8ff' : '#c48bff'));
      });
    }
    return g;
  }

  HABITATS.register({ id: 'dark', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.04, z: SPOT.z, r: SPOT.r }, build: build });
})();
