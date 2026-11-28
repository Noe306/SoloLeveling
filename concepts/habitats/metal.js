/* ==========================================================================
   habitats/metal.js: Metal Habitat (element 8). Inspiration: metal pillars on
   stone tiles (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): steel colonnade along the BACK, gears at the
   back-right (level 3), the dragon rests on the anvil dais at the FRONT-right.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  floating rock with a tiled stone plaza on top, short steel bollards,
          ore rocks with copper/iron veins, a stack of ingots
     2  + curved colonnade of polished steel pillars with bronze caps and
          rivet bands, tall central pillar (focal point)
     3  + big interlocking gears turning on an iron frame, steam vents puffing
     4  + the dragon's anvil dais: riveted steel plates, glowing heat lines,
          four chain posts linked by hanging chains
     5  + crown: gyroscope rings spinning around the tall pillar, glowing hot
          pillar tops, shower of sparks
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;                                   // plaza height
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (front-right, kept free)
  var TALL = { x: -0.55, z: -0.62 };                // tall central pillar (back-left)
  var GEARS = { x: 0.52, z: -0.62 };                // level-3 gear frame (back-right; legs must stay inside the island)

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#c4c6cc' }),
      cap: K3.mat('stone', { repeat: 2, color: '#9a9ca4' }),
      tile: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, normalMap: K3.tex('stone').normalMap, normalScale: new THREE.Vector2(0.5, 0.5) }),
      steel: K3.mat('metal', { color: '#c4ccd8', roughness: 0.22 }),
      darkSteel: K3.mat('metal', { color: '#5a606c', roughness: 0.4 }),
      bronze: K3.mat('metal', { color: '#d08a40', roughness: 0.3 }),
      copperOre: K3.mat('metal', { color: '#d07a48', roughness: 0.45 }),
      ingot: K3.mat('metal', { color: '#e0b050', roughness: 0.25 }),
      heat: K3.mat('glow', { color: '#ff8a2a', intensity: 2.0 }),
      steam: new THREE.SpriteMaterial({ map: dotTexture(), color: col('#e8ecf2'), transparent: true, opacity: 0.5, depthWrite: false }),
      spark: new THREE.PointsMaterial({ map: dotTexture(), color: col('#ffb24a'), size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
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
  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }

  // Floating rock + plaza: a darker stone cap covered with a grid of instanced square tiles.
  function plaza() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 101, squash: 0.42, lumpy: 0.22, color: '#8a8e98', top: '#6a6e78', topAmount: 0.3, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 15, squash: 0.08, lumpy: 0.05, flat: false, material: M.cap });
    cap.position.y = 0.44; g.add(cap);
    var T = 0.21, tiles = new THREE.BoxGeometry(T * 0.94, 0.03, T * 0.94), shades = ['#9e9a92', '#8c887f', '#aaa69d', '#827e76'];
    var list = [];
    for (var ix = -6; ix <= 6; ix++) for (var iz = -6; iz <= 6; iz++) { var x = ix * T, z = iz * T; if (Math.hypot(x, z) < 1.2) list.push([x, z]); }
    g.add(K3.scatter(tiles, M.tile, list.length, function (i, R) {
      var p = list[i], r = Math.hypot(p[0], p[1]);
      return { x: p[0], y: domeY(r) + 0.035, z: p[1], s: 1, ry: (R() - 0.5) * 0.04, color: shades[Math.floor(R() * 4)] };   // above the cap's bumps
    }, 61));
    return g;
  }

  // Steel pillar: faceted shaft, bronze base + cap, rivet bands. Returns group (userData.top = cap height).
  function pillar(h, r) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.5, 0.08, 8), M.bronze); base.position.y = 0.04; base.castShadow = true; g.add(base);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 8), M.steel); shaft.position.y = h / 2 + 0.08; shaft.castShadow = shaft.receiveShadow = true; g.add(shaft);
    [0.3, 0.65].forEach(function (k) {
      var band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.04, 8), M.darkSteel); band.position.y = 0.08 + h * k; g.add(band);
      for (var i = 0; i < 8; i++) {                                           // rivets
        var a = i / 8 * Math.PI * 2 + Math.PI / 8, rv = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 4), M.bronze);
        rv.position.set(Math.cos(a) * r * 1.13, 0.08 + h * k, Math.sin(a) * r * 1.13); g.add(rv);
      }
    });
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.15, 0.09, 8), M.bronze); cap.position.y = h + 0.12; cap.castShadow = true; g.add(cap);
    g.userData.top = h + 0.17;
    return g;
  }

  // Gear: toothed disc with spokes and a hub (extruded shape).
  function gear(rOut, teeth, depth, mat) {
    var s = new THREE.Shape(), rIn = rOut * 0.84, n = teeth * 4;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2, rr = (i % 4 === 1 || i % 4 === 2) ? rOut : rIn;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    var holes = 5;
    for (var h = 0; h < holes; h++) {                                         // lightening holes between spokes
      var ha = (h + 0.5) / holes * Math.PI * 2, hc = rOut * 0.5, hole = new THREE.Path();
      hole.absarc(Math.cos(ha) * hc, Math.sin(ha) * hc, rOut * 0.2, 0, Math.PI * 2, true); s.holes.push(hole);
    }
    var geo = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: depth * 0.15, bevelSegments: 1, curveSegments: 6 });
    geo.translate(0, 0, -depth / 2);
    var g = new THREE.Group(), m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(rOut * 0.16, rOut * 0.16, depth * 1.8, 12), M.darkSteel); hub.rotation.x = Math.PI / 2; g.add(hub);
    return g;
  }

  function steamVent(ctx, x, z, phase) {
    var g = new THREE.Group(); g.position.set(x, domeY(Math.hypot(x, z)), z);
    var grate = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 10), M.darkSteel); grate.position.y = 0.02; g.add(grate);
    var puffs = [];
    for (var i = 0; i < 5; i++) { var sp = new THREE.Sprite(M.steam.clone()); g.add(sp); puffs.push(sp); }
    ctx.anim(function (t) {
      puffs.forEach(function (s, i) {
        var k = (t * 0.4 + i / puffs.length + phase) % 1;
        s.position.set(Math.sin(i * 2 + t) * 0.03, 0.05 + k * 0.7, k * 0.12); s.scale.setScalar(0.06 + k * 0.22); s.material.opacity = 0.5 * (1 - k) * Math.min(1, k * 5);
      });
    });
    return g;
  }

  function sparkShower(ctx, R, n, cx, cz, y0) {
    var pos = new Float32Array(n * 3), vel = [];
    function reset(q) { pos[q * 3] = cx; pos[q * 3 + 1] = y0; pos[q * 3 + 2] = cz; vel[q] = new V((R() - 0.5) * 0.6, 0.3 + R() * 0.5, (R() - 0.5) * 0.6); }
    for (var i = 0; i < n; i++) { reset(i); pos[i * 3 + 1] -= R() * 0.5; }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        vel[q].y -= dt * 1.4;                                                // gravity
        pos[q * 3] += vel[q].x * dt; pos[q * 3 + 1] += vel[q].y * dt; pos[q * 3 + 2] += vel[q].z * dt;
        if (pos[q * 3 + 1] < TOP) reset(q);
      }
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, M.spark);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(37), g = new THREE.Group();
    g.add(plaza());
    var Y = function (x, z) { return domeY(Math.hypot(x, z)) + 0.02; };

    /* ===== Level 1 ===== */
    [[1.05, -0.15], [0.05, 1.05], [-1.0, 0.45], [1.0, 0.65]].forEach(function (p) {      // bollards
      var b = new THREE.Group(); b.position.set(p[0], Y(p[0], p[1]), p[1]); g.add(b);
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), M.steel); post.position.y = 0.1; post.castShadow = true; b.add(post);
      var top = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.bronze); top.position.y = 0.2; b.add(top);
    });
    [[0.75, -0.95, 0.16, 1, M.copperOre], [-1.1, -0.2, 0.18, 2, M.darkSteel], [-0.25, 1.08, 0.13, 3, M.copperOre]].forEach(function (o) {   // ore rocks
      var rk = K3.rock({ radius: o[2], detail: 3, seed: 70 + o[3], squash: 0.75, color: '#7a7e88', top: '#9a9ea8', topAmount: 0.3, material: M.rock });
      rk.position.set(o[0], Y(o[0], o[1]), o[1]); g.add(rk);
      for (var k = 0; k < 4; k++) {                                          // metal nuggets poking out
        var n = new THREE.Mesh(new THREE.DodecahedronGeometry(o[2] * 0.25, 0), o[4]), a = k * 1.7;
        n.position.set(o[0] + Math.cos(a) * o[2] * 0.75, Y(o[0], o[1]) + o[2] * 0.45, o[1] + Math.sin(a) * o[2] * 0.75); g.add(n);
      }
    });
    var ing = new THREE.Group(); ing.position.set(1.08, Y(1.08, 0.25), 0.25); ing.rotation.y = 0.4; g.add(ing);   // ingot stack
    [[0, 0, 0], [0.09, 0, 0], [0.045, 0.045, 0]].forEach(function (p) {
      var bar = K3.roundedBox(0.08, 0.04, 0.16, 0.01, M.ingot); bar.position.set(p[0], p[1] + 0.02, p[2]); ing.add(bar);
    });

    /* ===== Level 2: steel colonnade ===== */
    var tops = [];
    if (level >= 2) {
      var tall = pillar(1.7, 0.13); tall.position.set(TALL.x, Y(TALL.x, TALL.z), TALL.z); g.add(tall);
      tops.push(new V(TALL.x, tall.position.y + tall.userData.top, TALL.z));
      // Curved row of shorter pillars along the back rim (angles around the island centre)
      [150, 180, 245, 275, 300].forEach(function (deg, i) {
        var a = deg * Math.PI / 180, r = 1.08, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.hypot(x - TALL.x, z - TALL.z) < 0.3) return;
        var h = 0.75 + (i % 2) * 0.3, p = pillar(h, 0.09); p.position.set(x, Y(x, z), z); g.add(p);
        tops.push(new V(x, p.position.y + p.userData.top, z));
      });
      var shine = new THREE.PointLight(col('#dfe8ff'), 0.6, 3, 2); shine.position.set(TALL.x + 0.4, TOP + 1.4, TALL.z + 0.4); g.add(shine);
    }

    /* ===== Level 3: gears + steam ===== */
    if (level >= 3) {
      // Frame standing on the plaza (both legs inside the island), facing the camera: two legs on
      // foot plates, top beam + bottom crossbar, a riveted back plate, and an axle for every gear.
      var frame = new THREE.Group(); frame.position.set(GEARS.x, Y(GEARS.x, GEARS.z) - 0.02, GEARS.z); frame.rotation.y = Math.PI / 4; g.add(frame);
      [-0.42, 0.42].forEach(function (x) {
        var leg = K3.roundedBox(0.07, 1.02, 0.07, 0.015, M.darkSteel); leg.position.set(x, 0.51, -0.1); frame.add(leg);
        var foot = K3.roundedBox(0.16, 0.03, 0.16, 0.01, M.darkSteel); foot.position.set(x, 0.015, -0.1); frame.add(foot);
      });
      var beam = K3.roundedBox(0.95, 0.07, 0.07, 0.015, M.darkSteel); beam.position.set(0, 0.99, -0.1); frame.add(beam);
      var low = K3.roundedBox(0.9, 0.05, 0.05, 0.012, M.darkSteel); low.position.set(0, 0.12, -0.1); frame.add(low);
      var plate = K3.roundedBox(0.8, 0.84, 0.025, 0.01, M.darkSteel); plate.position.set(0, 0.55, -0.12); frame.add(plate);
      [[-0.36, 0.17], [0.36, 0.17], [-0.36, 0.93], [0.36, 0.93]].forEach(function (p) {
        var rv = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.bronze); rv.position.set(p[0], p[1], -0.105); frame.add(rv);
      });
      var g1 = gear(0.3, 12, 0.06, M.bronze); g1.position.set(-0.12, 0.55, 0); frame.add(g1);
      var g2 = gear(0.19, 8, 0.06, M.steel); g2.position.set(0.3, 0.78, 0.01); frame.add(g2);     // meshes with g1 (centres ~0.47 apart)
      var g3 = gear(0.13, 6, 0.05, M.darkSteel); g3.position.set(0.3, 0.33, 0.0); frame.add(g3);
      [g1, g2, g3].forEach(function (gr) {                                     // axle from each hub into the back plate
        var ax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), M.steel); ax.rotation.x = Math.PI / 2; ax.position.set(gr.position.x, gr.position.y, -0.06); frame.add(ax);
      });
      ctx.anim(function (t) { g1.rotation.z = t * 0.5; g2.rotation.z = -t * 0.5 * 12 / 8 + 0.2; g3.rotation.z = -t * 0.5 * 12 / 6 + 0.1; });
      g.add(steamVent(ctx, 0.42, -1.05, 0)); g.add(steamVent(ctx, -1.05, 0.12, 0.5));
    }

    /* ===== Level 4: the anvil dais ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var dais = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.05, 0.1, 8), M.steel);
      dais.position.set(SPOT.x, y0 + 0.03, SPOT.z); dais.rotation.y = Math.PI / 8; dais.castShadow = dais.receiveShadow = true; g.add(dais);
      // Plate seams glowing with heat + rivets along the rim
      for (var s = 0; s < 4; s++) {
        var seam = new THREE.Mesh(new THREE.BoxGeometry(SPOT.r * 1.85, 0.008, 0.016), M.heat);
        seam.position.set(SPOT.x, y0 + 0.083, SPOT.z); seam.rotation.y = s * Math.PI / 4; g.add(seam);
      }
      var hring = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r * 0.45, 0.01, 4, 8), M.heat); hring.rotation.x = Math.PI / 2; hring.rotation.z = Math.PI / 8; hring.position.set(SPOT.x, y0 + 0.083, SPOT.z); g.add(hring);
      for (var rv = 0; rv < 16; rv++) {
        var ra = rv / 16 * Math.PI * 2, rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.bronze);
        rivet.position.set(SPOT.x + Math.cos(ra) * SPOT.r * 0.9, y0 + 0.085, SPOT.z + Math.sin(ra) * SPOT.r * 0.9); g.add(rivet);
      }
      ctx.anim(function (t) { M.heat.emissiveIntensity = 1.8 + Math.sin(t * 1.5) * 0.5; });
      // Four chain posts linked by sagging chains
      var posts = [45, 135, 225, 315].map(function (deg) {
        var a = deg * Math.PI / 180, x = SPOT.x + Math.cos(a) * (SPOT.r + 0.17), z = SPOT.z + Math.sin(a) * (SPOT.r + 0.17), py = Y(x, z);
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8), M.darkSteel); post.position.set(x, py + 0.16, z); post.castShadow = true; g.add(post);
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.bronze); knob.position.set(x, py + 0.34, z); g.add(knob);
        return new V(x, py + 0.28, z);
      });
      for (var c = 0; c < 4; c++) {
        var a1 = posts[c], b1 = posts[(c + 1) % 4];
        g.add(K3.chain([a1.x, a1.y, a1.z], [b1.x, b1.y, b1.z], 0.12, 0.022, M.darkSteel));
      }
      var heatL = new THREE.PointLight(col('#ff8a3a'), 0.6, 1.5, 2); heatL.position.set(SPOT.x, y0 + 0.3, SPOT.z); g.add(heatL);
    }

    /* ===== Level 5: gyroscope crown + hot tops + sparks ===== */
    if (level >= 5) {
      var gyro = new THREE.Group(); gyro.position.copy(tops[0]).add(new V(0, -0.45, 0)); g.add(gyro);
      var rings = [];
      [[0.42, M.bronze], [0.34, M.steel], [0.26, M.bronze]].forEach(function (rr, i) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(rr[0], 0.018, 8, 48), rr[1]); ring.castShadow = true; gyro.add(ring); rings.push(ring);
      });
      ctx.anim(function (t) {
        rings[0].rotation.set(t * 0.6, 0, 0.3); rings[1].rotation.set(0, t * 0.9, t * 0.4); rings[2].rotation.set(t * 1.2, t * 0.5, 0);
      });
      var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), M.heat); core.position.copy(gyro.position); g.add(core);
      tops.forEach(function (tp, i) {                                          // glowing hot discs on every pillar top
        var hot = new THREE.Mesh(new THREE.CylinderGeometry(i === 0 ? 0.15 : 0.1, i === 0 ? 0.15 : 0.1, 0.012, 8), M.heat); hot.position.copy(tp).add(new V(0, -0.005, 0)); g.add(hot);
      });
      g.add(sparkShower(ctx, R, 40, tops[0].x, tops[0].z, tops[0].y));
      var crownL = new THREE.PointLight(col('#ffb04a'), 1.2, 3, 2); crownL.position.copy(gyro.position); g.add(crownL);
    }
    return g;
  }

  HABITATS.register({
    id: 'metal',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP + 0.09, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
