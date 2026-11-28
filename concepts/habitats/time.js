/* ==========================================================================
   habitats/time.js: Time Habitat (element 15). Inspiration: floating rock on
   chains over a starry pool (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): starry pool with the chained floating rock at
   the BACK-left, the dragon rests on the clock-face dais at the FRONT-right.
   Palette: warm sandstone, brass and gold, night-sky blue.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  sandstone island with a brass rim, a starry pool (night sky with twinkling
          stars), a sundial, twelve numeral stones around the rim
     2  + floating rock (focal point) above the pool, chained to four anchor posts,
          a small ruined temple on top
     3  + giant golden clock ring floating behind the rock, hands turning
     4  + clock-face dais with turning hands, two hourglasses with falling sand
     5  + armillary rings spinning around the rock, a pendulum swinging below it,
          stars falling into the pool
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var POOL = { x: -0.38, z: -0.42, r: 0.45 };
  var ROCK_Y = TOP + 1.05;
  var FACE = new V(1, 0, 1).normalize();

  var M = null;
  function mats() {
    if (M) return M;
    var st = K3.tex('stone'), dot = dotTexture();
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#ece0c8' }),
      ground: K3.mat('sand', { repeat: 2, color: '#eadcbc' }),
      stone: new THREE.MeshStandardMaterial({ color: col('#e6dac0'), roughness: 0.6, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.45 }),
      brass: K3.mat('metal', { color: '#d4a04a', roughness: 0.3 }),
      gold: K3.mat('metal', { color: '#f0c050', roughness: 0.2 }),
      dark: K3.mat('metal', { color: '#5a4a3a', roughness: 0.45 }),
      glow: K3.mat('glow', { color: '#ffe08a', intensity: 2.0 }),
      glass: new THREE.MeshPhysicalMaterial({ color: col('#e8f4ff'), roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.35, envMapIntensity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      sand: new THREE.MeshStandardMaterial({ color: col('#f0c870'), roughness: 0.9 }),
      star: new THREE.PointsMaterial({ map: dot, color: col('#fff4c8'), size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    M.sky = starfield('#0a1030', '#3a2a7a', '#1a4a8a', 70);
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  }

  // Night-sky material: dark base + soft nebula bands + twinkling stars, from world position.
  function starfield(base, neb1, neb2, density) {
    var m = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c0: { value: col(base) }, c1: { value: col(neb1) }, c2: { value: col(neb2) }, dens: { value: density } },
      vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'varying vec3 vP; uniform float t; uniform vec3 c0, c1, c2; uniform float dens;\n' +
        'float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' +
        'void main(){\n' +
        '  float n1 = 0.5 + 0.5 * sin(vP.x * 3.1 + sin(vP.z * 2.3 + t * 0.15) * 2.0) * sin(vP.y * 4.0 + vP.z * 2.7);\n' +
        '  float n2 = 0.5 + 0.5 * sin(vP.z * 2.6 - vP.x * 1.7 + t * 0.1);\n' +
        '  vec3 c = c0 + c1 * n1 * 0.6 + c2 * n2 * 0.45;\n' +
        '  vec3 cell = floor(vP * dens); float s = h(cell);\n' +
        '  vec3 f = fract(vP * dens) - 0.5; float d = length(f);\n' +
        '  float star = step(0.975, s) * smoothstep(0.45, 0.1, d) * (0.55 + 0.45 * sin(t * 3.0 + s * 60.0));\n' +
        '  gl_FragColor = vec4(c + vec3(1.0, 0.95, 0.85) * star * 1.4, 1.0); }'
    });
    m.userData.tick = function (t) { m.uniforms.t.value = t; };
    return m;
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
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 181, squash: 0.42, lumpy: 0.2, color: '#c8b896', top: '#e0d2b0', topAmount: 0.3, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 22, squash: 0.08, lumpy: 0.05, flat: false, material: M.ground });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.022, 6, 96), M.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.47; g.add(rim);
    return g;
  }

  // Floating rock with a pointed underside + a small ruined temple on top.
  function floatingRock() {
    var g = new THREE.Group();
    var r = K3.rock({ radius: 0.36, detail: 4, seed: 191, squash: 0.6, lumpy: 0.3, color: '#c8b896', top: '#e8dcbc', topAmount: 0.45, material: M.rock });
    var p = r.geometry.attributes.position;
    for (var i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 2.2);
    r.geometry.computeVertexNormals(); g.add(r);
    var floor = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.04, 16), M.stone); floor.position.y = 0.2; g.add(floor);
    [[0.17, 0.25], [-0.17, 0.15], [0.17, -0.2], [-0.17, -0.25]].forEach(function (c, i) {
      var h = i === 2 ? 0.16 : 0.3, colm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 10), M.stone);
      colm.position.set(c[0], 0.22 + h / 2, c[1] * 0.8); g.add(colm);
    });
    var lintel = K3.roundedBox(0.42, 0.05, 0.12, 0.01, M.stone); lintel.position.set(0, 0.55, 0.12); g.add(lintel);
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), M.glow); orb.position.set(0, 0.32, 0); g.add(orb);
    return g;
  }

  // Clock face (flat): ring + 12 hour marks + two hands (returned for animation).
  function clockFace(r, mat, markMat) {
    var g = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.05, 8, 64), mat); g.add(ring);
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2, mk = new THREE.Mesh(new THREE.BoxGeometry(r * (i % 3 ? 0.04 : 0.07), r * (i % 3 ? 0.12 : 0.2), r * 0.03), markMat);
      mk.position.set(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84, 0); mk.rotation.z = a - Math.PI / 2; g.add(mk);
    }
    var hour = new THREE.Group(), minute = new THREE.Group(); g.add(hour); g.add(minute);
    var hh = new THREE.Mesh(new THREE.BoxGeometry(r * 0.07, r * 0.5, r * 0.03), mat); hh.position.y = r * 0.25; hour.add(hh);
    var mh = new THREE.Mesh(new THREE.BoxGeometry(r * 0.045, r * 0.75, r * 0.03), mat); mh.position.y = r * 0.37; mh.position.z = r * 0.02; minute.add(mh);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.07, r * 0.06, 16), mat); hub.rotation.x = Math.PI / 2; g.add(hub);
    g.userData = { hour: hour, minute: minute };
    return g;
  }

  // Hourglass: brass frame, two glass bulbs, sand draining from top to bottom (loops).
  function hourglass(ctx, h, phase) {
    var g = new THREE.Group(), w = h * 0.3;
    [0, h].forEach(function (y) { var plate = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.25, w * 1.25, 0.025, 12), M.brass); plate.position.y = y; g.add(plate); });
    for (var i = 0; i < 3; i++) { var a = i / 3 * Math.PI * 2, post = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, h, 6), M.brass); post.position.set(Math.cos(a) * w * 1.1, h / 2, Math.sin(a) * w * 1.1); g.add(post); }
    var prof = [];
    for (var k = 0; k <= 16; k++) { var u = k / 16, rr = w * (0.12 + 0.88 * Math.pow(Math.abs(Math.cos(u * Math.PI)), 0.6)); prof.push(new THREE.Vector2(rr, 0.015 + u * (h - 0.03))); }
    var glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), M.glass); g.add(glass);
    var top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, h * 0.3, 16), M.sand); top.rotation.x = Math.PI; g.add(top);
    var bottom = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, h * 0.3, 16), M.sand); g.add(bottom);
    var stream = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, h * 0.45, 4), M.sand); stream.position.y = h * 0.3; g.add(stream);
    ctx.anim(function (t) {
      var k = ((t * 0.08 + phase) % 1);
      top.scale.setScalar(Math.max(0.01, 1 - k)); top.position.y = h * 0.62 + (1 - k) * h * 0.12;
      bottom.scale.setScalar(Math.max(0.01, k)); bottom.position.y = 0.02 + k * h * 0.15;
    });
    return g;
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(67), g = new THREE.Group();
    g.add(island());
    ctx.anim(M.sky.userData.tick);

    /* ===== Level 1 ===== */
    // Pool height = the HIGHEST ground under it (the domed top rises towards the island centre and
    // poked through the water's front edge), + a margin for the ground's small bumps.
    var py = Y(0, Math.max(0, Math.hypot(POOL.x, POOL.z) - POOL.r)) + 0.02;
    var basin = new THREE.Mesh(new THREE.TorusGeometry(POOL.r, 0.045, 8, 48), M.stone); basin.rotation.x = Math.PI / 2; basin.position.set(POOL.x, py + 0.025, POOL.z); g.add(basin);
    var goldRim = new THREE.Mesh(new THREE.TorusGeometry(POOL.r + 0.045, 0.012, 6, 48), M.gold); goldRim.rotation.x = Math.PI / 2; goldRim.position.set(POOL.x, py + 0.03, POOL.z); g.add(goldRim);
    var sky = new THREE.Mesh(new THREE.CircleGeometry(POOL.r, 48), M.sky); sky.rotation.x = -Math.PI / 2; sky.position.set(POOL.x, py + 0.03, POOL.z); g.add(sky);
    // Sundial
    var sdx = -0.85, sdz = 0.62, sy = Y(sdx, sdz);
    var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 10), M.stone); ped.position.set(sdx, sy + 0.11, sdz); g.add(ped);
    var dial = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), M.brass); dial.position.set(sdx, sy + 0.23, sdz); g.add(dial);
    var gnomon = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3), M.dark); gnomon.scale.z = 0.15; gnomon.rotation.y = -Math.PI / 4; gnomon.position.set(sdx, sy + 0.29, sdz); g.add(gnomon);
    // Twelve numeral stones around the rim (glowing mark on each)
    for (var n = 0; n < 12; n++) {
      var a = n / 12 * Math.PI * 2 + 0.15, x = Math.cos(a) * 1.17, z = Math.sin(a) * 1.17;
      if (Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.15) continue;
      var ns = K3.roundedBox(0.09, 0.12, 0.05, 0.015, M.stone); ns.position.set(x, Y(x, z) + 0.05, z); ns.rotation.y = -a + Math.PI / 2; g.add(ns);
      var mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, n % 3 ? 0.05 : 0.07, 0.01), M.glow); mark.position.set(x - Math.cos(a) * 0.028, Y(x, z) + 0.06, z - Math.sin(a) * 0.028); mark.rotation.y = -a + Math.PI / 2; g.add(mark);
    }

    /* ===== Level 2: floating rock on chains ===== */
    var rockPos = new V(POOL.x, ROCK_Y, POOL.z);
    if (level >= 2) {
      var fr = floatingRock(); fr.position.copy(rockPos); g.add(fr);
      // (posts at 0/90/180/270 deg: none sits straight in front of the pool, so no chain hangs over the
      // water as seen from the camera)
      [0, 90, 180, 270].forEach(function (deg) {
        var a2 = deg * Math.PI / 180, ax = POOL.x + Math.cos(a2) * (POOL.r + 0.28), az = POOL.z + Math.sin(a2) * (POOL.r + 0.28), ay = Y(ax, az);
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8), M.stone); post.position.set(ax, ay + 0.15, az); post.castShadow = true; g.add(post);
        var ringA = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), M.brass); ringA.position.set(ax, ay + 0.31, az); g.add(ringA);
        var hook = new V(POOL.x + Math.cos(a2) * 0.24, ROCK_Y - 0.1, POOL.z + Math.sin(a2) * 0.24);
        g.add(K3.chain([ax, ay + 0.31, az], [hook.x, hook.y, hook.z], 0.08, 0.022, M.dark));
      });
      var rl = new THREE.PointLight(col('#ffe08a'), 0.8, 2, 2); rl.position.copy(rockPos).add(new V(0, 0.35, 0)); g.add(rl);
    }

    /* ===== Level 3: giant clock ring ===== */
    if (level >= 3) {
      var clock = clockFace(0.78, M.gold, M.glow);
      clock.position.copy(rockPos).addScaledVector(FACE, -0.35).add(new V(0, 0.1, 0)); clock.lookAt(clock.position.clone().add(FACE)); g.add(clock);
      ctx.anim(function (t) { clock.userData.minute.rotation.z = -t * 0.6; clock.userData.hour.rotation.z = -t * 0.05; });
    }

    /* ===== Level 4: clock-face dais + hourglasses ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var dais = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.07, 48), M.stone); dais.position.set(SPOT.x, y0 + 0.02, SPOT.z); dais.castShadow = dais.receiveShadow = true; g.add(dais);
      var face = clockFace(SPOT.r * 0.9, M.brass, M.glow); face.rotation.x = -Math.PI / 2; face.position.set(SPOT.x, y0 + 0.06, SPOT.z); g.add(face);
      ctx.anim(function (t) { face.userData.minute.rotation.z = -t * 0.4; face.userData.hour.rotation.z = -t * 0.04; });
      [[SPOT.x + 0.68, SPOT.z - 0.28, 0], [SPOT.x - 0.28, SPOT.z + 0.68, 0.5]].forEach(function (p) {
        var hg = hourglass(ctx, 0.34, p[2]); hg.position.set(p[0], Y(p[0], p[1]), p[1]); g.add(hg);
      });
    }

    /* ===== Level 5: armillary, pendulum, falling stars ===== */
    if (level >= 5) {
      var arm = new THREE.Group(); arm.position.copy(rockPos).add(new V(0, 0.15, 0)); g.add(arm);
      var rings = [[0.55, M.gold], [0.48, M.brass], [0.62, M.brass]].map(function (r2) { var rg = new THREE.Mesh(new THREE.TorusGeometry(r2[0], 0.012, 8, 64), r2[1]); arm.add(rg); return rg; });
      ctx.anim(function (t) { rings[0].rotation.set(t * 0.3, 0, 0.4); rings[1].rotation.set(0.9, t * 0.5, 0); rings[2].rotation.set(Math.PI / 2, 0, t * 0.2); });
      // Pendulum hanging under the rock; short enough that the bob swings above the water, not in it
      var pend = new THREE.Group(); pend.position.copy(rockPos).add(new V(0, -0.6, 0)); g.add(pend);
      pend.add(K3.tube([[0, 0, 0], [0, -0.22, 0]], 0.006, M.brass, 3));
      var bob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 20), M.gold); bob.rotation.x = Math.PI / 2; bob.position.y = -0.26; pend.add(bob);
      pend.lookAt(pend.position.clone().add(FACE));
      ctx.anim(function (t) { pend.rotation.z = Math.sin(t * 1.6) * 0.35; });
      // Stars falling slowly into the pool
      var n2 = 16, pos = new Float32Array(n2 * 3), seed = [];
      for (var s = 0; s < n2; s++) seed.push(R());
      var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      ctx.anim(function (t) {
        for (var q = 0; q < n2; q++) {
          var k = (t * 0.15 + seed[q]) % 1, a3 = seed[q] * 40, r3 = POOL.r * 0.85 * Math.sqrt(seed[(q + 3) % n2]);
          pos[q * 3] = POOL.x + Math.cos(a3) * r3; pos[q * 3 + 1] = py + 2.2 - k * 2.15; pos[q * 3 + 2] = POOL.z + Math.sin(a3) * r3;
        }
        sg.attributes.position.needsUpdate = true;
      });
      g.add(new THREE.Points(sg, M.star));
    }
    return g;
  }

  HABITATS.register({ id: 'time', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.06, z: SPOT.z, r: SPOT.r }, build: build });
})();
