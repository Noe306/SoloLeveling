/* ==========================================================================
   habitats/electric.js: Electric Habitat (element 6). Inspiration: yellow
   crystal spikes on sand (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): citrine crystal spire at the BACK-left, the
   dragon rests on the sand at the FRONT-right (kept free).

   Levels designed: 1-5 (each level = previous level + new layer)
     1  floating slate island with glowing yellow cracks, pale golden sand top,
          small yellow crystal clusters, dark rocks, fulgurite (lightning glass),
          tiny sparks
     2  + big citrine crystal spire (focal point) with lightning arcs crackling
          between its tips, rim crystals, charged glow
     3  + two conductor pylons (obelisks with copper coils + crystal tips) with a
          big lightning arc jumping between them every few seconds
     4  + the dragon's charging pad: dark disc, copper ring, glowing circuit lines,
          four crystal posts arcing sparks towards the centre
     5  + storm crown: a small storm cloud above the spire striking it with
          lightning (flash), charged orbs orbiting the spire
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;                                   // sand surface height
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (front-right, kept free)
  var SPIRE = { x: -0.6, z: -0.55 };                // crystal spire (back-left)
  var PYLONS = [[0.72, -0.98], [-1.08, 0.22]];      // level-3 conductor pylons

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      slate: K3.mat('lava', { repeat: 1, color: '#9aa0b4', emissive: '#ffd23a', intensity: 1.2, normalScale: 1.1 }),   // dark rock, glowing cracks
      sand: K3.mat('sand', { repeat: 2, color: '#f6e2a8' }),
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#e2e4f0' }),
      glass: new THREE.MeshPhysicalMaterial({ color: col('#e8d6a8'), roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.85, envMapIntensity: 0.8 }),
      pylon: K3.mat('stone', { flat: true, repeat: 1, color: '#6a6e80' }),
      copper: K3.mat('metal', { color: '#d0844a', roughness: 0.35 }),
      pad: K3.mat('stone', { repeat: 1, color: '#4a4e5e' }),
      circuit: K3.mat('glow', { color: '#ffe066', intensity: 2.2 }),
      bolt: new THREE.MeshBasicMaterial({ color: col('#fff6c0'), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      boltGlow: new THREE.MeshBasicMaterial({ color: col('#ffd84a'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      cloud: new THREE.MeshStandardMaterial({ color: col('#565c70'), roughness: 1, flatShading: true }),
      orb: K3.mat('glow', { color: '#fff07a', intensity: 2.4 }),
      spark: new THREE.PointsMaterial({ map: dotTexture(), color: col('#fff3a0'), size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
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

  // Floating slate island with glowing yellow cracks + sand top.
  function slatePlateau() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 81, squash: 0.42, lumpy: 0.24, material: M.slate });
    under.scale.set(1, 0.85, 1); under.position.y = 0.0; g.add(under);      // kept low: its lumps must not poke through the sand
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 12, squash: 0.08, lumpy: 0.07, flat: false, material: M.sand });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Citrine crystal cluster (yellow, glowing core). Low env reflection so it stays golden, not white.
  function citrine(opts) {
    var c = K3.crystalCluster(Object.assign({ color: '#ffbf10', emissive: '#ff9400', intensity: 0.45 }, opts));
    c.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.3; o.material.opacity = 0.94; } });
    return c;
  }

  // Lightning bolt made of thin glowing segments; zap(a, b, jitter) re-shapes it along a jagged path.
  function bolt(n, r) {
    var g = new THREE.Group(), segs = [], up = new V(0, 1, 0);
    var core = new THREE.CylinderGeometry(r, r, 1, 4, 1, true), halo = new THREE.CylinderGeometry(r * 3, r * 3, 1, 6, 1, true);
    for (var i = 0; i < n; i++) {
      var s = new THREE.Mesh(core, M.bolt), h = new THREE.Mesh(halo, M.boltGlow); s.add(h); g.add(s); segs.push(s);
    }
    // bow: lifts the middle of the path (arcs between pylons bend upwards)
    g.zap = function (a, b, jitter, R, bow) {
      var prev = a.clone(), dir = new V();
      for (var i = 0; i < n; i++) {
        var t = (i + 1) / n, p = a.clone().lerp(b, t);
        p.y += Math.sin(t * Math.PI) * (bow || 0);
        if (i < n - 1) p.add(new V((R() - 0.5) * jitter, (R() - 0.5) * jitter, (R() - 0.5) * jitter));
        dir.subVectors(p, prev); var len = dir.length();
        segs[i].position.copy(prev).addScaledVector(dir, 0.5);
        segs[i].quaternion.setFromUnitVectors(up, dir.normalize()); segs[i].scale.set(1, len, 1);
        prev = p;
      }
    };
    return g;
  }

  // Fulgurite: branching glass tube sculpture (sand fused by lightning).
  function fulgurite(R, h) {
    var g = new THREE.Group();
    g.add(K3.tube([[0, 0, 0], [0.02, h * 0.4, 0.01], [-0.02, h * 0.75, 0], [0.01, h, 0.02]], [0.035, 0.008], M.glass, 12));
    for (var b = 0; b < 3; b++) {
      var y = h * (0.25 + b * 0.22), a = b * 2.1 + R(), l = h * 0.35;
      g.add(K3.tube([[0, y, 0], [Math.cos(a) * l * 0.5, y + l * 0.35, Math.sin(a) * l * 0.5], [Math.cos(a) * l, y + l * 0.5, Math.sin(a) * l]], [0.018, 0.004], M.glass, 8));
    }
    return g;
  }

  // Conductor pylon: dark obelisk with copper coil rings and a crystal on top. Returns { group, tip }.
  function pylon(h) {
    var g = new THREE.Group();
    var base = K3.roundedBox(0.26, 0.1, 0.26, 0.02, M.pylon); base.position.y = 0.05; g.add(base);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 6), M.pylon); shaft.position.y = h / 2 + 0.08; shaft.castShadow = true; g.add(shaft);
    for (var i = 0; i < 4; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 - i * 0.008, 0.016, 6, 18), M.copper); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3 + i * 0.13; g.add(ring);
    }
    var cr = citrine({ count: 3, height: 0.3, radius: 0.06, seed: 9, spread: 0.04 }); cr.position.y = h + 0.06; g.add(cr);
    return { group: g, tip: new V(0, h + 0.36, 0) };
  }

  function sparks(ctx, R, n, cx, cz, spread, y0, y1) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) { seed.push(R() * 6.28); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t) {
      for (var q = 0; q < n; q++) {                                        // sparks blink in and out at random spots
        var k = Math.floor(t * 3 + seed[q] * 3), r1 = Math.sin(k * 12.9898 + q * 78.233) * 43758.5453, r2 = Math.sin(k * 39.346 + q * 11.135) * 24634.6345;
        r1 -= Math.floor(r1); r2 -= Math.floor(r2);
        pos[q * 3] = cx + (r1 - 0.5) * spread; pos[q * 3 + 1] = y0 + ((t * 0.5 + seed[q]) % 1) * (y1 - y0); pos[q * 3 + 2] = cz + (r2 - 0.5) * spread;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, M.spark);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(23), g = new THREE.Group();
    g.add(slatePlateau());

    /* ===== Level 1 ===== */
    [[0.95, -0.45, 0.42, 1], [-1.05, 0.5, 0.38, 2], [0.15, 1.05, 0.32, 3], [-0.35, -1.05, 0.36, 4]].forEach(function (c) {
      var cl = citrine({ count: 4, height: c[2], radius: 0.06, seed: 40 + c[3], spread: 0.08 }); cl.position.set(c[0], TOP - 0.03, c[1]); g.add(cl);
    });
    [[1.1, 0.2, 0.17, 1], [-1.12, -0.25, 0.2, 2], [0.62, 1.02, 0.12, 3]].forEach(function (p) {
      var rk = K3.rock({ radius: p[2], detail: 3, seed: 60 + p[3], squash: 0.75, color: '#7c8296', top: '#a2a8ba', topAmount: 0.3, material: M.rock });
      rk.position.set(p[0], TOP + 0.02, p[1]); g.add(rk);
    });
    [[0.82, 0.85, 0.22], [-0.72, 0.95, 0.18]].forEach(function (p) { var f = fulgurite(R, p[2]); f.position.set(p[0], TOP - 0.03, p[1]); g.add(f); });
    g.add(sparks(ctx, R, 18, 0, 0, 2.2, TOP + 0.02, TOP + 0.35));

    /* ===== Level 2: the citrine spire + crackling arcs ===== */
    if (level >= 2) {
      var base = K3.rock({ radius: 0.42, detail: 4, seed: 77, squash: 0.7, lumpy: 0.3, color: '#7c8296', top: '#a2a8ba', topAmount: 0.3, material: M.rock });
      base.position.set(SPIRE.x, TOP + 0.05, SPIRE.z); g.add(base);
      var spire = citrine({ count: 8, height: 1.7, radius: 0.18, seed: 21, spread: 0.3, intensity: 0.55 });
      spire.position.set(SPIRE.x, TOP + 0.2, SPIRE.z); g.add(spire);
      [[1.05, 0.0], [0.45, -1.0], [-0.15, 1.12], [1.12, 0.62]].forEach(function (c, i) {
        var rc = citrine({ count: 3, height: 0.3, radius: 0.05, seed: 30 + i, spread: 0.06 }); rc.position.set(c[0], TOP - 0.03, c[1]); g.add(rc);
      });
      // Two small arcs crackling between the spire's crystals (re-shaped ~12 times a second)
      var arcs = [bolt(6, 0.01), bolt(6, 0.01)]; arcs.forEach(function (a) { g.add(a); });
      var sx = SPIRE.x, sz = SPIRE.z, ends = [[new V(sx - 0.2, TOP + 0.75, sz + 0.1), new V(sx + 0.05, TOP + 1.45, sz)], [new V(sx + 0.22, TOP + 0.65, sz - 0.08), new V(sx, TOP + 1.2, sz + 0.05)]];
      var AR = K3.rng(5), lastA = -1;
      ctx.anim(function (t) {
        var k = Math.floor(t * 12); if (k === lastA) return; lastA = k;
        arcs.forEach(function (a, i) { a.visible = AR() > 0.25; a.zap(ends[i][0], ends[i][1], 0.12, AR); });
      });
      var charge = new THREE.PointLight(col('#ffe066'), 1.6, 3.5, 2); charge.position.set(SPIRE.x, TOP + 1.1, SPIRE.z); g.add(charge);
      ctx.anim(function (t) { charge.intensity = 1.5 + Math.random() * 0.4; });
    }

    /* ===== Level 3: conductor pylons + big arc ===== */
    if (level >= 3) {
      var tips = PYLONS.map(function (p, i) {
        var py = pylon(0.85 + i * 0.1); py.group.position.set(p[0], TOP - 0.04, p[1]); g.add(py.group);
        return py.tip.clone().add(py.group.position);
      });
      var big = bolt(14, 0.018); g.add(big);
      var BR = K3.rng(11), lastB = -1, flashL = new THREE.PointLight(col('#fff3a0'), 0, 4, 2);
      flashL.position.copy(tips[0]).lerp(tips[1], 0.5); g.add(flashL);
      ctx.anim(function (t) {
        var cyc = t % 3.2, on = cyc < 0.9;                                    // arc for ~1 s every 3.2 s
        big.visible = on; flashL.intensity = on ? 1.5 + BR() : 0;
        var k = Math.floor(t * 14); if (!on || k === lastB) return; lastB = k;
        big.zap(tips[0], tips[1], 0.18, BR, 0.35);                           // bows upward over the sand
      });
      g.add(sparks(ctx, R, 14, PYLONS[0][0], PYLONS[0][1], 0.4, TOP, TOP + 1.1));
      g.add(sparks(ctx, R, 14, PYLONS[1][0], PYLONS[1][1], 0.4, TOP, TOP + 1.1));
    }

    /* ===== Level 4: the dragon's charging pad ===== */
    if (level >= 4) {
      var pad = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.03, 0.06, 48), M.pad);
      pad.position.set(SPOT.x, TOP, SPOT.z); pad.receiveShadow = pad.castShadow = true; g.add(pad);
      var ringC = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.01, 0.022, 8, 64), M.copper); ringC.rotation.x = Math.PI / 2; ringC.position.set(SPOT.x, TOP + 0.03, SPOT.z); g.add(ringC);
      // Circuit lines: a hexagon + spokes + nodes, glowing
      var hex = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r * 0.55, 0.008, 4, 6), M.circuit); hex.rotation.x = Math.PI / 2; hex.position.set(SPOT.x, TOP + 0.032, SPOT.z); g.add(hex);
      for (var s = 0; s < 6; s++) {
        var a = s / 6 * Math.PI * 2, r0 = SPOT.r * 0.55, r1 = SPOT.r * 0.92;
        var line = new THREE.Mesh(new THREE.BoxGeometry(r1 - r0, 0.006, 0.014), M.circuit);
        line.position.set(SPOT.x + Math.cos(a) * (r0 + r1) / 2, TOP + 0.032, SPOT.z + Math.sin(a) * (r0 + r1) / 2); line.rotation.y = -a; g.add(line);
        var node = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 10), M.circuit); node.position.set(SPOT.x + Math.cos(a) * r1, TOP + 0.034, SPOT.z + Math.sin(a) * r1); g.add(node);
      }
      ctx.anim(function (t) { M.circuit.emissiveIntensity = 2.0 + Math.sin(t * 3) * 0.6; });
      // Four crystal posts arcing small sparks towards the centre now and then
      var posts = [], small = [];
      [45, 135, 225, 315].forEach(function (deg, i) {
        var pa = deg * Math.PI / 180, px = SPOT.x + Math.cos(pa) * (SPOT.r + 0.16), pz = SPOT.z + Math.sin(pa) * (SPOT.r + 0.16);
        var pc = citrine({ count: 2, height: 0.26, radius: 0.045, seed: 70 + i, spread: 0.03 }); pc.position.set(px, TOP - 0.02, pz); g.add(pc);
        posts.push(new V(px, TOP + 0.26, pz));
        var sb = bolt(5, 0.004); g.add(sb); small.push(sb);
      });
      var SR = K3.rng(17), lastS = -1;
      ctx.anim(function (t) {
        var k = Math.floor(t * 10); if (k === lastS) return; lastS = k;
        small.forEach(function (b, i) {
          b.visible = ((k + i * 3) % 9) < 2;
          if (b.visible) b.zap(posts[i], new V(SPOT.x, TOP + 0.15, SPOT.z).lerp(posts[i], 0.45), 0.08, SR);
        });
      });
    }

    /* ===== Level 5: storm crown ===== */
    if (level >= 5) {
      var cloud = new THREE.Group(); cloud.position.set(SPIRE.x + 0.05, TOP + 2.45, SPIRE.z); g.add(cloud);
      [[0, 0, 0, 0.32], [0.3, -0.04, 0.05, 0.24], [-0.28, -0.03, -0.04, 0.26], [0.08, 0.12, -0.12, 0.22], [-0.1, -0.02, 0.22, 0.2]].forEach(function (c, i) {
        var puff = K3.rock({ radius: c[3], detail: 2, seed: 900 + i, squash: 0.6, lumpy: 0.25, flat: true, material: M.cloud });
        puff.castShadow = false; puff.position.set(c[0], c[1], c[2]); cloud.add(puff);
      });
      ctx.anim(function (t) { cloud.position.y = TOP + 2.45 + Math.sin(t * 0.6) * 0.04; cloud.rotation.y = t * 0.05; });
      var strike = bolt(12, 0.02); g.add(strike);
      var flash = new THREE.PointLight(col('#fff6c0'), 0, 5, 2); flash.position.set(SPIRE.x, TOP + 2.0, SPIRE.z); g.add(flash);
      var KR = K3.rng(29), lastK = -1;
      ctx.anim(function (t) {
        var cyc = (t + 1.3) % 2.6, on = cyc < 0.25;                          // quick strike every 2.6 s
        strike.visible = on; flash.intensity = on ? 3.5 * (1 - cyc / 0.25) : 0;
        var k = Math.floor(t * 16); if (!on || k === lastK) return; lastK = k;
        strike.zap(new V(SPIRE.x + 0.05, TOP + 2.3, SPIRE.z), new V(SPIRE.x, TOP + 1.9, SPIRE.z), 0.2, KR);
      });
      // Charged orbs orbiting the spire
      var orbit = new THREE.Group(); orbit.position.set(SPIRE.x, TOP + 1.2, SPIRE.z); g.add(orbit);
      for (var o = 0; o < 5; o++) {
        var oa = o / 5 * Math.PI * 2, orb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.orb);
        orb.position.set(Math.cos(oa) * 0.6, Math.sin(o * 2.2) * 0.15, Math.sin(oa) * 0.6); orbit.add(orb);
      }
      ctx.anim(function (t) { orbit.rotation.y = t * 0.8; });
      g.add(sparks(ctx, R, 30, SPIRE.x, SPIRE.z, 1.4, TOP + 0.5, TOP + 2.2));
    }
    return g;
  }

  HABITATS.register({
    id: 'electric',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP + 0.03, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
