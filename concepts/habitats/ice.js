/* ==========================================================================
   habitats/ice.js: Ice Habitat (element 5). Moved from habitat-preview-v2.html.

   Layout (camera looks from +x,+z): crystal spire at the BACK-left, the frozen
   pool at the FRONT centre is the dragon's resting spot (kept free).

   Levels designed: 1-5 (each level = previous level + new layer)
     1  snowy floating plateau, small frozen pool, young crystal cluster, two snowy rocks
     2  + bigger pool with a glowing rune ring and ice floes, rocky outcrop with a tall
          crystal spire (focal point), rim crystals, two frosted pines, icicles,
          orbiting shards, rising snow sparkles, cold blue light
     3  + frozen stream from the pool to the front rim, spilling over the edge as an
          icefall (frozen waterfall of ice columns) onto an ice mound, drifting mist
     4  + glacier wall: a crescent of tall snow-capped ice blocks along the back rim,
          two stone frost lanterns with glowing crystals at the front
     5  + crown of ice: ring of crystals orbiting the spire's tip, falling snow and
          an aurora rippling in the sky behind the habitat
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;

  // Materials are created on first build only (not when the page loads).
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      snow: K3.mat('snow', { repeat: 2, normalScale: 0.8, color: '#d9e6f2' }),
      stone: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#a9b9c6' }),
      ice: K3.mat('ice', { repeat: 1.5, roughness: 0.25, normalScale: 0.5 }),
      deepIce: new THREE.MeshPhysicalMaterial({ color: col('#1d6fb3'), emissive: col('#0d4f8f'), emissiveIntensity: 0.6, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }),
      rune: K3.mat('glow', { color: '#8ff0ff', intensity: 3 }),
      icicle: K3.mat('crystal', { intensity: 0.2 }),
      bark: K3.mat('bark', { repeat: 1 }),
      pine: new THREE.MeshStandardMaterial({ color: col('#2e5e45'), roughness: 0.9, flatShading: true }),
      // Level 3+: frozen water (icefall, stream) and glacier ice: glassy, faceted, faint inner glow.
      frozen: new THREE.MeshPhysicalMaterial({ color: col('#5fb2e6'), emissive: col('#1a68b0'), emissiveIntensity: 0.45, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.9, flatShading: true, envMapIntensity: 0.9 }),
      glacier: new THREE.MeshPhysicalMaterial({ color: col('#6fb8e4'), emissive: col('#0f4a7c'), emissiveIntensity: 0.35, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.93, flatShading: true, envMapIntensity: 0.85 }),
      lanternStone: K3.mat('stone', { flat: true, repeat: 1, color: '#b4c2ce' }),
      lanternGlow: K3.mat('glow', { color: '#8ff0ff', intensity: 2.6 }),
      mist: new THREE.PointsMaterial({ map: dotTexture(), color: col('#dff4ff'), size: 0.16, transparent: true, opacity: 0.45, depthWrite: false }),
      snowflake: new THREE.PointsMaterial({ map: dotTexture(), color: col('#f2f8ff'), size: 0.05, transparent: true, opacity: 0.9, depthWrite: false })
    };
    return M;
  }

  // Soft round dot (mist puffs, snowflakes), drawn once on a canvas.
  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  var TOP = 0.55;   // height of the snow surface: everything stands on it
  var POOL = { x: 0.28, z: 0.28 };                         // frozen pool centre = dragon spot
  // Level-3 frozen stream: from the pool's rim to the front rim of the plateau (x, y, z). The
  // snow cap is domed, so the stream slopes down towards the edge.
  var STREAM = [[0.66, TOP + 0.04, 0.68], [0.8, TOP + 0.02, 0.83], [0.92, 0.515, 0.93], [0.99, 0.49, 0.99]];

  /* ------------------------- building blocks ------------------------- */
  // Snow-capped floating rock: the habitat's base (rocky underside + smooth snow top).
  function snowPlateau(radius) {
    var g = new THREE.Group();
    var under = K3.rock({ radius: radius, detail: 4, seed: 11, squash: 0.42, lumpy: 0.22, color: '#c6d6e2', top: '#ffffff', topAmount: 0.35, material: M.stone });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: radius * 1.02, detail: 4, seed: 3, squash: 0.08, lumpy: 0.08, flat: false, material: M.snow });
    cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Stylised frosted pine built from stacked cones with snow on each tier.
  function frostPine(h) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * h, 0.08 * h, 0.35 * h, 7), M.bark); trunk.position.y = 0.17 * h; trunk.castShadow = true; g.add(trunk);
    for (var i = 0; i < 4; i++) {
      var r = (0.42 - i * 0.09) * h, y = (0.3 + i * 0.22) * h;
      var tier = new THREE.Mesh(new THREE.ConeGeometry(r, 0.36 * h, 8), M.pine); tier.position.y = y + 0.18 * h; tier.castShadow = tier.receiveShadow = true; g.add(tier);
      var snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.78, 0.16 * h, 8), M.snow); snow.position.y = y + 0.3 * h; snow.castShadow = true; g.add(snow);
    }
    return g;
  }

  // Frozen pool: glassy deep-blue centre, icy rim, optional glowing rune ring + floes.
  function frozenPool(radius, runes, R) {
    var g = new THREE.Group();
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.08, radius * 1.12, 0.06, 40), M.ice); rim.receiveShadow = true; g.add(rim);
    var deep = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.065, 40), M.deepIce); deep.position.y = 0.002; g.add(deep);
    for (var i = 0; i < 14; i++) {                                        // snow lumps around the edge
      var a = i / 14 * Math.PI * 2 + R() * 0.2, l = K3.rock({ radius: 0.09 + R() * 0.07, detail: 2, seed: 40 + i, squash: 0.5, flat: false, material: M.snow });
      l.position.set(Math.cos(a) * radius * 1.13, 0.02, Math.sin(a) * radius * 1.13); g.add(l);
    }
    if (runes) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.95, 0.018, 8, 72), M.rune); ring.rotation.x = Math.PI / 2; ring.position.y = 0.045; g.add(ring);
      for (var r = 0; r < 8; r++) {
        var ra = r / 8 * Math.PI * 2, rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), M.rune);
        rune.position.set(Math.cos(ra) * radius * 0.95, 0.07, Math.sin(ra) * radius * 0.95); g.add(rune);
      }
      for (var f = 0; f < 4; f++) {                                       // drifting ice floes
        var floe = new THREE.Mesh(new THREE.CylinderGeometry(0.08 + R() * 0.06, 0.09, 0.03, 6), M.snow);
        floe.position.set((R() - 0.5) * radius, 0.05, (R() - 0.5) * radius); floe.rotation.y = R() * 3; g.add(floe);
      }
    }
    return g;
  }

  // Flat ribbon along a smooth path (the frozen stream). Each point keeps its own height.
  function ribbon(points, width, material, segments) {
    var curve = new THREE.CatmullRomCurve3(points), pos = [], idx = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      var s = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(width / 2 * (1 + 0.25 * t));   // widens towards the edge
      pos.push(p.x + s.x, p.y, p.z + s.z, p.x - s.x, p.y, p.z - s.z);
      if (i < segments) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) { geo.index.array.reverse(); geo.computeVertexNormals(); }   // make sure it faces up
    var m = new THREE.Mesh(geo, material); m.receiveShadow = true; return m;
  }

  // Frost lantern: snowy stone base, four posts under a pointed snowy roof, glowing crystal inside.
  function frostLantern() {
    var g = new THREE.Group();
    var base = K3.roundedBox(0.24, 0.12, 0.24, 0.03, M.lanternStone); base.position.y = 0.06; g.add(base);
    var shaft = K3.roundedBox(0.13, 0.32, 0.13, 0.025, M.lanternStone); shaft.position.y = 0.28; g.add(shaft);
    var deck = K3.roundedBox(0.26, 0.05, 0.26, 0.015, M.lanternStone); deck.position.y = 0.46; g.add(deck);
    for (var i = 0; i < 4; i++) {                                           // corner posts
      var a = i / 4 * Math.PI * 2 + Math.PI / 4, post = K3.roundedBox(0.035, 0.2, 0.035, 0.008, M.lanternStone);
      post.position.set(Math.cos(a) * 0.1, 0.585, Math.sin(a) * 0.1); g.add(post);
    }
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), M.lanternStone); roof.rotation.y = Math.PI / 4; roof.position.y = 0.78; roof.castShadow = true; g.add(roof);
    var roofSnow = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), M.snow); roofSnow.rotation.y = Math.PI / 4; roofSnow.position.y = 0.83; g.add(roofSnow);
    var gem = K3.crystal({ height: 0.1, radius: 0.04, core: false, intensity: 0.9 }); gem.position.y = 0.5; g.add(gem);
    var heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.lanternGlow); heart.position.y = 0.59; heart.scale.y = 1.4; g.add(heart);
    var cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), M.lanternGlow); cap.position.y = 0.92; g.add(cap);   // glint on the roof tip
    g.userData.heart = heart;
    return g;
  }

  // Aurora: a tall curved curtain with an additive, softly waving green-to-violet glow.
  function aurora(ctx) {
    var geo = new THREE.PlaneGeometry(4.2, 1.1, 64, 8), p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {                                     // bend the curtain into an arc
      var x = p.getX(i), a = x / 2.6;
      p.setXYZ(i, Math.sin(a) * 2.6, p.getY(i), -Math.cos(a) * 2.6 + 2.6);
    }
    geo.computeVertexNormals();
    var mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; uniform float t;\n' +
        'void main(){ vUv = uv; vec3 q = position;\n' +
        '  q.z += sin(uv.x * 9.0 + t * 0.8) * 0.12 + sin(uv.x * 23.0 - t * 1.3) * 0.04;\n' +
        '  q.y += sin(uv.x * 6.0 + t * 0.5) * 0.08;\n' +
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float t;\n' +
        'void main(){\n' +
        '  float rays = 0.78 + 0.22 * sin(vUv.x * 140.0 + sin(vUv.x * 7.0 + t) * 4.0 + t * 0.6);\n' +
        '  rays *= 0.7 + 0.3 * sin(vUv.x * 11.0 - t * 0.4);\n' +
        '  float fadeY = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));\n' +
        '  float fadeX = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));\n' +
        '  vec3 c = mix(vec3(0.15, 0.85, 0.55), vec3(0.55, 0.35, 0.95), smoothstep(0.35, 0.95, vUv.y));\n' +
        '  gl_FragColor = vec4(c * rays * fadeY * fadeX * 0.42, 1.0); }'
    });
    ctx.anim(function (t) { mat.uniforms.t.value = t; });
    return new THREE.Mesh(geo, mat);
  }

  // Slowly drifting points in a box (mist puffs or snowflakes). vy < 0 falls, > 0 rises.
  function drift(ctx, R, material, n, cx, cz, spread, y0, y1, vy) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = cx + (R() - 0.5) * spread; pos[i * 3 + 1] = y0 + R() * (y1 - y0); pos[i * 3 + 2] = cz + (R() - 0.5) * spread;
      seed.push(R() * 6.28);
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        pos[q * 3 + 1] += vy * dt * (0.7 + (q % 4) * 0.15);
        pos[q * 3] += Math.sin(t * 0.9 + seed[q]) * dt * 0.06;
        pos[q * 3 + 2] += Math.cos(t * 0.7 + seed[q]) * dt * 0.06;
        if (vy < 0 && pos[q * 3 + 1] < y0) pos[q * 3 + 1] = y1;
        if (vy > 0 && pos[q * 3 + 1] > y1) pos[q * 3 + 1] = y0;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, material);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(7), g = new THREE.Group();
    g.add(snowPlateau(1.38));
    // The pool grows at level 2 (it is the habitat's centre, where the dragon will rest).
    var pool = frozenPool(level >= 2 ? 0.62 : 0.45, level >= 2, R); pool.position.set(0.28, TOP, 0.28); g.add(pool);

    /* Level 1: a young crystal cluster and two snowy rocks */
    var young = K3.crystalCluster({ count: 4, height: 0.75, radius: 0.12, seed: 5, spread: 0.18 });
    young.position.set(-0.55, TOP - 0.02, -0.5); g.add(young);
    [[0.8, -0.55, 0.22, 1], [-0.7, 0.72, 0.18, 2]].forEach(function (p) {
      var rk = K3.rock({ radius: p[2], detail: 3, seed: 60 + p[3], squash: 0.7, color: '#b8c8d6', top: '#ffffff', topAmount: 0.5, material: M.stone });
      rk.position.set(p[0], TOP + 0.02, p[1]); g.add(rk);
    });

    /* Level 2 */
    if (level >= 2) {
      // Rocky outcrop at the back carrying a tall crystal spire (focal point)
      var outcrop = K3.rock({ radius: 0.48, detail: 4, seed: 77, squash: 0.85, lumpy: 0.3, color: '#aebfcd', top: '#ffffff', topAmount: 0.4, material: M.stone });
      outcrop.position.set(-0.62, TOP + 0.12, -0.58); g.add(outcrop);
      var spire = K3.crystalCluster({ count: 7, height: 2.1, radius: 0.2, seed: 12, spread: 0.3, intensity: 0.45 });
      spire.position.set(-0.62, TOP + 0.42, -0.58); g.add(spire);
      // Small crystals along the rim
      [[0.95, 0.5], [1.05, 0.0], [0.4, 1.02], [-0.25, 1.0]].forEach(function (c, i) {
        var cc = K3.crystalCluster({ count: 3, height: 0.45, radius: 0.07, seed: 30 + i, spread: 0.08 }); cc.position.set(c[0], TOP - 0.02, c[1]); g.add(cc);
      });
      // Frosted pines
      var p1 = frostPine(1.25); p1.position.set(0.95, TOP - 0.03, -0.75); g.add(p1);
      var p2 = frostPine(0.95); p2.position.set(-1.0, TOP - 0.03, 0.4); g.add(p2);
      // Icicles hanging under the rim (front)
      for (var k = 0; k < 16; k++) {
        var ka = -0.45 + k / 15 * 2.3, len = 0.16 + R() * 0.34;
        var ic = new THREE.Mesh(new THREE.ConeGeometry(0.04, len, 6), M.icicle);
        ic.position.set(Math.cos(ka) * 1.33, 0.22 - len / 2, Math.sin(ka) * 1.33); ic.rotation.x = Math.PI; g.add(ic);
      }
      // Floating shards orbiting above the pool
      var shards = new THREE.Group(); shards.position.set(0.28, 1.35, 0.28); g.add(shards);
      for (var s = 0; s < 5; s++) {
        var sh = K3.crystal({ height: 0.16, radius: 0.045, core: false, intensity: 0.6 });
        sh.position.set(Math.cos(s * 1.26) * 0.5, Math.sin(s * 2) * 0.08, Math.sin(s * 1.26) * 0.5); sh.rotation.z = 0.4; shards.add(sh);
      }
      ctx.anim(function (t) { shards.rotation.y = t * 0.7; shards.position.y = 1.35 + Math.sin(t * 1.4) * 0.06; });
      // Snow sparkles rising
      var N = 70, pos = new Float32Array(N * 3);
      for (var p = 0; p < N; p++) { pos[p * 3] = 0.28 + (R() - 0.5) * 1.6; pos[p * 3 + 1] = TOP + R() * 2; pos[p * 3 + 2] = 0.28 + (R() - 0.5) * 1.6; }
      var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: col('#ffffff'), size: 0.045, transparent: true, opacity: 0.95 })));
      ctx.anim(function (t, dt) { for (var q = 0; q < N; q++) { pos[q * 3 + 1] += dt * 0.22; if (pos[q * 3 + 1] > TOP + 2.2) pos[q * 3 + 1] = TOP; } pg.attributes.position.needsUpdate = true; });
      var light = new THREE.PointLight(col('#8fe3ff'), 2.2, 4.5, 2); light.position.set(-0.5, 1.7, -0.5); g.add(light);
    }

    /* ===== Level 3: frozen stream + icefall (front-right, facing the camera) ===== */
    if (level >= 3) {
      var path = STREAM.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      g.add(ribbon(path, 0.26, M.deepIce, 32));                                // same glassy deep blue as the pool
      // Snow banks along both sides of the stream
      var sc = new THREE.CatmullRomCurve3(path);
      for (var b = 1; b < 8; b++) {
        var bt = b / 8, bp = sc.getPointAt(bt), btg = sc.getTangentAt(bt), bs = new THREE.Vector3(-btg.z, 0, btg.x).normalize();
        [-1, 1].forEach(function (sd, si) {
          var lump = K3.rock({ radius: 0.06 + R() * 0.04, detail: 2, seed: 300 + b * 2 + si, squash: 0.5, flat: false, material: M.snow });
          lump.position.copy(bp).addScaledVector(bs, sd * (0.15 + bt * 0.04)); lump.position.y -= 0.02; g.add(lump);
        });
      }
      // The icefall: a broad frozen cascade bulging out over the rim and down to the grass,
      // flanked by thinner ice columns, some reaching the ground and some hanging as icicles.
      var e = path[path.length - 1], out = new THREE.Vector3(e.x, 0, e.z).normalize(), side = new THREE.Vector3(-out.z, 0, out.x);
      function at(o, y, s) { return [e.x + out.x * o + side.x * s, y, e.z + out.z * o + side.z * s]; }
      [-0.07, 0.07].forEach(function (s) {                                       // two fused main ribs = a broad sheet
        g.add(K3.tube([at(-0.04, e.y + 0.01, s), at(0.12, e.y - 0.04, s), at(0.22, 0.3, s * 1.2), at(0.26, 0.12, s * 1.3), at(0.28, 0.03, s * 1.3)], [0.12, 0.17], M.frozen, 32));
      });
      [-0.21, -0.14, 0.14, 0.21, -0.29, 0.29].forEach(function (s, i) {
        var full = i < 4, bottom = full ? 0.03 : 0.2 + R() * 0.12, bulge = 0.12 + R() * 0.05;
        g.add(K3.tube([at(-0.02, e.y - 0.01, s), at(bulge * 0.8, e.y - 0.08, s * 1.05), at(bulge, (e.y + bottom) / 2, s * 1.1), at(bulge + 0.04, bottom, s * 1.12)],
          full ? [0.06, 0.07] : [0.045, 0.006], M.frozen, 20));
      });
      // Ice mound where the fall meets the grass, with small crystals and a snow drift
      var foot = at(0.34, 0, 0);
      [[0, 0, 0.23, 1], [0.1, 0.2, 0.15, 2], [0.06, -0.22, 0.14, 3], [0.2, -0.05, 0.11, 4]].forEach(function (m) {
        var chunk = K3.rock({ radius: m[2], detail: 2, seed: 330 + m[3], squash: 0.75, lumpy: 0.3, material: M.frozen });
        chunk.position.set(foot[0] + out.x * m[0] + side.x * m[1], 0.06, foot[2] + out.z * m[0] + side.z * m[1]); g.add(chunk);
      });
      var footCr = K3.crystalCluster({ count: 3, height: 0.32, radius: 0.05, seed: 41, spread: 0.06 });
      footCr.position.set(foot[0] + side.x * 0.3, 0, foot[2] + side.z * 0.3); g.add(footCr);
      var drift3 = K3.rock({ radius: 0.15, detail: 2, seed: 345, squash: 0.35, flat: false, material: M.snow });
      drift3.position.set(foot[0] - side.x * 0.3, 0.01, foot[2] - side.z * 0.3); g.add(drift3);
      g.add(drift(ctx, R, M.mist, 22, foot[0], foot[2], 0.55, 0.04, 0.55, 0.07));   // cold mist rising
      var fallLight = new THREE.PointLight(col('#8fe3ff'), 0.9, 1.8, 2); fallLight.position.set(foot[0], 0.45, foot[2]); g.add(fallLight);
    }

    /* ===== Level 4: glacier wall at the back + frost lanterns at the front ===== */
    if (level >= 4) {
      // Crescent of leaning ice blocks along the back rim (between the left and back pines),
      // tallest in the middle so it frames the spire without hiding it.
      var NB = 12;
      for (var w = 0; w < NB; w++) {
        var u = w / (NB - 1), ang = (175 + u * 112) * Math.PI / 180;
        var rad = 1.2 + R() * 0.08, h = 0.42 + Math.sin(u * Math.PI) * 0.5 + R() * 0.15, br = 0.15 + R() * 0.06;
        var blk = new THREE.Mesh(new THREE.CylinderGeometry(br * 0.7, br, h, 5), M.glacier);
        blk.position.set(Math.cos(ang) * rad, TOP - 0.08 + h / 2, Math.sin(ang) * rad);
        blk.rotation.set(Math.sin(ang) * -0.12, R() * 3, Math.cos(ang) * 0.12);   // lean slightly outwards
        blk.castShadow = blk.receiveShadow = true; g.add(blk);
        var cap = K3.rock({ radius: br * 0.85, detail: 2, seed: 400 + w, squash: 0.45, flat: false, material: M.snow });
        cap.position.set(blk.position.x, TOP - 0.08 + h - 0.01, blk.position.z); g.add(cap);
      }
      // Frost lanterns at the front corners
      [[1.18, -0.3], [-0.55, 1.1]].forEach(function (p) {
        var ln = frostLantern(); ln.position.set(p[0], TOP - 0.04, p[1]); g.add(ln);
        var ll = new THREE.PointLight(col('#8fe3ff'), 0.7, 1.5, 2); ll.position.set(p[0], TOP + 0.6, p[1]); g.add(ll);
      });
      ctx.anim(function (t) { M.lanternGlow.emissiveIntensity = 2.6 + Math.sin(t * 1.8) * 0.5; });   // gentle pulse
    }

    /* ===== Level 5: crown of ice + snowfall + aurora ===== */
    if (level >= 5) {
      // Ring of crystals orbiting the top of the spire, pointing outwards like a crown
      var crown = new THREE.Group(); crown.position.set(-0.62, TOP + 2.05, -0.58); g.add(crown);
      for (var c = 0; c < 8; c++) {
        var ca = c / 8 * Math.PI * 2, cr = K3.crystal({ height: c % 2 ? 0.26 : 0.36, radius: 0.07, intensity: 0.8 });
        var holder = new THREE.Group(); holder.rotation.y = -ca; crown.add(holder);
        cr.position.x = 0.48; cr.rotation.z = -0.45; holder.add(cr);
      }
      ctx.anim(function (t) { crown.rotation.y = -t * 0.35; crown.position.y = TOP + 2.05 + Math.sin(t * 0.9) * 0.05; });
      var crownLight = new THREE.PointLight(col('#8fe3ff'), 1.2, 3, 2); crownLight.position.set(-0.62, TOP + 2.2, -0.58); g.add(crownLight);
      // Gentle snowfall over the whole habitat
      g.add(drift(ctx, R, M.snowflake, 140, 0, 0, 2.8, TOP, TOP + 2.8, -0.3));
      // Aurora curtain behind the habitat, facing the camera
      var au = aurora(ctx); au.position.set(-1.6, TOP + 1.9, -1.6); au.rotation.y = Math.PI / 4; g.add(au);
    }
    return g;
  }

  HABITATS.register({
    id: 'ice',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: 0.28, y: TOP + 0.05, z: 0.28, r: 0.55 },
    build: build
  });
})();
