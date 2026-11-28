/* ==========================================================================
   habitats/forest.js: Forest Habitat (element 4). Inspiration: big jungle tree
   (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): the jungle tree stands at the BACK-left,
   the dragon rests in a mossy clearing at the FRONT-right (kept free).

   Levels designed: 1-5 (each level = previous level + new layer)
     1  mossy floating island with hanging roots, dense grass, a young tree,
          ferns, bushes, red mushrooms, mossy rocks, wild flowers
     2  + the tree becomes a giant jungle tree (focal point): buttress roots,
          moss, layered canopy, swaying vines; big jungle leaves, stepping stones
     3  + fallen hollow log covered in moss and glowing mushrooms, a cluster of
          giant glowing mushrooms, soft green glow
     4  + the dragon's nest: a woven twig nest in the clearing, a ring of glowing
          flowers and three mossy rune stones
     5  + canopy in bloom: pink blossoms, glowing seed pods hanging from the
          branches, falling leaves, fireflies
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;
  var TOP = 0.55;                                   // ground height
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (front-right, kept free)
  var TREE = { x: -0.55, z: -0.5 };                 // jungle tree (back-left)

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      soil: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#c9b49a' }),
      moss: K3.mat('grass', { repeat: 2, color: '#b8d89a' }),
      mossRock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#d6dccb' }),
      bark: K3.mat('bark', { repeat: 2, color: '#c9a888' }),
      root: K3.mat('bark', { repeat: 1, color: '#9a7a5c' }),
      leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
      blade: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true }),   // tinted per instance
      frond: new THREE.MeshStandardMaterial({ color: col('#2f7a2c'), roughness: 0.7, side: THREE.DoubleSide }),
      bigLeaf: new THREE.MeshStandardMaterial({ color: col('#2f7a36'), roughness: 0.55, side: THREE.DoubleSide }),
      vine: new THREE.MeshStandardMaterial({ color: col('#4f8a2c'), roughness: 0.8 }),
      vineLeaf: new THREE.MeshStandardMaterial({ color: col('#5fa83a'), roughness: 0.7, flatShading: true }),
      stem: new THREE.MeshStandardMaterial({ color: col('#efe4cc'), roughness: 0.8 }),
      capRed: new THREE.MeshStandardMaterial({ color: col('#c43a26'), roughness: 0.5 }),
      spot: new THREE.MeshStandardMaterial({ color: col('#fff6e6'), roughness: 0.6 }),
      gill: new THREE.MeshStandardMaterial({ color: col('#8a6a52'), roughness: 0.9 }),
      capGlow: new THREE.MeshStandardMaterial({ color: col('#1c8f78'), emissive: col('#22c8a0'), emissiveIntensity: 0.5, roughness: 0.4 }),
      petal: new THREE.MeshStandardMaterial({ color: col('#ffd34a'), roughness: 0.6, flatShading: true }),
      petal2: new THREE.MeshStandardMaterial({ color: col('#b58cff'), roughness: 0.6, flatShading: true }),
      glowFlower: K3.mat('glow', { color: '#9cff7a', intensity: 1.8 }),
      blossom: new THREE.MeshStandardMaterial({ color: col('#ffb3d1'), emissive: col('#ff7ab0'), emissiveIntensity: 0.35, roughness: 0.6, flatShading: true }),
      pod: K3.mat('glow', { color: '#d8ff6a', intensity: 2.0 }),
      twig: K3.mat('wood', { repeat: 1, color: '#8a6a48' }),
      stone: K3.mat('stone', { flat: true, repeat: 1, color: '#cfd3c6' }),
      rune: K3.mat('glow', { color: '#8dff6a', intensity: 2.0 }),
      fallLeaf: new THREE.MeshStandardMaterial({ color: col('#7fbf3a'), roughness: 0.7, side: THREE.DoubleSide }),
      firefly: new THREE.PointsMaterial({ map: dotTexture(), color: col('#e4ff7a'), size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  /* ------------------------- building blocks ------------------------- */
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  // Floating island: earthy underside with roots dangling below + mossy top.
  function mossPlateau(R) {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 71, squash: 0.42, lumpy: 0.24, color: '#8a6e52', top: '#4f7a34', topAmount: 0.25, material: M.soil });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 9, squash: 0.08, lumpy: 0.07, flat: false, material: M.moss });
    topUV(cap, 0.5); cap.position.y = 0.44; g.add(cap);
    // Hanging roots on the front half of the rim
    for (var i = 0; i < 12; i++) {
      var a = -0.5 + i / 11 * 2.4 + (R() - 0.5) * 0.15, r0 = 1.25 + R() * 0.08, len = 0.25 + R() * 0.3;
      var x0 = Math.cos(a) * r0, z0 = Math.sin(a) * r0;
      g.add(K3.tube([[x0, 0.3, z0], [x0 * 1.04, 0.15, z0 * 1.04], [x0 * 1.06, 0.3 - len, z0 * 1.06]], [0.025, 0.006], M.root, 8));
    }
    return g;
  }

  // Fern: fronds made of serrated, drooping leaf strips fanned around the centre.
  function fern(R, size, n) {
    var g = new THREE.Group();
    for (var f = 0; f < (n || 7); f++) {
      var L = size * (0.75 + R() * 0.35), W = size * 0.13, seg = 16, pos = [], idx = [];
      for (var i = 0; i <= seg; i++) {
        var t = i / seg, x = t * L, y = Math.sin(t * Math.PI * 0.55) * L * 0.42 - t * t * L * 0.35;   // rises, then droops
        var w = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.7) * (0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 9)));   // leaflets
        pos.push(x, y, 0, x, y + w * 0.25, w, x, y + w * 0.25, -w);
        if (i < seg) { var a = i * 3, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a, a + 2, b, a + 2, b + 2, b); }
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      var fr = new THREE.Mesh(geo, M.frond); fr.castShadow = true;
      fr.rotation.y = f / (n || 7) * Math.PI * 2 + R() * 0.3; g.add(fr);
    }
    return g;
  }

  // Big jungle leaf (heart shape) on a short curved stem.
  function bigLeaf(size, ry, tilt) {
    var g = new THREE.Group(), s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(size * 0.55, size * 0.15, size * 0.5, size * 0.75, 0, size);
    s.bezierCurveTo(-size * 0.5, size * 0.75, -size * 0.55, size * 0.15, 0, 0);
    var geo = new THREE.ShapeGeometry(s, 10), p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) p.setZ(i, -Math.pow(p.getY(i) / size, 2) * size * 0.35 + Math.abs(p.getX(i)) * 0.3);   // curl down + V fold
    geo.computeVertexNormals();
    var leaf = new THREE.Mesh(geo, M.bigLeaf); leaf.castShadow = true;
    leaf.rotation.x = -Math.PI / 2 + tilt; leaf.position.y = size * 0.35; g.add(leaf);
    g.add(K3.tube([[0, 0, 0], [0, size * 0.25, -size * 0.02], [0, size * 0.36, 0]], [0.012, 0.008], M.vine, 6));
    g.rotation.y = ry;
    return g;
  }

  // Mushroom: stem + domed cap (+ white spots on red caps).
  function mushroom(h, r, capMat, spots) {
    var g = new THREE.Group();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.36, h, 10), M.stem); stem.position.y = h / 2; stem.castShadow = true; g.add(stem);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.scale.y = 0.7; cap.position.y = h; cap.castShadow = true; g.add(cap);
    var gill = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 18), M.gill); gill.rotation.x = Math.PI / 2; gill.position.y = h + 0.002; g.add(gill);
    if (spots) for (var i = 0; i < 6; i++) {
      var a = i * 2.4, el = 0.35 + (i % 3) * 0.3, sp = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 4), M.spot);
      sp.scale.y = 0.4; sp.position.set(Math.cos(a) * Math.cos(el) * r, h + Math.sin(el) * r * 0.7, Math.sin(a) * Math.cos(el) * r); g.add(sp);
    }
    return g;
  }

  function flowerAt(x, y, z, mat, s) {
    var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s || 1);
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), mat);
      p.scale.set(1, 0.35, 0.6); p.position.set(Math.cos(a) * 0.025, 0.06, Math.sin(a) * 0.025); p.rotation.y = -a; g.add(p);
    }
    var c = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), M.spot); c.position.y = 0.065; g.add(c);
    g.add(K3.tube([[0, 0, 0], [0.005, 0.03, 0], [0, 0.06, 0]], 0.004, M.vine, 4));
    return g;
  }

  // Jungle tree. s: 0.45 young (thin, small crown), 1 giant (buttress roots, branches, vines).
  // Returns the group; userData.ends = branch tip positions (local), used for vines/pods.
  function jungleTree(ctx, R, s) {
    var g = new THREE.Group(), big = s > 0.8;
    g.add(K3.tube([[0, -0.05, 0], [0.05 * s, 0.6 * s, 0.02 * s], [-0.03 * s, 1.2 * s, 0], [0.02 * s, 1.55 * s, 0]], [0.25 * s, 0.12 * s], M.bark, 24));
    var ends = [];
    if (big) {
      for (var r = 0; r < 7; r++) {                                       // buttress roots fanning out
        var a = r / 7 * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a), d = 0.45 + R() * 0.15;
        g.add(K3.tube([[ca * 0.12, 0.4, sa * 0.12], [ca * 0.3, 0.12, sa * 0.3], [ca * d, 0.0, sa * d], [ca * (d + 0.12), -0.04, sa * (d + 0.12)]], [0.1, 0.03], M.bark, 12));
      }
      for (var m = 0; m < 6; m++) {                                       // moss patches on trunk + roots
        var ma = m * 1.1, mh = 0.15 + (m % 3) * 0.35;
        var mo = K3.rock({ radius: 0.07 + R() * 0.04, detail: 2, seed: 500 + m, squash: 0.45, color: '#4f8a34', material: M.mossRock });
        mo.position.set(Math.cos(ma) * 0.2, mh, Math.sin(ma) * 0.2); g.add(mo);
      }
    }
    // Branches + leaf clumps at their ends
    var nb = big ? 6 : 3;
    for (var b = 0; b < nb; b++) {
      var ba = b / nb * Math.PI * 2 + 0.5, reach = (big ? 0.75 : 0.4) * (0.85 + R() * 0.3);
      var end = new THREE.Vector3(Math.cos(ba) * reach, (1.65 + R() * 0.25) * s + (big ? 0.1 : 0), Math.sin(ba) * reach);
      g.add(K3.tube([[0, 1.25 * s, 0], [end.x * 0.45, (1.5 + 0.05) * s, end.z * 0.45], [end.x, end.y, end.z]], [0.08 * s, 0.03 * s], M.bark, 12));
      ends.push(end);
    }
    var clumps = ends.concat([new THREE.Vector3(0, 1.95 * s + (big ? 0.15 : 0.05), 0)]);
    clumps.forEach(function (c, i) {
      for (var k = 0; k < (big ? 3 : 2); k++) {
        var lump = K3.rock({ radius: (big ? 0.32 : 0.22) * (0.8 + R() * 0.4) * (i === clumps.length - 1 ? 1.2 : 1), detail: 2, seed: 600 + i * 5 + k,
          squash: 0.6, lumpy: 0.35, color: '#173f17', top: '#3f8a2e', topAmount: 0.55, material: M.leaf });
        lump.position.set(c.x + (R() - 0.5) * 0.25 * s, c.y + (R() - 0.3) * 0.12, c.z + (R() - 0.5) * 0.25 * s); g.add(lump);
      }
    });
    if (big) {
      // Vines hanging from the branches, swaying, with little leaves
      ends.forEach(function (e, i) {
        var vg = new THREE.Group(); vg.position.copy(e).add(new THREE.Vector3(0, -0.15, 0)); g.add(vg);
        var len = 0.6 + R() * 0.55;
        vg.add(K3.tube([[0, 0, 0], [0.02, -len * 0.5, 0.01], [0, -len, 0]], [0.014, 0.008], M.vine, 10));
        for (var l = 1; l < 7; l++) {
          var lf = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.vineLeaf);
          lf.scale.set(1, 0.35, 0.6); lf.position.set((l % 2 ? 0.025 : -0.025), -len * l / 7, 0); lf.rotation.z = l % 2 ? -0.6 : 0.6; vg.add(lf);
        }
        ctx.anim(function (t) { vg.rotation.z = Math.sin(t * 0.9 + i) * 0.06; vg.rotation.x = Math.cos(t * 0.7 + i) * 0.04; });
      });
    }
    g.userData.ends = ends;
    return g;
  }

  // Woven twig nest: many thin twigs laid around a ring.
  function twigNest(R, r) {
    var g = new THREE.Group();
    for (var i = 0; i < 26; i++) {
      var a0 = R() * Math.PI * 2, span = 0.9 + R() * 0.8, rr = r * (0.85 + R() * 0.3), pts = [];
      for (var k = 0; k <= 4; k++) {
        var a = a0 + span * k / 4, h = 0.04 + Math.sin(k / 4 * Math.PI) * 0.05 + R() * 0.03;
        pts.push([Math.cos(a) * rr, h, Math.sin(a) * rr]);
      }
      g.add(K3.tube(pts, 0.012 + R() * 0.008, M.twig, 10));
    }
    return g;
  }

  function points(ctx, R, mat, n, cx, cz, spread, y0, y1, fall) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = cx + (R() - 0.5) * spread; pos[i * 3 + 1] = y0 + R() * (y1 - y0); pos[i * 3 + 2] = cz + (R() - 0.5) * spread; seed.push(R() * 6.28); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        pos[q * 3] += Math.sin(t * 0.8 + seed[q]) * dt * 0.08; pos[q * 3 + 2] += Math.cos(t * 0.6 + seed[q]) * dt * 0.08;
        pos[q * 3 + 1] += Math.sin(t * 1.3 + seed[q]) * dt * 0.06;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, mat);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(19), g = new THREE.Group();
    g.add(mossPlateau(R));

    /* ===== Level 1 ===== */
    // Grass: instanced thin spikes following the domed moss top, in small tufts.
    // (K3.grass blades render as black specks on these small domed caps; solid spikes don't.)
    var blade = new THREE.ConeGeometry(0.011, 0.13, 3); blade.translate(0, 0.065, 0);
    var greens = ['#4f9a36', '#6fb847', '#8fcc52', '#5aa83c'];
    g.add(K3.scatter(blade, M.blade, 1800, function (i, Rr) {
      var a = Rr() * Math.PI * 2, r = Math.sqrt(Rr()) * 1.22, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - TREE.x, z - TREE.z) < (level >= 2 ? 0.55 : 0.2)) return null;
      if (level >= 4 && Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.12) return null;
      var y = 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))) - 0.015, ta = Rr() * 6.28, tl = 0.15 + Rr() * 0.3;
      return { x: x, y: y, z: z, s: 0.6 + Rr() * 0.7, rx: Math.cos(ta) * tl, rz: Math.sin(ta) * tl, ry: Rr() * 3, color: greens[i % 4] };
    }, 41));
    var tree = jungleTree(ctx, R, level >= 2 ? 1 : 0.45); tree.position.set(TREE.x, TOP - 0.04, TREE.z); g.add(tree);
    [[0.92, -0.62, 0.42], [-1.02, 0.48, 0.4], [0.18, 1.05, 0.34]].forEach(function (p, i) { var f = fern(R, p[2], 8); f.position.set(p[0], TOP - 0.03, p[1]); g.add(f); });
    [[1.08, 0.08, 0.17], [-0.25, -1.08, 0.2], [0.55, 1.05, 0.13]].forEach(function (p, i) {       // round bushes
      var bush = K3.rock({ radius: p[2], detail: 2, seed: 90 + i, squash: 0.75, lumpy: 0.35, color: '#2c6326', top: '#79bb4c', topAmount: 0.6, material: M.leaf });
      bush.position.set(p[0], TOP + p[2] * 0.3, p[1]); g.add(bush);
    });
    [[0.62, -0.98, 0.1, 0.07], [0.72, -0.9, 0.07, 0.05], [0.56, -0.88, 0.05, 0.035]].forEach(function (m) {   // red mushrooms
      var mu = mushroom(m[2], m[3], M.capRed, true); mu.position.set(m[0], TOP - 0.03, m[1]); g.add(mu);
    });
    [[1.12, 0.55, 0.15, 1], [-1.12, -0.18, 0.18, 2]].forEach(function (p) {
      var rk = K3.rock({ radius: p[2], detail: 3, seed: 70 + p[3], squash: 0.7, color: '#9ea394', top: '#5a8f3a', topAmount: 0.5, material: M.mossRock });
      rk.position.set(p[0], TOP, p[1]); g.add(rk);
    });
    [[0.95, 0.85, 'Y'], [-0.75, 0.95, 'P'], [1.2, -0.25, 'Y'], [-0.05, -0.95, 'P'], [0.82, 0.28, 'Y'], [-0.95, 0.15, 'P']].forEach(function (f) {
      g.add(flowerAt(f[0], TOP - 0.03, f[1], f[2] === 'Y' ? M.petal : M.petal2, 1.1));
    });

    /* ===== Level 2: giant tree, big leaves, stepping stones ===== */
    if (level >= 2) {
      [[-0.98, 0.02, 0.32, 0.6, 0.5], [-1.08, 0.1, 0.26, 1.6, 0.6], [0.98, -0.35, 0.3, 4.0, 0.45], [-0.1, -1.12, 0.28, 2.6, 0.5]].forEach(function (l) {
        var bl = bigLeaf(l[2], l[3], l[4]); bl.position.set(l[0], TOP - 0.03, l[1]); g.add(bl);
      });
      [[-0.32, 1.12], [-0.12, 0.95], [0.04, 0.78]].forEach(function (p, i) {   // stepping stones into the clearing
        var st = K3.rock({ radius: 0.09, detail: 2, seed: 140 + i, squash: 0.3, color: '#b9bdb0', top: '#6a9a45', topAmount: 0.25, material: M.mossRock });
        st.position.set(p[0], TOP - 0.01, p[1]); g.add(st);
      });
      var sunbeam = new THREE.PointLight(col('#fff2c0'), 0.6, 3, 2); sunbeam.position.set(SPOT.x, TOP + 1.2, SPOT.z); g.add(sunbeam);
    }

    /* ===== Level 3: hollow log + glowing mushrooms ===== */
    if (level >= 3) {
      // Fallen hollow log lying across the back-right (along x = -z, facing the camera)
      var log = new THREE.Group(); log.position.set(0.72, TOP + 0.1, -0.78); log.rotation.y = Math.PI / 4; g.add(log);
      var shell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.75, 16, 1, true), M.bark); shell.rotation.z = Math.PI / 2; shell.castShadow = true; log.add(shell);
      var inner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.74, 16, 1, true), M.gill); inner.material = M.gill; inner.rotation.z = Math.PI / 2; log.add(inner);
      inner.material.side = THREE.DoubleSide;
      [-0.37, 0.37].forEach(function (x) {                                   // cut rings at both ends
        var ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.15, 16), M.twig); ring.rotation.y = Math.PI / 2; ring.position.x = x; log.add(ring);
      });
      var mossTop = K3.rock({ radius: 0.16, detail: 2, seed: 160, squash: 0.35, color: '#4f8a34', top: '#7fc24e', topAmount: 0.6, material: M.mossRock });
      mossTop.scale.set(2.2, 1, 1); mossTop.position.y = 0.12; log.add(mossTop);
      [[-0.2, 0.05], [0.05, -0.04], [0.22, 0.03]].forEach(function (p, i) {
        var gm = mushroom(0.06 + i * 0.02, 0.045 + i * 0.012, M.capGlow, false); gm.position.set(p[0], 0.13, p[1]); log.add(gm);
      });
      // Giant glowing mushrooms at the left
      [[-1.05, 0.8, 0.42, 0.2], [-0.88, 0.95, 0.28, 0.14], [-1.15, 0.62, 0.22, 0.11]].forEach(function (m) {
        var gm2 = mushroom(m[2], m[3], M.capGlow, false); gm2.position.set(m[0], TOP - 0.04, m[1]); g.add(gm2);
      });
      var glowL = new THREE.PointLight(col('#5ff0c8'), 1.0, 2, 2); glowL.position.set(-0.95, TOP + 0.6, 0.8); g.add(glowL);
      var glowL2 = new THREE.PointLight(col('#5ff0c8'), 0.6, 1.4, 2); glowL2.position.set(0.72, TOP + 0.5, -0.78); g.add(glowL2);
      ctx.anim(function (t) { M.capGlow.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.15; });
    }

    /* ===== Level 4: the dragon's nest ===== */
    if (level >= 4) {
      var nest = twigNest(R, SPOT.r * 0.85); nest.position.set(SPOT.x, TOP - 0.04, SPOT.z); g.add(nest);
      var bed = K3.rock({ radius: SPOT.r * 0.78, detail: 3, seed: 170, squash: 0.08, lumpy: 0.1, color: '#5e4426', top: '#8a6a34', topAmount: 0.8, material: M.leaf });   // leaf litter
      bed.position.set(SPOT.x, TOP - 0.03, SPOT.z); g.add(bed);
      for (var f = 0; f < 10; f++) {                                       // ring of glowing flowers
        var fa = f / 10 * Math.PI * 2;
        g.add(flowerAt(SPOT.x + Math.cos(fa) * (SPOT.r + 0.1), TOP - 0.03, SPOT.z + Math.sin(fa) * (SPOT.r + 0.1), M.glowFlower, 0.9));
      }
      [-40, 70, 160].forEach(function (deg, i) {                           // three mossy rune stones
        var a = deg * Math.PI / 180, x = SPOT.x + Math.cos(a) * (SPOT.r + 0.28), z = SPOT.z + Math.sin(a) * (SPOT.r + 0.28);
        var st = K3.roundedBox(0.13, 0.3 + i * 0.05, 0.1, 0.03, M.stone); st.position.set(x, TOP + 0.1, z); st.rotation.y = -a + Math.PI / 2; g.add(st);
        var mo = K3.rock({ radius: 0.08, detail: 2, seed: 180 + i, squash: 0.4, color: '#4f8a34', material: M.mossRock }); mo.position.set(x, TOP + 0.26 + i * 0.05, z); g.add(mo);
        var rn = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 5), M.rune);
        rn.position.set(x - Math.cos(a) * 0.055, TOP + 0.14, z - Math.sin(a) * 0.055); rn.rotation.y = -a + Math.PI / 2; g.add(rn);
      });
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2 + Math.sin(t * 1.7) * 0.5; });
    }

    /* ===== Level 5: canopy in bloom ===== */
    if (level >= 5) {
      // Blossoms sprinkled over the crown + glowing seed pods hanging from the branches
      tree.userData.ends.forEach(function (e, i) {
        for (var k = 0; k < 7; k++) {
          var bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), M.blossom);
          bl.position.set(e.x + (R() - 0.5) * 0.5, e.y + 0.1 + R() * 0.25, e.z + (R() - 0.5) * 0.5); tree.add(bl);
        }
        var pod = new THREE.Group(); pod.position.copy(e).add(new THREE.Vector3(0.1, -0.08, 0.05)); tree.add(pod);
        pod.add(K3.tube([[0, 0, 0], [0, -0.12, 0]], 0.006, M.vine, 3));
        var p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.pod); p.scale.y = 1.3; p.position.y = -0.17; pod.add(p);
        ctx.anim(function (t) { pod.rotation.z = Math.sin(t * 1.2 + i) * 0.15; });
      });
      ctx.anim(function (t) { M.pod.emissiveIntensity = 2 + Math.sin(t * 2) * 0.4; });
      // Falling leaves spinning down from the canopy
      var leaves = [];
      for (var lf = 0; lf < 14; lf++) {
        var leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.035), M.fallLeaf); g.add(leaf);
        leaves.push({ m: leaf, x: TREE.x + (R() - 0.5) * 1.6, z: TREE.z + (R() - 0.5) * 1.6, ph: R() * 10, sp: 0.15 + R() * 0.1 });
      }
      ctx.anim(function (t) {
        leaves.forEach(function (L) {
          var k = ((t * L.sp + L.ph) % 1);
          L.m.position.set(L.x + Math.sin(t * 1.5 + L.ph) * 0.12, TOP + 2.2 - k * 2.2, L.z + Math.cos(t * 1.2 + L.ph) * 0.1);
          L.m.rotation.set(t * 2 + L.ph, t * 1.3, L.ph);
        });
      });
      g.add(points(ctx, R, M.firefly, 45, 0, 0, 2.4, TOP + 0.15, TOP + 1.6));
      var canopyL = new THREE.PointLight(col('#d8ff8a'), 1.0, 3, 2); canopyL.position.set(TREE.x, TOP + 1.8, TREE.z); g.add(canopyL);
    }
    return g;
  }

  HABITATS.register({
    id: 'forest',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
