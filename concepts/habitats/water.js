/* ==========================================================================
   habitats/water.js: Water Habitat (element 2). Inspiration: willow tree on a
   pond island (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): a pond fills the plateau top, a mossy
   island with the willow sits at the BACK-left, and the dragon rests in open
   water at the FRONT-right (kept free).

   Levels designed: 1-5 (each level = previous level + new layer)
     1  grassy plateau sunk into a clear pond (animated ripples), small mossy
          island with a young willow, lily pads, reeds, bank boulders, pebbles
     2  + the island grows and the willow becomes a full weeping willow (focal
          point, swaying fronds), arched wooden footbridge to the island,
          lotus flowers, expanding ripple rings, soft water light
     3  + spring cliff at the back-right: stacked mossy rocks with a waterfall
          pouring into the pond, foam and rising spray
     4  + tide shrine around the dragon's spot: mossy stone pillars with glowing
          water runes, a rune ring on the water, floating lotus lanterns
     5  + crown of water: glowing water orbs orbiting the willow, glowing
          blossoms at the frond tips, fireflies
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;
  var TOP = 0.55;                                   // bank height (grass ring around the pond)
  var WATER = 0.53;                                 // pond surface height
  var POND_R = 0.95;                                // pond radius (edge hidden under the bank slope)
  var ISLAND = { x: -0.38, z: -0.38 };              // willow island (back-left)
  var SPOT = { x: 0.36, z: 0.36, r: 0.45 };         // dragon resting spot in open water (front-right)
  var CLIFF = { x: 0.62, z: -0.88 };                // level-3 spring cliff (back-right, on the bank)

  /* ------------------------- textures + materials (first build only) ------------------------- */
  var M = null;

  // Seamless ripple normal map for the water surface (height field -> normals).
  function waterNormalTexture() {
    var S = 256, H = new Float32Array(S * S), c = document.createElement('canvas'); c.width = c.height = S;
    for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
      var u = i / S, v = j / S;
      H[j * S + i] = K3.tile4(u, v, 2.5, 3) + 0.45 * K3.tile4(u + 0.37, v, 6, 2);
    }
    var x = c.getContext('2d'), img = x.createImageData(S, S), k = 2.2;
    for (var y = 0; y < S; y++) for (var xx = 0; xx < S; xx++) {
      var l = H[y * S + (xx - 1 + S) % S], r = H[y * S + (xx + 1) % S], t = H[((y - 1 + S) % S) * S + xx], b = H[((y + 1) % S) * S + xx];
      var dx = (l - r) * k, dy = (t - b) * k, len = Math.sqrt(dx * dx + dy * dy + 1), o = (y * S + xx) * 4;
      img.data[o] = (dx / len * 0.5 + 0.5) * 255; img.data[o + 1] = (dy / len * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    var tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2.5, 2.5);
    return tx;
  }

  // Waterfall streaks: light vertical stripes with soft alpha, scrolled downwards.
  function streakTexture() {
    var W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), R = K3.rng(5);
    x.fillStyle = 'rgba(150,210,240,0.55)'; x.fillRect(0, 0, W, H);
    for (var i = 0; i < 70; i++) {
      var sx = R() * W, len = 30 + R() * 120, sy = R() * H, a = 0.25 + R() * 0.55;
      var g = x.createLinearGradient(0, sy, 0, sy + len);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(240,250,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(sx, sy, 1 + R() * 3, len);
      x.fillRect(sx, sy - H, 1 + R() * 3, len);                               // wrap so the texture tiles vertically
    }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Soft round dot (spray, fireflies), drawn once on a canvas.
  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  function mats() {
    if (M) return M;
    var dot = dotTexture();
    M = {
      ground: K3.mat('grass', { vertexColors: true, repeat: 1 }),                 // tinted per vertex: pond bed / sand / grass
      mossRock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#d2d8cc' }),
      wall: K3.mat('stone', { repeat: 2, color: '#a39d90' }),
      // Not a perfect mirror: a sharp clear-coat reflects the sun as a white blow-out at some camera
      // positions (seen in the village view), so the highlight is kept soft and spread out.
      water: new THREE.MeshPhysicalMaterial({ color: col('#1c6fae'), roughness: 0.32, metalness: 0, clearcoat: 0, reflectivity: 0.25,
        transparent: true, opacity: 0.88, normalMap: waterNormalTexture(), normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.45 }),
      bark: K3.mat('bark', { repeat: 1 }),
      wood: K3.mat('wood', { repeat: 1 }),
      leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
      frond: new THREE.MeshStandardMaterial({ color: col('#5e9e3c'), roughness: 0.8, flatShading: true }),
      pad: new THREE.MeshStandardMaterial({ color: col('#4d9a3a'), roughness: 0.6, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: col('#f6b3cf'), emissive: col('#c2507e'), emissiveIntensity: 0.15, roughness: 0.6, flatShading: true }),
      pollen: new THREE.MeshStandardMaterial({ color: col('#ffd84a'), emissive: col('#ffb020'), emissiveIntensity: 0.4, roughness: 0.5 }),
      reed: new THREE.MeshStandardMaterial({ color: col('#6f9440'), roughness: 0.8, flatShading: true }),
      cattail: new THREE.MeshStandardMaterial({ color: col('#6b4528'), roughness: 0.9 }),
      falls: new THREE.MeshStandardMaterial({ map: streakTexture(), color: col('#ffffff'), emissive: col('#3a8fc0'), emissiveIntensity: 0.25,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2 }),
      foam: new THREE.MeshStandardMaterial({ color: col('#e9f5fb'), roughness: 0.7, transparent: true, opacity: 0.9 }),
      pillar: K3.mat('stone', { flat: true, repeat: 1, color: '#dfe4d8' }),
      rune: K3.mat('glow', { color: '#7fe8ff', intensity: 2.4 }),
      lantern: K3.mat('glow', { color: '#ffe6a0', intensity: 2.2 }),
      orb: new THREE.MeshPhysicalMaterial({ color: col('#4fb8f0'), emissive: col('#1a7fc8'), emissiveIntensity: 0.5, roughness: 0.03, clearcoat: 1,
        transparent: true, opacity: 0.75, envMapIntensity: 1.2 }),
      blossom: K3.mat('glow', { color: '#9ff3ff', intensity: 2.0 }),
      spray: new THREE.PointsMaterial({ map: dot, color: col('#e8f6ff'), size: 0.09, transparent: true, opacity: 0.6, depthWrite: false }),
      firefly: new THREE.PointsMaterial({ map: dot, color: col('#d8ff7a'), size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    return M;
  }

  /* ------------------------- building blocks ------------------------- */
  // Plateau: rocky underside + a lathe-turned top whose centre is sunk into a pond bed.
  // Profile (radius, height) from the centre outwards: deep bed -> slope -> grassy bank -> rounded edge.
  function pondPlateau() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.36, detail: 4, seed: 31, squash: 0.42, lumpy: 0.12, color: '#8e9688', top: '#5f7e45', topAmount: 0.2, material: M.mossRock });
    under.scale.set(1, 0.75, 1); under.position.y = -0.1; g.add(under);
    var prof = [[0, 0.42], [0.5, 0.42], [0.78, 0.45], [0.92, 0.51], [1.0, 0.565], [1.15, 0.575], [1.3, 0.56], [1.38, 0.52], [1.43, 0.47]]
      .reverse()                                                                    // outer edge first: faces point up/out
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var geo = new THREE.LatheGeometry(prof, 64), pos = geo.attributes.position, uv = geo.attributes.uv, cols = new Float32Array(pos.count * 3);
    var bed = col('#2f5a52'), sand = col('#c2ad7c'), grass = col('#ffffff'), dirt = col('#7a6248'), c = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), r = Math.hypot(x, z);
      if (r > 0.98 && y > 0.5) pos.setY(i, y + 0.015 * K3.fbm3(x * 3, 0, z * 3, 2));   // uneven grassy bank
      if (r < 0.85) c.copy(bed).lerp(sand, Math.max(0, (r - 0.55) / 0.3) * 0.5);       // dark, deep centre
      else if (r < 1.0) c.copy(sand);
      else if (y > 0.47) c.copy(grass);
      else c.copy(dirt);                                                               // earthy outer wall
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      uv.setXY(i, x * 0.45 + 0.5, z * 0.45 + 0.5 + (y < 0.47 ? y : 0));             // planar from above (no stretching)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var top = new THREE.Mesh(geo, M.ground); top.receiveShadow = true; top.castShadow = true; g.add(top);
    // Stone rim wall below the grassy edge (so the sides read as rock, like the other habitats)
    var wallProf = [[1.43, 0.47], [1.45, 0.38], [1.41, 0.27], [1.33, 0.16]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var wallGeo = new THREE.LatheGeometry(wallProf, 40), wp = wallGeo.attributes.position;
    for (var w = 0; w < wp.count; w++) {                                             // craggy: push in/out with noise
      var wx = wp.getX(w), wz = wp.getZ(w), k = 1 + 0.035 * K3.fbm3(wx * 2.5, wp.getY(w) * 4, wz * 2.5, 3);
      wp.setXYZ(w, wx * k, wp.getY(w), wz * k);
    }
    wallGeo.computeVertexNormals();
    var wall = new THREE.Mesh(wallGeo, M.wall); wall.castShadow = wall.receiveShadow = true; g.add(wall);
    return g;
  }

  // Lily pad (circle with a notch), optionally with a lotus flower.
  function lilyPad(r, flower) {
    var g = new THREE.Group();
    var pad = new THREE.Mesh(new THREE.CircleGeometry(r, 18, 0.3, Math.PI * 2 - 0.6), M.pad); pad.rotation.x = -Math.PI / 2; pad.receiveShadow = true; g.add(pad);
    if (flower) {
      for (var i = 0; i < 7; i++) {
        var a = i / 7 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), M.petal);
        p.position.set(Math.cos(a) * 0.03, 0.04, Math.sin(a) * 0.03); p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(p);
      }
      var c = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.pollen); c.position.y = 0.03; g.add(c);
    }
    return g;
  }

  // Clump of reeds, some with brown cattail heads.
  function reeds(R, n) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var h = 0.28 + R() * 0.22, a = R() * Math.PI * 2, d = R() * 0.08;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, h, 5), M.reed);
      stem.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); stem.rotation.set((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3); stem.castShadow = true; g.add(stem);
      if (i % 2 === 0) {
        var head = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 6), M.cattail);
        head.position.set(0, h / 2 - 0.06, 0); stem.add(head);
      }
    }
    return g;
  }

  // Weeping willow. s = size (0.6 young, 1 full). Fronds hang from the crown and sway.
  // Returns the group; userData.tips lists frond-tip positions (local) for level-5 blossoms.
  function willow(ctx, R, s) {
    var g = new THREE.Group();
    g.add(K3.tube([[0, -0.05, 0], [0.06 * s, 0.35 * s, 0.03 * s], [-0.03 * s, 0.75 * s, 0.06 * s], [0.03 * s, 1.08 * s, 0]], [0.12 * s, 0.06 * s], M.bark, 24));
    [[0.35, 0.05], [-0.3, 0.2], [0.05, -0.33], [-0.1, 0.32]].forEach(function (b) {   // main branches
      g.add(K3.tube([[0.02 * s, 0.95 * s, 0.02 * s], [b[0] * 0.5 * s, 1.15 * s, b[1] * 0.5 * s], [b[0] * s, 1.2 * s, b[1] * s]], [0.045 * s, 0.02 * s], M.bark, 10));
    });
    // Crown: overlapping leafy lumps, darker underneath (baked into rock vertex colours)
    for (var i = 0; i < 11; i++) {                                           // wide, low dome (not a mushroom cap)
      var a = i / 11 * Math.PI * 2 + R() * 0.3, d = i < 2 ? 0.1 * s : (0.38 + R() * 0.08) * s;
      var lump = K3.rock({ radius: (i < 2 ? 0.32 : 0.22 + R() * 0.06) * s, detail: 2, seed: 500 + i, squash: 0.55, lumpy: 0.35, color: '#24521c', top: '#559a32', topAmount: 0.55, material: M.leaf });
      lump.position.set(Math.cos(a) * d, (i < 2 ? 1.34 : 1.18 + R() * 0.08) * s, Math.sin(a) * d); g.add(lump);
    }
    // Hanging fronds: thin tapered strands from the crown's rim down towards the water
    var fronds = [], tips = [], N = Math.round(34 * s);
    for (var f = 0; f < N; f++) {
      var fa = f / N * Math.PI * 2 + R() * 0.15, fr = (0.42 + R() * 0.12) * s, top = (1.12 + R() * 0.12) * s, len = (0.55 + R() * 0.3) * s;
      var piv = new THREE.Group(); piv.position.set(Math.cos(fa) * fr, top, Math.sin(fa) * fr); g.add(piv);
      var ox = Math.cos(fa) * 0.06 * s, oz = Math.sin(fa) * 0.06 * s;
      var strand = K3.tube([[0, 0, 0], [ox, -len * 0.4, oz], [ox * 1.4, -len, oz * 1.4]], [0.035 * s, 0.012 * s], M.frond, 8);
      strand.castShadow = true; piv.add(strand);
      fronds.push({ p: piv, ph: R() * 6.28 });
      tips.push(new THREE.Vector3(piv.position.x + ox * 1.4, top - len, piv.position.z + oz * 1.4));
    }
    ctx.anim(function (t) { fronds.forEach(function (fd) { fd.p.rotation.x = Math.sin(t * 1.1 + fd.ph) * 0.06; fd.p.rotation.z = Math.cos(t * 0.9 + fd.ph) * 0.05; }); });
    g.userData.tips = tips;
    return g;
  }

  // Vertical strip along a path (the waterfall); `side` is the horizontal direction across it.
  function sheet(points, side, width, material, segments) {
    var curve = new THREE.CatmullRomCurve3(points), pos = [], uv = [], idx = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments, p = curve.getPointAt(t), w = width / 2 * (1 + 0.35 * t);   // widens as it falls
      pos.push(p.x + side.x * w, p.y, p.z + side.z * w, p.x - side.x * w, p.y, p.z - side.z * w);
      uv.push(0, 1 - t * 2, 1, 1 - t * 2);
      if (i < segments) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  // Slowly drifting points in a box (spray, fireflies). vy > 0 rises, 0 hovers.
  function drift(ctx, R, material, n, cx, cz, spread, y0, y1, vy) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = cx + (R() - 0.5) * spread; pos[i * 3 + 1] = y0 + R() * (y1 - y0); pos[i * 3 + 2] = cz + (R() - 0.5) * spread;
      seed.push(R() * 6.28);
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        pos[q * 3 + 1] += vy * dt * (0.7 + (q % 4) * 0.15) + (vy === 0 ? Math.sin(t * 1.3 + seed[q]) * dt * 0.05 : 0);
        pos[q * 3] += Math.sin(t * 0.8 + seed[q]) * dt * 0.07;
        pos[q * 3 + 2] += Math.cos(t * 0.6 + seed[q]) * dt * 0.07;
        if (vy > 0 && pos[q * 3 + 1] > y1) pos[q * 3 + 1] = y0;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, material);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(17), g = new THREE.Group();
    g.add(pondPlateau());

    /* ===== Level 1 ===== */
    var water = new THREE.Mesh(new THREE.CircleGeometry(POND_R, 64), M.water); water.rotation.x = -Math.PI / 2; water.position.y = WATER; water.receiveShadow = true; g.add(water);
    ctx.anim(function (t) { M.water.normalMap.offset.set(t * 0.012, t * 0.008); });   // gentle ripples drifting

    // Grass on the bank ring only
    g.add(K3.grass({ count: 1700, width: 2.8, depth: 2.8, height: 0.13, y: 0.56, seed: 23, colors: ['#2c5a22', '#a5d862'],
      area: function (x, z) { var r = Math.hypot(x, z); return r > 1.03 && r < 1.33; } }));

    // Mossy island (grows at level 2) with the willow (young at level 1, full at level 2)
    var isl = K3.rock({ radius: level >= 2 ? 0.4 : 0.3, detail: 3, seed: 41, squash: 0.42, lumpy: 0.18, color: '#8a9284', top: '#5f8f3c', topAmount: 0.55, material: M.mossRock });
    isl.position.set(ISLAND.x, WATER - 0.04, ISLAND.z); g.add(isl);
    if (level >= 2) {
      var isl2 = K3.rock({ radius: 0.22, detail: 3, seed: 43, squash: 0.5, lumpy: 0.2, color: '#8a9284', top: '#5f8f3c', topAmount: 0.55, material: M.mossRock });
      isl2.position.set(ISLAND.x - 0.28, WATER - 0.03, ISLAND.z + 0.2); g.add(isl2);
    }
    var tree = willow(ctx, R, level >= 2 ? 1 : 0.6); tree.position.set(ISLAND.x, WATER + 0.1, ISLAND.z); g.add(tree);

    // Lily pads (kept off the dragon spot)
    [[0.55, -0.35, 0.09, 0], [-0.05, 0.62, 0.08, 1], [0.7, -0.05, 0.065, 0], [-0.55, 0.3, 0.075, 1]].forEach(function (p, i) {
      var lp = lilyPad(p[2], level >= 2 && p[3]); lp.position.set(p[0], WATER + 0.004, p[1]); lp.rotation.y = i * 1.7; g.add(lp);
    });
    // Reeds on the bank and bank boulders
    [[1.02, -0.45, 9], [-0.95, 0.6, 8], [0.15, 1.05, 6]].forEach(function (p) { var rd = reeds(R, p[2]); rd.position.set(p[0], WATER - 0.02, p[1]); g.add(rd); });
    [[1.15, 0.3, 0.17, 1], [-1.12, -0.2, 0.2, 2], [0.55, 1.12, 0.14, 3]].forEach(function (p) {
      var bd = K3.rock({ radius: p[2], detail: 3, seed: 60 + p[3], squash: 0.7, color: '#9aa196', top: '#6a9a45', topAmount: 0.45, material: M.mossRock });
      bd.position.set(p[0], TOP + 0.02, p[1]); g.add(bd);
    });
    [[0.95, 0.75], [-0.7, 0.95], [1.2, -0.15], [-1.2, 0.3], [0.3, -1.15]].forEach(function (p, i) {      // pebbles
      var pb = K3.rock({ radius: 0.05 + R() * 0.04, detail: 2, seed: 80 + i, squash: 0.6, color: '#a8ada2', material: M.mossRock });
      pb.position.set(p[0], TOP + 0.01, p[1]); g.add(pb);
    });

    /* ===== Level 2 ===== */
    if (level >= 2) {
      // Arched wooden footbridge from the left bank to the island
      var A = new THREE.Vector3(-1.02, TOP + 0.02, 0.15), B = new THREE.Vector3(-0.58, WATER + 0.1, -0.2);
      var dir = B.clone().sub(A), L = dir.length(); dir.normalize();
      var across = new THREE.Vector3(-dir.z, 0, dir.x);
      function arc(t) { var p = A.clone().lerp(B, t); p.y += Math.sin(t * Math.PI) * 0.12; return p; }
      for (var k = 0; k <= 7; k++) {
        var plank = K3.roundedBox(L / 8 * 0.85, 0.025, 0.24, 0.008, M.wood), pp = arc(k / 7);
        plank.position.copy(pp); plank.rotation.y = -Math.atan2(dir.z, dir.x);
        plank.rotateZ(Math.cos(k / 7 * Math.PI) * 0.35); g.add(plank);
      }
      [-1, 1].forEach(function (sd) {                                           // posts + rails on both sides
        var rail = [];
        [0, 0.5, 1].forEach(function (t) {
          var p = arc(t).addScaledVector(across, sd * 0.12);
          var post = K3.roundedBox(0.03, 0.16, 0.03, 0.006, M.wood); post.position.set(p.x, p.y + 0.08, p.z); g.add(post);
        });
        for (var q = 0; q <= 6; q++) { var rp = arc(q / 6).addScaledVector(across, sd * 0.12); rail.push([rp.x, rp.y + 0.15, rp.z]); }
        g.add(K3.tube(rail, 0.012, M.wood, 16));
      });
      // More pads with lotus flowers
      [[0.05, -0.05, 0.07], [-0.3, 0.55, 0.06], [0.82, 0.25, 0.06]].forEach(function (p, i) {
        var lp = lilyPad(p[2], true); lp.position.set(p[0], WATER + 0.004, p[1]); lp.rotation.y = i * 2.3; g.add(lp);
      });
      // Expanding ripple rings (each loops with its own phase)
      [[0.5, -0.5], [-0.1, 0.3], [0.62, 0.55], [-0.6, 0.55]].forEach(function (p, i) {
        var rm = new THREE.MeshBasicMaterial({ color: col('#e6f6ff'), transparent: true, opacity: 0.5, depthWrite: false });
        var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), rm); ring.rotation.x = -Math.PI / 2; ring.position.set(p[0], WATER + 0.006, p[1]); g.add(ring);
        ctx.anim(function (t) { var k2 = (t * 0.35 + i * 0.27) % 1; ring.scale.setScalar(0.03 + k2 * 0.2); rm.opacity = 0.55 * (1 - k2); });
      });
      var wl = new THREE.PointLight(col('#8fd8ff'), 0.8, 3, 2); wl.position.set(0.2, TOP + 0.8, 0.2); g.add(wl);
    }

    /* ===== Level 3: spring cliff + waterfall ===== */
    if (level >= 3) {
      var toPond = new THREE.Vector3(-CLIFF.x, 0, -CLIFF.z).normalize(), across3 = new THREE.Vector3(-toPond.z, 0, toPond.x);
      [[0, TOP + 0.1, 0, 0.4, 0.9, 1], [0.06, TOP + 0.55, -0.05, 0.3, 0.85, 2], [0.1, TOP + 0.88, -0.1, 0.22, 0.8, 3], [-0.28, TOP + 0.05, 0.1, 0.2, 0.7, 4]].forEach(function (c) {
        var ck = K3.rock({ radius: c[3], detail: 3, seed: 700 + c[5], squash: c[4], lumpy: 0.28, color: '#8e968a', top: '#5f8f3c', topAmount: 0.4, material: M.mossRock });
        ck.position.set(CLIFF.x + across3.x * c[0] - toPond.x * c[2], c[1], CLIFF.z + across3.z * c[0] - toPond.z * c[2]); g.add(ck);
      });
      // The waterfall: from the lip of the middle rock, curving out and down into the pond
      function fromCliff(o, y) { return new THREE.Vector3(CLIFF.x + toPond.x * o, y, CLIFF.z + toPond.z * o); }
      // Flat lip stone sticking out of the cliff: the water spills from here
      var lipP = fromCliff(0.3, TOP + 0.7);
      var lip = K3.rock({ radius: 0.16, detail: 3, seed: 710, squash: 0.35, lumpy: 0.2, color: '#8e968a', top: '#5f8f3c', topAmount: 0.4, material: M.mossRock });
      lip.position.copy(lipP); g.add(lip);
      var fall = sheet([fromCliff(0.3, TOP + 0.76), fromCliff(0.43, TOP + 0.73), fromCliff(0.52, TOP + 0.45), fromCliff(0.56, TOP + 0.15), fromCliff(0.57, WATER)], across3, 0.28, M.falls, 24);
      g.add(fall);
      ctx.anim(function (t) { M.falls.map.offset.y = t * 0.9; });              // water rushing down
      // Foam where it lands + spray rising
      var land = fromCliff(0.59, WATER);
      for (var fm = 0; fm < 5; fm++) {
        var fa2 = fm / 5 * Math.PI * 2, foam = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (fm % 2) * 0.025, 10, 6), M.foam);
        foam.scale.y = 0.45; foam.position.set(land.x + Math.cos(fa2) * 0.09, WATER + 0.01, land.z + Math.sin(fa2) * 0.09); g.add(foam);
        (function (f, ph) { ctx.anim(function (t) { var s2 = 1 + Math.sin(t * 5 + ph) * 0.15; f.scale.set(s2, 0.45 * s2, s2); }); })(foam, fm);
      }
      g.add(drift(ctx, R, M.spray, 26, land.x, land.z, 0.35, WATER, WATER + 0.55, 0.18));
    }

    /* ===== Level 4: tide shrine around the dragon's spot ===== */
    if (level >= 4) {
      // Mossy stone pillars on the front arc around the spot, each with a glowing water rune
      [-35, 10, 55, 100, 145].forEach(function (deg, i) {
        var a = deg * Math.PI / 180, px = SPOT.x + Math.cos(a) * (SPOT.r + 0.2), pz = SPOT.z + Math.sin(a) * (SPOT.r + 0.2);
        var h = 0.32 + (i % 2) * 0.1, base = Math.hypot(px, pz) > POND_R - 0.05 ? TOP - 0.02 : WATER - 0.08;
        var pil = K3.roundedBox(0.12, h, 0.12, 0.025, M.pillar); pil.position.set(px, base + h / 2, pz); pil.rotation.y = -a; g.add(pil);
        var moss = K3.rock({ radius: 0.085, detail: 2, seed: 800 + i, squash: 0.4, color: '#5f8f3c', material: M.mossRock }); moss.position.set(px, base + h, pz); g.add(moss);
        var rune = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, i % 2 ? 3 : 6), M.rune);
        rune.position.set(px - Math.cos(a) * 0.063, base + h * 0.6, pz - Math.sin(a) * 0.063); rune.rotation.y = Math.PI / 2 - a; g.add(rune);
      });
      // Rune ring on the water around the spot
      var ringR = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.03, 0.01, 6, 72), M.rune); ringR.rotation.x = Math.PI / 2; ringR.position.set(SPOT.x, WATER + 0.008, SPOT.z); g.add(ringR);
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2.4 + Math.sin(t * 2) * 0.6; });
      // Floating lotus lanterns bobbing on the pond
      [[-0.05, 0.12], [0.62, -0.32], [-0.62, 0.15], [0.05, 0.78]].forEach(function (p, i) {
        var ln = lilyPad(0.05, true); ln.scale.setScalar(1.2); ln.position.set(p[0], WATER + 0.005, p[1]); g.add(ln);
        var glowC = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M.lantern); glowC.position.set(p[0], WATER + 0.05, p[1]); g.add(glowC);
        ctx.anim(function (t) { var b = Math.sin(t * 1.5 + i * 1.3) * 0.006; ln.position.y = WATER + 0.005 + b; glowC.position.y = WATER + 0.05 + b; });
      });
      var shrineLight = new THREE.PointLight(col('#7fe8ff'), 0.9, 1.8, 2); shrineLight.position.set(SPOT.x, WATER + 0.45, SPOT.z); g.add(shrineLight);
    }

    /* ===== Level 5: crown of water ===== */
    if (level >= 5) {
      // Water orbs orbiting the willow crown
      var orbs = new THREE.Group(); orbs.position.set(ISLAND.x, WATER + 1.45, ISLAND.z); g.add(orbs);
      for (var o = 0; o < 6; o++) {
        var oa = o / 6 * Math.PI * 2, orb = new THREE.Mesh(new THREE.SphereGeometry(o % 2 ? 0.06 : 0.08, 20, 14), M.orb);
        orb.position.set(Math.cos(oa) * 0.75, Math.sin(o * 1.9) * 0.1, Math.sin(oa) * 0.75); orbs.add(orb);
      }
      ctx.anim(function (t) { orbs.rotation.y = t * 0.4; orbs.position.y = WATER + 1.45 + Math.sin(t * 1.2) * 0.05; });
      // Glowing blossoms at the willow's frond tips (every second frond)
      tree.userData.tips.forEach(function (tp, i) {
        if (i % 2) return;
        var bl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M.blossom); bl.position.copy(tp); tree.add(bl);
      });
      ctx.anim(function (t) { M.blossom.emissiveIntensity = 2.0 + Math.sin(t * 1.6) * 0.5; });
      g.add(drift(ctx, R, M.firefly, 40, 0, 0, 2.4, WATER + 0.1, WATER + 1.4, 0));   // fireflies hovering
      var crownL = new THREE.PointLight(col('#8fe3ff'), 1.1, 3, 2); crownL.position.set(ISLAND.x, WATER + 1.5, ISLAND.z); g.add(crownL);
    }
    return g;
  }

  HABITATS.register({
    id: 'water',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: WATER + 0.01, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
