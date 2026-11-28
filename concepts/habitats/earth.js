/* ==========================================================================
   habitats/earth.js: Earth Habitat (element 3). Inspiration: cactus desert
   (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): layered sandstone mesa at the BACK-left,
   tall cactus on the left, the dragon rests on open sand at the FRONT-right.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  floating sandstone plateau with red/orange rock layers, rippled sand top,
          young saguaro cactus, barrel cactus, boulders, dry grass tufts, pebbles
     2  + flat-topped layered mesa (focal point), the saguaro grows tall with
          arms and flowers, prickly pears with fruit, flowering barrel cactus
     3  + natural sandstone arch along the back-right rim, desert flowers
     4  + the dragon's stone circle: hexagonal flagstones on the resting spot,
          amber rune ring, six sandstone monoliths with glowing glyphs
     5  + amber geode crystals bursting out of the mesa, floating rocks
          orbiting it (earth magic), swirling dust
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;
  var TOP = 0.55;                                   // sand surface height
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (front-right, kept free)
  var MESA = { x: -0.62, z: -0.56, r: 0.52, h: 0.85 };   // level-2 mesa (back-left), h = height above TOP
  var SAGUARO = { x: -0.98, z: 0.42 };              // cactus spot (left)
  // Sandstone layers, bottom to top (sRGB): rust, terracotta, cream, deep red, sand.
  var STRATA = ['#a8502c', '#cf7a45', '#e9b783', '#b9603a', '#dc9a5c', '#f0c792'];

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#ffffff' }),   // colours come from the strata
      sand: K3.mat('sand', { repeat: 2, color: '#f2d3a0' }),
      cactus: new THREE.MeshStandardMaterial({ color: col('#4f8f3e'), roughness: 0.65 }),
      pad: new THREE.MeshStandardMaterial({ color: col('#6c9e48'), roughness: 0.7 }),
      flowerW: new THREE.MeshStandardMaterial({ color: col('#fff4dc'), emissive: col('#806a40'), emissiveIntensity: 0.1, roughness: 0.6, flatShading: true }),
      flowerP: new THREE.MeshStandardMaterial({ color: col('#ff6fa3'), emissive: col('#a02858'), emissiveIntensity: 0.15, roughness: 0.6, flatShading: true }),
      flowerY: new THREE.MeshStandardMaterial({ color: col('#ffd23f'), emissive: col('#a07810'), emissiveIntensity: 0.15, roughness: 0.6 }),
      fruit: new THREE.MeshStandardMaterial({ color: col('#c8285a'), roughness: 0.5 }),
      straw: new THREE.MeshStandardMaterial({ color: col('#e3c57e'), roughness: 0.85, flatShading: true }),
      flag: K3.mat('stone', { flat: true, repeat: 1, color: '#ffe0b0' }),
      monolith: K3.mat('stone', { flat: true, repeat: 1, color: '#f2b98a' }),
      rune: K3.mat('glow', { color: '#ffb347', intensity: 2.2 }),
      dust: new THREE.PointsMaterial({ map: dotTexture(), color: col('#e8c690'), size: 0.07, transparent: true, opacity: 0.55, depthWrite: false })
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
  // Paint sandstone layers into a rock's vertex colours by height (wavy bands + darker base).
  // band: thickness of one layer; shift: offsets the pattern so neighbours don't match exactly.
  function strata(mesh, band, shift) {
    var g = mesh.geometry, p = g.attributes.position, c = g.attributes.color, cc = new THREE.Color();
    var ymin = Infinity, ymax = -Infinity;
    for (var i = 0; i < p.count; i++) { ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
    var pal = STRATA.map(function (h) { return col(h); });
    for (var j = 0; j < p.count; j++) {
      var x = p.getX(j), y = p.getY(j), z = p.getZ(j);
      var wob = 0.25 * K3.fbm3(x * 2.2, y * 0.5, z * 2.2, 2);                   // bands wave a little
      var k = Math.floor((y + mesh.position.y) / band + wob + (shift || 0));
      cc.copy(pal[((k % pal.length) + pal.length) % pal.length]);
      cc.multiplyScalar(0.62 + 0.38 * (y - ymin) / Math.max(1e-6, ymax - ymin));   // darker towards the bottom
      c.setXYZ(j, cc.r, cc.g, cc.b);
    }
    c.needsUpdate = true;
    return mesh;
  }

  // Sandstone rock with strata. opts = K3.rock options; band = layer thickness.
  function sandstone(opts, band, shift) {
    opts.material = M.rock; opts.color = '#ffffff';
    return strata(K3.rock(opts), band || 0.09, shift);
  }

  // Mesa shape: a faceted column (wider at the base) whose sides are eroded by noise and
  // stepped per layer, with a flat top. Vertex colours: one sandstone colour per layer.
  function mesaGeometry(r, h, seed) {
    var layers = 7, geo = new THREE.CylinderGeometry(r * 0.78, r, h, 11, layers * 2, false).toNonIndexed();
    geo.translate(0, h / 2, 0);
    var p = geo.attributes.position, cols = new Float32Array(p.count * 3), pal = STRATA.map(function (c) { return col(c); }), cc = new THREE.Color();
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z);
      var layer = Math.min(layers - 1, Math.floor(y / h * layers));
      if (rr > 1e-4 && y < h - 1e-4) {                                          // sides: erode + alternate layer insets (steps)
        var k = 1 + 0.12 * K3.fbm3(x * 3 + seed, y * 2.5, z * 3, 3) - (layer % 2) * 0.05;
        p.setX(i, x * k); p.setZ(i, z * k);
      }
    }
    // Colour per triangle (from its centre height) so the bands have crisp edges.
    for (var t = 0; t < p.count; t += 3) {
      var cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, L = Math.min(layers - 1, Math.floor(cy / h * layers));
      cc.copy(pal[(L + 1) % pal.length]).multiplyScalar(0.7 + 0.3 * cy / h);
      if (p.getY(t) > h - 1e-4 && p.getY(t + 1) > h - 1e-4 && p.getY(t + 2) > h - 1e-4) cc.copy(col('#e7b27a'));   // sandy top
      for (var v = 0; v < 3; v++) { cols[(t + v) * 3] = cc.r; cols[(t + v) * 3 + 1] = cc.g; cols[(t + v) * 3 + 2] = cc.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // Re-map UVs from above (x, z) so the sand texture on the cap is not stretched.
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  // Floating plateau: layered sandstone underside + rippled sand top.
  function desertPlateau() {
    var g = new THREE.Group();
    var under = sandstone({ radius: 1.38, detail: 4, seed: 51, squash: 0.42, lumpy: 0.22 }, 0.1, 0);
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 6, squash: 0.08, lumpy: 0.07, flat: false, material: M.sand });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Bend a cylinder-like geometry into ribs (cactus pleats): n ribs, depth = how deep the grooves are.
  function ribs(geo, n, depth) {
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - depth * (0.5 - 0.5 * Math.cos(a * n));
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Ribbed column with a rounded top (saguaro trunk or arm segment) standing on y = 0.
  function ribbedColumn(r, h) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(ribs(new THREE.CylinderGeometry(r, r * 1.06, h, 24, 6), 10, 0.14), M.cactus);
    body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    var dome = new THREE.Mesh(ribs(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), 10, 0.14), M.cactus);
    dome.position.y = h; dome.castShadow = true; g.add(dome);
    return g;
  }

  // Saguaro cactus. s = size (0.55 young: no arms; 1 = full with two arms and flowers).
  function saguaro(s, flowers) {
    var g = new THREE.Group(), r = 0.1 * s + 0.02;
    g.add(ribbedColumn(r, 1.25 * s));
    if (s >= 0.8) {
      // Arms: a short sideways elbow, then a ribbed column going up
      [[1, 0.5, 0.42], [-1, 0.68, 0.32]].forEach(function (a) {
        var side = a[0], y0 = a[1] * s, up = a[2] * s, rr = r * 0.72;
        var elbow = K3.tube([[0, y0, 0], [side * 0.12 * s, y0 + 0.01, 0], [side * 0.2 * s, y0 + 0.08 * s, 0]], rr, M.cactus, 10);
        g.add(elbow);
        var arm = ribbedColumn(rr, up); arm.position.set(side * 0.2 * s, y0 + 0.06 * s, 0); g.add(arm);
        if (flowers) g.add(flowerAt(side * 0.2 * s, y0 + 0.06 * s + up + rr * 0.8, 0, M.flowerW, 0.6));
      });
      if (flowers) [0, 2.1, 4.2].forEach(function (a) { g.add(flowerAt(Math.cos(a) * r * 0.5, 1.25 * s + r * 0.85, Math.sin(a) * r * 0.5, M.flowerW, 0.7)); });
    }
    return g;
  }

  // Small flower: petals in a ring + yellow centre, at (x, y, z), facing up.
  function flowerAt(x, y, z, petal, s) {
    var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s || 1);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2, pt = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), petal);
      pt.position.set(Math.cos(a) * 0.028, 0.02, Math.sin(a) * 0.028); pt.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(pt);
    }
    var c = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.flowerY); c.position.y = 0.025; g.add(c);
    return g;
  }

  // Round barrel cactus, optionally with a crown of pink flowers.
  function barrel(r, flowers) {
    var g = new THREE.Group();
    var b = new THREE.Mesh(ribs(new THREE.SphereGeometry(r, 24, 12), 14, 0.12), M.cactus);
    b.scale.y = 0.85; b.position.y = r * 0.7; b.castShadow = b.receiveShadow = true; g.add(b);
    if (flowers) for (var i = 0; i < 4; i++) { var a = i / 4 * Math.PI * 2; g.add(flowerAt(Math.cos(a) * r * 0.3, r * 1.5, Math.sin(a) * r * 0.3, M.flowerP, 0.8)); }
    return g;
  }

  // Prickly pear: flat oval paddles growing out of each other, red fruit on the top edges.
  function pricklyPear(R) {
    var g = new THREE.Group();
    function paddle(x, y, z, ry, rz, s) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), M.pad);
      m.scale.set(0.11 * s, 0.15 * s, 0.03 * s); m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.castShadow = true; g.add(m);
      return m;
    }
    paddle(0, 0.13, 0, 0, 0, 1);
    paddle(0.08, 0.32, 0.01, 0.4, -0.5, 0.85); paddle(-0.09, 0.3, -0.01, -0.3, 0.55, 0.8); paddle(0.02, 0.4, 0.04, 1.2, 0.1, 0.7);
    [[0.15, 0.43, 0.02], [-0.16, 0.41, 0], [0.03, 0.53, 0.05], [0.12, 0.46, 0.06]].forEach(function (f) {
      var fr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.fruit); fr.scale.y = 1.3; fr.position.set(f[0], f[1], f[2]); g.add(fr);
    });
    return g;
  }

  // Slowly swirling dust motes around (cx, cz).
  function dust(ctx, R, n, cx, cz, rad, y0, y1) {
    var pos = new Float32Array(n * 3), meta = [];
    for (var i = 0; i < n; i++) meta.push({ a: R() * 6.28, r: rad * (0.3 + R() * 0.7), y: y0 + R() * (y1 - y0), s: 0.2 + R() * 0.3 });
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.anim(function (t) {
      meta.forEach(function (m, q) {
        var a = m.a + t * m.s;
        pos[q * 3] = cx + Math.cos(a) * m.r; pos[q * 3 + 1] = m.y + Math.sin(t * 0.7 + m.a) * 0.08; pos[q * 3 + 2] = cz + Math.sin(a) * m.r;
      });
      geo.attributes.position.needsUpdate = true;
    });
    return new THREE.Points(geo, M.dust);
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(13), g = new THREE.Group();
    g.add(desertPlateau());

    /* ===== Level 1 ===== */
    var sg = saguaro(level >= 2 ? 1 : 0.55, level >= 2); sg.position.set(SAGUARO.x, TOP - 0.06, SAGUARO.z); g.add(sg);
    var br = barrel(0.15, level >= 2); br.position.set(0.88, TOP - 0.04, -0.5); g.add(br);
    var br2 = barrel(0.09, false); br2.position.set(1.08, TOP - 0.05, -0.2); g.add(br2);
    [[1.08, 0.2, 0.2, 1], [-0.22, -1.1, 0.17, 2], [-0.35, 1.08, 0.13, 3]].forEach(function (p) {
      var rk = sandstone({ radius: p[2], detail: 3, seed: 60 + p[3], squash: 0.75, lumpy: 0.3 }, 0.06, p[3]);
      rk.position.set(p[0], TOP + 0.02, p[1]); g.add(rk);
    });
    [[0.95, 0.75], [-0.7, 0.95], [1.2, -0.55], [0.3, -1.15], [-1.18, -0.05], [0.55, 1.12]].forEach(function (p, i) {   // pebbles
      var pb = sandstone({ radius: 0.045 + R() * 0.04, detail: 2, seed: 80 + i, squash: 0.6 }, 0.04, i);
      pb.position.set(p[0], TOP - 0.01, p[1]); g.add(pb);
    });
    // Dry grass tufts in a few patches (not on the dragon spot)
    var tufts = [[0.98, -0.75], [-0.75, 0.85], [0.1, 1.15], [1.18, 0.5], [-1.1, -0.4]];
    // (thin straw-coloured spikes fanning out; single-sided cones stay bright, flat grass blades went black)
    var spike = new THREE.ConeGeometry(0.012, 0.16, 3); spike.translate(0, 0.08, 0);
    g.add(K3.scatter(spike, M.straw, tufts.length * 14, function (i, Rr) {
      var t = tufts[Math.floor(i / 14)], a = Rr() * 6.28, d = Rr() * 0.07;
      return { x: t[0] + Math.cos(a) * d, y: TOP - 0.05, z: t[1] + Math.sin(a) * d, s: 0.7 + Rr() * 0.6, rx: Math.cos(a) * 0.45, rz: -Math.sin(a) * 0.45, ry: Rr() * 3 };
    }, 31));
    var sun = new THREE.PointLight(col('#ffcf8a'), 0.6, 3.5, 2); sun.position.set(0.3, TOP + 1.2, 0.3); g.add(sun);

    /* ===== Level 2: mesa + grown cacti ===== */
    if (level >= 2) {
      // Mesa: a tapered column with steep, eroded sides, a flat top and crisp sandstone bands.
      var mesa = new THREE.Mesh(mesaGeometry(MESA.r, MESA.h + 0.1, 91), M.rock);
      mesa.castShadow = mesa.receiveShadow = true;
      mesa.position.set(MESA.x, TOP - 0.1, MESA.z); g.add(mesa);
      // Rubble at the mesa's foot
      for (var rb = 0; rb < 5; rb++) {
        var ra = 0.3 + rb * 0.55, rr = sandstone({ radius: 0.07 + R() * 0.06, detail: 2, seed: 120 + rb, squash: 0.65 }, 0.05, rb);
        rr.position.set(MESA.x + Math.cos(ra) * 0.62, TOP, MESA.z + Math.sin(ra) * 0.62); g.add(rr);
      }
      // Sand drift and a small cactus on the mesa top
      var topCactus = barrel(0.08, true); topCactus.position.set(MESA.x + 0.12, TOP - 0.1 + MESA.h - 0.03, MESA.z + 0.08); g.add(topCactus);
      // Prickly pears
      [[0.05, -1.02, 0.2], [-0.12, 1.05, 2.4], [1.12, 0.62, 1.1]].forEach(function (p) {
        var pp = pricklyPear(R); pp.position.set(p[0], TOP - 0.04, p[1]); pp.rotation.y = p[2]; g.add(pp);
      });
    }

    /* ===== Level 3: sandstone arch along the back-right rim ===== */
    if (level >= 3) {
      // At the back, spanning across the view (direction +x,-z) so its opening faces the camera.
      var A = new THREE.Vector3(0.03, TOP, -0.53), B = new THREE.Vector3(0.69, TOP, -1.19), H = 1.0, N = 16;
      for (var k = 0; k <= N; k++) {
        var t = k / N, p = A.clone().lerp(B, t);
        p.y += Math.pow(Math.sin(t * Math.PI), 0.7) * H;                       // rounded top, steep legs
        var rad = 0.2 - Math.sin(t * Math.PI) * 0.07;                           // thick feet, thinner span
        var chunk = sandstone({ radius: rad, detail: 3, seed: 200 + k, squash: 0.85, lumpy: 0.25 }, 0.08, k * 0.37);
        chunk.position.copy(p); chunk.rotation.y = k; g.add(chunk);
      }
      // Fallen blocks under the arch + desert flowers
      [[-0.08, -0.36, 0.11], [0.88, -1.0, 0.09]].forEach(function (p, i) {
        var fb = sandstone({ radius: p[2], detail: 2, seed: 230 + i, squash: 0.7 }, 0.05, i); fb.position.set(p[0], TOP, p[1]); g.add(fb);
      });
      [[0.7, -0.35, 'P'], [0.15, -0.75, 'Y'], [-0.95, 0.85, 'P'], [1.15, 0.0, 'W'], [-0.6, 1.08, 'Y'], [0.25, 1.15, 'P']].forEach(function (f) {
        g.add(flowerAt(f[0], TOP - 0.02, f[1], f[2] === 'P' ? M.flowerP : f[2] === 'Y' ? M.flowerY : M.flowerW, 0.9));
      });
    }

    /* ===== Level 4: the dragon's stone circle ===== */
    if (level >= 4) {
      // Hexagonal flagstones covering the resting spot (one centre + a ring of six)
      var hexR = 0.17;
      [[0, 0]].concat([0, 1, 2, 3, 4, 5].map(function (i) { var a = i * Math.PI / 3 + Math.PI / 6; return [Math.cos(a) * hexR * 1.78, Math.sin(a) * hexR * 1.78]; }))
        .forEach(function (o, i) {
          var hx = new THREE.Mesh(new THREE.CylinderGeometry(hexR * 0.97, hexR, 0.05, 6), M.flag);
          hx.position.set(SPOT.x + o[0], TOP - 0.005, SPOT.z + o[1]); hx.rotation.y = Math.PI / 6; hx.castShadow = hx.receiveShadow = true; g.add(hx);
        });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.04, 0.012, 6, 64), M.rune);
      ring.rotation.x = Math.PI / 2; ring.position.set(SPOT.x, TOP + 0.01, SPOT.z); g.add(ring);
      // Six leaning monoliths around it, each with a glowing glyph facing the centre
      for (var m = 0; m < 6; m++) {
        var ma = m / 6 * Math.PI * 2 + 0.3, mx = SPOT.x + Math.cos(ma) * (SPOT.r + 0.17), mz = SPOT.z + Math.sin(ma) * (SPOT.r + 0.17);
        var mh = 0.32 + (m % 2) * 0.14;
        var mono = K3.roundedBox(0.17, mh, 0.11, 0.03, M.monolith);
        mono.position.set(mx, TOP - 0.03 + mh / 2, mz); mono.rotation.y = -ma + Math.PI / 2; mono.rotation.x = 0; mono.rotateX(-0.08); g.add(mono);
        var glyph = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 4, m % 2 ? 3 : 4), M.rune);
        glyph.position.set(mx - Math.cos(ma) * 0.06, TOP - 0.03 + mh * 0.62, mz - Math.sin(ma) * 0.045); glyph.rotation.y = -ma + Math.PI / 2; g.add(glyph);
      }
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2.2 + Math.sin(t * 1.8) * 0.6; });
      var runeL = new THREE.PointLight(col('#ffb347'), 0.7, 1.6, 2); runeL.position.set(SPOT.x, TOP + 0.4, SPOT.z); g.add(runeL);
    }

    /* ===== Level 5: amber geode + floating rocks ===== */
    if (level >= 5) {
      var mTop = TOP - 0.1 + MESA.h;
      var geode = K3.crystalCluster({ count: 6, height: 0.62, radius: 0.09, seed: 61, spread: 0.13, color: '#ffb347', emissive: '#ff7a10', intensity: 0.5 });
      geode.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) o.material.envMapIntensity = 0.5; });
      geode.position.set(MESA.x - 0.06, mTop - 0.04, MESA.z - 0.06); g.add(geode);
      for (var gr = 0; gr < 7; gr++) {                                          // broken rock rim around the crystals
        var ga = gr / 7 * Math.PI * 2, gs = sandstone({ radius: 0.07, detail: 2, seed: 300 + gr, squash: 0.8 }, 0.04, gr);
        gs.position.set(MESA.x - 0.06 + Math.cos(ga) * 0.2, mTop, MESA.z - 0.06 + Math.sin(ga) * 0.2); g.add(gs);
      }
      // Floating rocks orbiting the mesa, pointed underneath like chunks torn from the ground
      var orbit = new THREE.Group(); orbit.position.set(MESA.x, 0, MESA.z); g.add(orbit);
      for (var f = 0; f < 6; f++) {
        var fa = f / 6 * Math.PI * 2, fr = sandstone({ radius: 0.1 + (f % 3) * 0.035, detail: 3, seed: 320 + f, squash: 0.9, lumpy: 0.3 }, 0.05, f);
        var fp = fr.geometry.attributes.position;
        for (var v = 0; v < fp.count; v++) if (fp.getY(v) < 0) fp.setY(v, fp.getY(v) * 1.9);   // stretch the underside into a point
        fr.geometry.computeVertexNormals();
        fr.position.set(Math.cos(fa) * 0.85, TOP + 1.25 + (f % 2) * 0.3, Math.sin(fa) * 0.85); orbit.add(fr);
        (function (rock, ph, y0) { ctx.anim(function (t) { rock.position.y = y0 + Math.sin(t * 1.1 + ph) * 0.06; rock.rotation.y = t * 0.3 + ph; }); })(fr, f, fr.position.y);
      }
      ctx.anim(function (t) { orbit.rotation.y = t * 0.18; });
      g.add(dust(ctx, R, 60, MESA.x, MESA.z, 1.1, TOP + 0.1, TOP + 1.6));
      var amber = new THREE.PointLight(col('#ffb347'), 1.3, 3, 2); amber.position.set(MESA.x, mTop + 0.5, MESA.z); g.add(amber);
    }
    return g;
  }

  HABITATS.register({
    id: 'earth',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP + 0.02, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
