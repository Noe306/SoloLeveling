/* ==========================================================================
   habitats/wind.js: Wind Habitat (element 7). Inspiration: crystal windmill on
   clouds (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): the windmill stands at the BACK-left, its
   sails facing the camera; the dragon rests on the meadow at the FRONT-right.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  floating meadow island wrapped in drifting clouds, pale grass, spinning
          crystal pinwheel flowers, stone cairns, wind streaks sweeping past
     2  + the crystal windmill (focal point): white stone tower, teal roof,
          four crystal sails turning in the wind
     3  + two banner poles with long fluttering ribbons, floating wind crystals
          swaying on the breeze
     4  + the dragon's perch: pale stone platform with a glowing spiral wind rune,
          four feather totems around it
     5  + sky crown: small cloud islets orbiting the island, a vortex of wind
          streaks around the windmill, drifting feathers, glowing hub crystal
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;                                   // meadow height
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (front-right, kept free)
  var MILL = { x: -0.6, z: -0.58 };                 // windmill (back-left)
  var FACING = new V(1, 0, 1).normalize();          // sails face the camera

  /* ------------------------- materials (first build only) ------------------------- */
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#e4e8ee' }),
      meadow: K3.mat('grass', { repeat: 2, color: '#c4dcb4' }),             // soft, less saturated green (airy)
      cloud: new THREE.MeshStandardMaterial({ color: col('#f6f9ff'), roughness: 1, envMapIntensity: 0.6 }),
      blade: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true }),
      white: new THREE.MeshStandardMaterial({ color: col('#f4f1ea'), roughness: 0.85, normalMap: K3.tex('stone').normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }),   // white plaster
      roof: new THREE.MeshStandardMaterial({ color: col('#3fb6a4'), roughness: 0.5, flatShading: true }),
      wood: K3.mat('wood', { repeat: 1, color: '#c8a882' }),
      dark: new THREE.MeshStandardMaterial({ color: col('#3a4a5a'), roughness: 0.6 }),
      sail: new THREE.MeshPhysicalMaterial({ color: col('#9fe8ff'), emissive: col('#3fb8e0'), emissiveIntensity: 0.25, roughness: 0.1, clearcoat: 1,
        transparent: true, opacity: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.8 }),
      streak: new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.5, depthWrite: false }),
      banner1: new THREE.MeshStandardMaterial({ color: col('#4fc8d8'), roughness: 0.7, side: THREE.DoubleSide }),
      banner2: new THREE.MeshStandardMaterial({ color: col('#f4f0e0'), roughness: 0.7, side: THREE.DoubleSide }),
      stone: K3.mat('stone', { repeat: 1, color: '#eceae2' }),
      rune: K3.mat('glow', { color: '#8ff8e0', intensity: 2.0 }),
      feather: new THREE.MeshStandardMaterial({ color: col('#f4fbff'), roughness: 0.7, side: THREE.DoubleSide }),
      featherTip: new THREE.MeshStandardMaterial({ color: col('#4fb8c8'), roughness: 0.7, side: THREE.DoubleSide }),
      hub: K3.mat('glow', { color: '#bff8ff', intensity: 2.2 })
    };
    return M;
  }

  /* ------------------------- building blocks ------------------------- */
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  // Fluffy cloud: a few smooth lumps.
  function cloud(R, s) {
    var g = new THREE.Group();
    for (var i = 0; i < 4; i++) {
      var p = K3.rock({ radius: s * (0.5 + R() * 0.35), detail: 2, seed: 300 + Math.floor(R() * 999), squash: 0.65, lumpy: 0.18, flat: false, material: M.cloud });
      p.castShadow = false; p.position.set((i - 1.5) * s * 0.55, (R() - 0.3) * s * 0.3, (R() - 0.5) * s * 0.4); g.add(p);
    }
    return g;
  }

  // Meadow island: pale rocky underside, a ring of clouds around its waist, meadow top.
  function cloudIsland(ctx, R) {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 91, squash: 0.42, lumpy: 0.22, color: '#c8ccd4', top: '#a8c890', topAmount: 0.25, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 14, squash: 0.08, lumpy: 0.07, flat: false, material: M.meadow });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    // Clouds wrapping the island (front half bigger), bobbing slowly
    for (var i = 0; i < 9; i++) {
      var a = -0.9 + i / 8 * 3.4, r = 1.32 + R() * 0.1, c = cloud(R, 0.2 + R() * 0.08);
      c.position.set(Math.cos(a) * r, 0.12 + R() * 0.15, Math.sin(a) * r); c.rotation.y = -a; g.add(c);
      (function (cl, y0, ph) { ctx.anim(function (t) { cl.position.y = y0 + Math.sin(t * 0.6 + ph) * 0.025; }); })(c, c.position.y, i);
    }
    return g;
  }

  // Crystal pinwheel flower: thin stem + 4 spinning crystal petals.
  function pinwheel(ctx, h, phase) {
    var g = new THREE.Group();
    g.add(K3.tube([[0, 0, 0], [0.01, h * 0.5, 0], [0, h, 0]], 0.006, M.wood, 4));
    var head = new THREE.Group(); head.position.y = h; g.add(head);
    head.lookAt(head.position.clone().add(FACING));
    for (var i = 0; i < 4; i++) {
      var p = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 3), M.sail); p.rotation.z = i * Math.PI / 2; p.translateY(0.045); head.add(p);
    }
    ctx.anim(function (t) { head.rotation.z = t * 3 + phase; });
    return g;
  }

  // Wind streak: a thin white arc that sweeps around an axis and fades in/out.
  function streak(ctx, r, arc, y, speed, phase) {
    var m = M.streak.clone();
    var s = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 4, 40, arc), m);
    s.rotation.x = Math.PI / 2 + 0.15; s.position.y = y;
    var holder = new THREE.Group(); holder.add(s);
    ctx.anim(function (t) { holder.rotation.y = t * speed + phase; var k = (t * 0.5 + phase) % 1; m.opacity = 0.55 * Math.sin(k * Math.PI); });
    return holder;
  }

  // Windmill: tapered white tower with windows and a teal roof; returns { group, hub (world-ish local pos), sails }.
  function windmill(ctx) {
    var g = new THREE.Group(), H = 1.35;
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, H, 10), M.white); tower.position.y = H / 2; tower.castShadow = tower.receiveShadow = true; g.add(tower);
    [0.25, 0.8].forEach(function (y) { var band = new THREE.Mesh(new THREE.TorusGeometry(0.3 - y / H * 0.1 + 0.012, 0.018, 6, 24), M.wood); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); });
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.45, 10), M.roof); roof.position.y = H + 0.22; roof.castShadow = true; g.add(roof);
    var tipC = K3.crystal({ height: 0.14, radius: 0.04, core: false, intensity: 0.6 }); tipC.position.y = H + 0.42; g.add(tipC);
    // Door + windows on the camera side
    var door = K3.roundedBox(0.12, 0.2, 0.04, 0.02, M.wood); door.position.copy(FACING.clone().multiplyScalar(0.29)).setY(0.1); door.lookAt(door.position.clone().add(FACING)); g.add(door);
    [0.55, 0.95].forEach(function (y) {
      var w = K3.roundedBox(0.07, 0.1, 0.03, 0.01, M.dark), rr = 0.3 - y / H * 0.1;
      w.position.copy(FACING.clone().multiplyScalar(rr)).setY(y); w.lookAt(w.position.clone().add(FACING)); g.add(w);
    });
    // Sails: hub on the camera side near the top, 4 arms with crystal panes
    var hubPos = FACING.clone().multiplyScalar(0.27).setY(H - 0.12);
    var sails = new THREE.Group(); sails.position.copy(hubPos); sails.lookAt(hubPos.clone().add(FACING)); g.add(sails);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 10), M.wood); hub.rotation.x = Math.PI / 2; sails.add(hub);
    for (var i = 0; i < 4; i++) {
      var arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; sails.add(arm);
      var spar = K3.roundedBox(0.035, 0.78, 0.03, 0.01, M.wood); spar.position.y = 0.42; arm.add(spar);
      var pane = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.012), M.sail); pane.position.set(0.12, 0.48, 0); arm.add(pane);
      [0.2, 0.48, 0.76].forEach(function (y) { var slat = K3.roundedBox(0.22, 0.018, 0.02, 0.006, M.wood); slat.position.set(0.12, y, 0.01); arm.add(slat); });
    }
    ctx.anim(function (t) { sails.rotation.z = -t * 0.9; });
    g.userData = { hub: hubPos, sails: sails, height: H + 0.55 };
    return g;
  }

  // Banner pole with a long fluttering ribbon (vertices animated as a travelling wave).
  function banner(ctx, mat, h, phase) {
    var g = new THREE.Group();
    g.add(K3.tube([[0, 0, 0], [0, h, 0]], 0.018, M.wood, 4));
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.roof); knob.position.y = h + 0.02; g.add(knob);
    var geo = new THREE.PlaneGeometry(0.55, 0.12, 16, 1); geo.translate(0.275, 0, 0);
    var base = geo.attributes.position.array.slice(), cloth = new THREE.Mesh(geo, mat); cloth.position.y = h - 0.08; cloth.castShadow = true; g.add(cloth);
    ctx.anim(function (t) {
      var p = geo.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var x = base[i * 3], k = x / 0.55;
        p.setZ(i, Math.sin(x * 9 - t * 6 + phase) * 0.06 * k);
        p.setY(i, base[i * 3 + 1] * (1 - 0.4 * k) - k * 0.05 + Math.sin(x * 5 - t * 4 + phase) * 0.02 * k);
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    });
    return g;
  }

  // Feather (flat leaf shape with a coloured tip).
  function feather(len) {
    var s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(len * 0.18, len * 0.5, 0, len); s.quadraticCurveTo(-len * 0.18, len * 0.5, 0, 0);
    var g = new THREE.Group(), body = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), M.feather); g.add(body);
    var ts = new THREE.Shape(); ts.moveTo(-len * 0.1, len * 0.72); ts.quadraticCurveTo(0, len * 1.02, len * 0.1, len * 0.72); ts.lineTo(-len * 0.1, len * 0.72);
    var tip = new THREE.Mesh(new THREE.ShapeGeometry(ts, 6), M.featherTip); tip.position.z = 0.002; g.add(tip);
    return g;
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(31), g = new THREE.Group();
    g.add(cloudIsland(ctx, R));

    /* ===== Level 1 ===== */
    // Pale meadow grass: instanced spikes following the domed top (see guide 7c), leaning with the wind
    var bladeG = new THREE.ConeGeometry(0.011, 0.15, 3); bladeG.translate(0, 0.075, 0);
    var greens = ['#7fc060', '#9fd47a', '#6aae50', '#b2dc8a'];
    g.add(K3.scatter(bladeG, M.blade, 1500, function (i, Rr) {
      var a = Rr() * Math.PI * 2, r = Math.sqrt(Rr()) * 1.22, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (level >= 2 && Math.hypot(x - MILL.x, z - MILL.z) < 0.4) return null;
      if (level >= 4 && Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.08) return null;
      var y = 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))) - 0.015;
      return { x: x, y: y, z: z, s: 0.6 + Rr() * 0.8, rx: 0.25 + Rr() * 0.2, rz: -0.3 - Rr() * 0.2, ry: Rr() * 0.4, color: greens[i % 4] };   // all lean the same way
    }, 51));
    [[0.95, -0.5, 0.3], [-1.0, 0.5, 0.26], [0.2, 1.05, 0.22], [1.1, 0.25, 0.2], [-0.25, -1.05, 0.28]].forEach(function (p, i) {
      var pw = pinwheel(ctx, p[2], i); pw.position.set(p[0], TOP - 0.03, p[1]); g.add(pw);
    });
    [[1.05, 0.72, 3], [-1.12, -0.15, 4]].forEach(function (p, ci) {         // stone cairns
      for (var k = 0; k < p[2]; k++) {
        var st = K3.rock({ radius: 0.09 - k * 0.015, detail: 2, seed: 120 + ci * 9 + k, squash: 0.5, color: '#d6dae2', material: M.rock });
        st.position.set(p[0], TOP + 0.02 + k * 0.07, p[1]); st.rotation.y = k; g.add(st);
      }
    });
    g.add(streak(ctx, 1.1, 1.4, TOP + 0.5, 0.5, 0));
    g.add(streak(ctx, 0.9, 1.1, TOP + 0.9, -0.4, 2.1));
    g.add(streak(ctx, 1.3, 1.0, TOP + 0.25, 0.6, 4.2));

    /* ===== Level 2: the crystal windmill ===== */
    var mill = null;
    if (level >= 2) {
      var plinth = K3.rock({ radius: 0.42, detail: 3, seed: 140, squash: 0.35, color: '#d6dae2', top: '#a8c890', topAmount: 0.4, material: M.rock });
      plinth.position.set(MILL.x, TOP - 0.02, MILL.z); g.add(plinth);
      mill = windmill(ctx); mill.position.set(MILL.x, TOP + 0.08, MILL.z); g.add(mill);
    }

    /* ===== Level 3: banners + floating wind crystals ===== */
    if (level >= 3) {
      [[1.08, -0.55, M.banner1, 0.9, 0], [-1.05, 0.62, M.banner2, 0.8, 2]].forEach(function (b) {
        var bn = banner(ctx, b[2], b[3], b[4]); bn.position.set(b[0], TOP - 0.03, b[1]); bn.rotation.y = -0.6; g.add(bn);
      });
      [[0.55, -0.85, 0.9], [-0.95, -0.05, 1.1], [0.0, 0.95, 0.8]].forEach(function (p, i) {
        var wc = K3.crystal({ height: 0.18, radius: 0.045, intensity: 0.6, color: '#bff4ff', emissive: '#3fc8e8' });
        wc.position.set(p[0], TOP + p[2], p[1]); g.add(wc);
        (function (c, y0, ph) { ctx.anim(function (t) { c.position.y = y0 + Math.sin(t * 1.3 + ph) * 0.07; c.rotation.y = t * 0.8 + ph; c.rotation.z = Math.sin(t * 0.9 + ph) * 0.25; }); })(wc, wc.position.y, i * 2);
      });
    }

    /* ===== Level 4: the dragon's perch ===== */
    if (level >= 4) {
      var perch = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.08, 48), M.stone);
      perch.position.set(SPOT.x, TOP + 0.0, SPOT.z); perch.castShadow = perch.receiveShadow = true; g.add(perch);
      // Spiral wind rune (glowing tube following a spiral)
      var spiral = [];
      for (var k2 = 0; k2 <= 40; k2++) { var u = k2 / 40, a2 = u * Math.PI * 3.2, rr = 0.05 + u * (SPOT.r - 0.1); spiral.push([SPOT.x + Math.cos(a2) * rr, TOP + 0.045, SPOT.z + Math.sin(a2) * rr]); }
      g.add(K3.tube(spiral, 0.012, M.rune, 80));
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2 + Math.sin(t * 2) * 0.6; });
      // Feather totems: pole + a fan of three feathers, swaying
      [30, 120, 210, 300].forEach(function (deg, i) {
        var ta = deg * Math.PI / 180, tx = SPOT.x + Math.cos(ta) * (SPOT.r + 0.16), tz = SPOT.z + Math.sin(ta) * (SPOT.r + 0.16);
        var tot = new THREE.Group(); tot.position.set(tx, TOP - 0.02, tz); g.add(tot);
        tot.add(K3.tube([[0, 0, 0], [0, 0.32, 0]], 0.016, M.wood, 4));
        var fan = new THREE.Group(); fan.position.y = 0.3; tot.add(fan); fan.lookAt(new V(tx, TOP + 0.3, tz).add(FACING));
        [-0.45, 0, 0.45].forEach(function (r) { var f = feather(0.2); f.rotation.z = r; fan.add(f); });
        ctx.anim(function (t) { fan.rotation.z = Math.sin(t * 2.2 + i) * 0.12; });
      });
    }

    /* ===== Level 5: sky crown ===== */
    if (level >= 5) {
      // Cloud islets orbiting, each carrying a tiny crystal
      var orbit = new THREE.Group(); g.add(orbit);
      for (var o = 0; o < 3; o++) {
        var oa = o / 3 * Math.PI * 2, islet = new THREE.Group(); islet.position.set(Math.cos(oa) * 1.65, TOP + 0.9 + o * 0.25, Math.sin(oa) * 1.65); orbit.add(islet);
        islet.add(cloud(R, 0.13));
        var ic = K3.crystal({ height: 0.16, radius: 0.04, intensity: 0.6, color: '#bff4ff', emissive: '#3fc8e8' }); ic.position.y = 0.06; islet.add(ic);
      }
      ctx.anim(function (t) { orbit.rotation.y = t * 0.15; });
      // Vortex: wind streaks spiralling around the windmill
      for (var v = 0; v < 4; v++) {
        var vs = streak(ctx, 0.5 + v * 0.08, 1.6, 0.4 + v * 0.35, 1.1 + v * 0.2, v * 1.6); vs.position.set(MILL.x, TOP, MILL.z); g.add(vs);
      }
      // Glowing crystal in the windmill hub
      if (mill) {
        var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), M.hub); mill.userData.sails.add(core); core.position.z = 0.06;
        var hl = new THREE.PointLight(col('#bff8ff'), 1.0, 2.5, 2); hl.position.copy(mill.userData.hub); mill.add(hl);
        ctx.anim(function (t) { core.rotation.z = t * 2; });
      }
      // Feathers drifting down across the island
      var fs = [];
      for (var f = 0; f < 8; f++) { var fe = feather(0.08); g.add(fe); fs.push({ m: fe, x: (R() - 0.5) * 2.2, z: (R() - 0.5) * 2.2, ph: R() * 10 }); }
      ctx.anim(function (t) {
        fs.forEach(function (F) {
          var k = (t * 0.12 + F.ph) % 1;
          F.m.position.set(F.x + Math.sin(t * 1.2 + F.ph) * 0.2, TOP + 2.0 - k * 1.9, F.z + Math.cos(t + F.ph) * 0.15);
          F.m.rotation.set(Math.sin(t * 2 + F.ph) * 0.8, t + F.ph, Math.cos(t * 1.7 + F.ph) * 0.6);
        });
      });
    }
    return g;
  }

  HABITATS.register({
    id: 'wind',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP + 0.04, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
