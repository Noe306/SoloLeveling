/* ==========================================================================
   dragon.js: procedural SVG art. renderDragon(element, stage, opts) returns
   an SVG string. 4 stages x 5 element palettes (colors come from PALETTES).
   opts.wobble = true makes the egg wobble (active focus session).
   ========================================================================== */

var PALETTES = {
  Fire:   { main: '#dc2626', light: '#fb923c', dark: '#7f1d1d', accent: '#fbbf24', glow: '#f97316' },
  Ice:    { main: '#22d3ee', light: '#f0f9ff', dark: '#0e7490', accent: '#ffffff', glow: '#67e8f9' },
  Forest: { main: '#10b981', light: '#6ee7b7', dark: '#047857', accent: '#fbbf24', glow: '#34d399' },
  Storm:  { main: '#7c3aed', light: '#c4b5fd', dark: '#4c1d95', accent: '#facc15', glow: '#a78bfa' },
  Cosmic: { main: '#4338ca', light: '#e879f9', dark: '#1e1b4b', accent: '#d946ef', glow: '#818cf8' }
};

var dragonSvgCounter = 0;   // unique gradient ids so many SVGs can share a page

function mirror(inner) { return '<g transform="translate(200,0) scale(-1,1)">' + inner + '</g>'; }

function eyes(cx, cy, gap, r, p) {
  return '<circle cx="' + (cx - gap) + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
         '<circle cx="' + (cx + gap) + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
         '<circle cx="' + (cx - gap + 1) + '" cy="' + (cy + 1) + '" r="' + (r * 0.55) + '" fill="#0f172a"/>' +
         '<circle cx="' + (cx + gap + 1) + '" cy="' + (cy + 1) + '" r="' + (r * 0.55) + '" fill="#0f172a"/>' +
         '<circle cx="' + (cx - gap + 2.5) + '" cy="' + (cy - 1) + '" r="' + (r * 0.2) + '" fill="#fff"/>' +
         '<circle cx="' + (cx + gap + 2.5) + '" cy="' + (cy - 1) + '" r="' + (r * 0.2) + '" fill="#fff"/>';
}

/* ----- Stage 1: Egg ----- */
function eggArt(p, id) {
  return '<ellipse cx="100" cy="180" rx="42" ry="8" fill="#000" opacity=".3"/>' +
    '<g class="egg-body">' +
    '<ellipse cx="100" cy="110" rx="50" ry="66" fill="url(#body' + id + ')" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<circle cx="80" cy="85" r="9" fill="' + p.accent + '" opacity=".7"/>' +
    '<circle cx="118" cy="120" r="12" fill="' + p.accent + '" opacity=".6"/>' +
    '<circle cx="92" cy="145" r="7" fill="' + p.dark + '" opacity=".5"/>' +
    '<circle cx="120" cy="82" r="5" fill="' + p.dark + '" opacity=".5"/>' +
    '<path d="M52 118 L66 108 L78 120 L92 108 L106 120 L120 108 L134 120 L148 110" fill="none" stroke="' + p.dark + '" stroke-width="2" opacity=".4"/>' +
    '<ellipse cx="80" cy="68" rx="10" ry="18" fill="#fff" opacity=".25" transform="rotate(20 80 68)"/>' +
    '</g>';
}

/* ----- Stage 2: Hatchling ----- */
function hatchlingArt(p) {
  var wing = '<path d="M72 118 Q40 100 36 76 Q54 80 62 92 Q58 76 66 64 Q78 84 82 108 Z" fill="' + p.dark + '" stroke="' + p.main + '" stroke-width="2"/>';
  return '<ellipse cx="100" cy="180" rx="44" ry="8" fill="#000" opacity=".3"/>' +
    wing + mirror(wing) +
    '<path d="M126 150 Q168 150 160 118 Q156 136 130 136 Z" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<ellipse cx="100" cy="140" rx="38" ry="34" fill="url(#body)" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<ellipse cx="100" cy="148" rx="22" ry="22" fill="' + p.light + '" opacity=".85"/>' +
    '<ellipse cx="78" cy="172" rx="12" ry="7" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<ellipse cx="122" cy="172" rx="12" ry="7" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<path d="M82 74 L76 50 L94 66 Z" fill="' + p.accent + '"/><path d="M118 74 L124 50 L106 66 Z" fill="' + p.accent + '"/>' +
    '<circle cx="100" cy="92" r="32" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<ellipse cx="100" cy="104" rx="16" ry="11" fill="' + p.light + '"/>' +
    '<circle cx="94" cy="104" r="1.8" fill="' + p.dark + '"/><circle cx="106" cy="104" r="1.8" fill="' + p.dark + '"/>' +
    eyes(100, 86, 12, 7, p) +
    '<path d="M94 111 Q100 115 106 111" fill="none" stroke="' + p.dark + '" stroke-width="2" stroke-linecap="round"/>';
}

/* ----- Stage 3: Juvenile ----- */
function juvenileArt(p, id) {
  var wing = '<path d="M70 110 Q22 96 14 52 Q40 60 52 76 Q46 52 58 36 Q76 66 86 100 Z" fill="' + p.dark + '" stroke="' + p.main + '" stroke-width="2.5"/>' +
             '<path d="M52 76 L70 108 M58 36 L76 104" stroke="' + p.main + '" stroke-width="2" fill="none"/>';
  var spikes = '';
  for (var i = 0; i < 4; i++) spikes += '<path d="M' + (92 + i * 6) + ' ' + (70 + i * 12) + ' l-4 -12 l9 6 z" fill="' + p.accent + '"/>';
  return '<circle cx="100" cy="105" r="88" fill="url(#aura' + id + ')"/>' +
    '<ellipse cx="100" cy="182" rx="50" ry="8" fill="#000" opacity=".3"/>' +
    wing + mirror(wing) +
    '<path d="M132 150 Q186 156 178 112 Q170 138 136 134 Z" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2.5"/>' +
    '<path d="M176 112 l10 -10 l-2 14 z" fill="' + p.accent + '"/>' +
    '<ellipse cx="100" cy="136" rx="44" ry="42" fill="url(#body' + id + ')" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<ellipse cx="100" cy="146" rx="26" ry="28" fill="' + p.light + '" opacity=".85"/>' +
    '<path d="M80 130 H120 M78 142 H122 M80 154 H120" stroke="' + p.main + '" stroke-width="2" opacity=".6"/>' +
    '<ellipse cx="74" cy="176" rx="15" ry="8" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<ellipse cx="126" cy="176" rx="15" ry="8" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<path d="M80 72 L66 36 L96 62 Z" fill="' + p.accent + '" stroke="' + p.dark + '" stroke-width="1.5"/>' +
    '<path d="M120 72 L134 36 L104 62 Z" fill="' + p.accent + '" stroke="' + p.dark + '" stroke-width="1.5"/>' +
    '<ellipse cx="100" cy="88" rx="34" ry="30" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<ellipse cx="100" cy="102" rx="20" ry="13" fill="' + p.light + '"/>' +
    '<circle cx="93" cy="101" r="2" fill="' + p.dark + '"/><circle cx="107" cy="101" r="2" fill="' + p.dark + '"/>' +
    eyes(100, 82, 14, 7, p) +
    '<path d="M92 110 Q100 116 108 110" fill="none" stroke="' + p.dark + '" stroke-width="2" stroke-linecap="round"/>';
}

/* ----- Stage 4: Adult ----- */
function adultArt(p, id) {
  var wing = '<path d="M66 104 Q10 92 4 30 Q34 42 46 62 Q42 30 56 10 Q78 50 88 92 Z" fill="' + p.dark + '" stroke="' + p.main + '" stroke-width="3"/>' +
             '<path d="M46 62 L68 100 M56 10 L78 96 M30 48 L62 98" stroke="' + p.main + '" stroke-width="2" fill="none"/>';
  var rays = '';
  for (var i = 0; i < 12; i++) {
    rays += '<path d="M100 100 L' + (100 + 98 * Math.cos(i * Math.PI / 6)).toFixed(1) + ' ' + (100 + 98 * Math.sin(i * Math.PI / 6)).toFixed(1) +
            ' L' + (100 + 98 * Math.cos((i + 0.35) * Math.PI / 6)).toFixed(1) + ' ' + (100 + 98 * Math.sin((i + 0.35) * Math.PI / 6)).toFixed(1) +
            ' Z" fill="' + p.glow + '" opacity=".16"/>';
  }
  var spikes = '';
  for (var j = 0; j < 5; j++) spikes += '<path d="M' + (94 + j * 3) + ' ' + (62 + j * 16) + ' l-7 -12 l12 4 z" fill="' + p.accent + '"/>';
  return '<circle cx="100" cy="100" r="96" fill="url(#aura' + id + ')"/>' + rays +
    '<ellipse cx="100" cy="186" rx="56" ry="8" fill="#000" opacity=".3"/>' +
    wing + mirror(wing) +
    '<path d="M138 156 Q196 168 192 112 Q182 148 142 140 Z" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="3"/>' +
    '<path d="M190 112 l8 -14 l2 18 z" fill="' + p.accent + '"/>' +
    '<ellipse cx="100" cy="140" rx="46" ry="44" fill="url(#body' + id + ')" stroke="' + p.dark + '" stroke-width="3.5"/>' +
    '<ellipse cx="100" cy="148" rx="28" ry="32" fill="' + p.light + '" opacity=".9"/>' +
    '<path d="M78 128 H122 M76 140 H124 M78 152 H122 M82 164 H118" stroke="' + p.main + '" stroke-width="2.5" opacity=".6"/>' +
    '<ellipse cx="72" cy="180" rx="16" ry="8" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<ellipse cx="128" cy="180" rx="16" ry="8" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<path d="M78 70 L58 22 L96 58 Z" fill="' + p.accent + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<path d="M122 70 L142 22 L104 58 Z" fill="' + p.accent + '" stroke="' + p.dark + '" stroke-width="2"/>' +
    '<ellipse cx="100" cy="88" rx="34" ry="30" fill="' + p.main + '" stroke="' + p.dark + '" stroke-width="3.5"/>' +
    '<ellipse cx="100" cy="102" rx="21" ry="13" fill="' + p.light + '"/>' +
    '<circle cx="93" cy="101" r="2" fill="' + p.dark + '"/><circle cx="107" cy="101" r="2" fill="' + p.dark + '"/>' +
    '<circle cx="86" cy="82" r="8" fill="' + p.glow + '"/><circle cx="114" cy="82" r="8" fill="' + p.glow + '"/>' +
    '<circle cx="86" cy="82" r="3.5" fill="#0f172a"/><circle cx="114" cy="82" r="3.5" fill="#0f172a"/>' +
    '<path d="M92 110 Q100 116 108 110" fill="none" stroke="' + p.dark + '" stroke-width="2" stroke-linecap="round"/>' +
    // Crown
    '<path d="M76 62 L80 40 L90 54 L100 34 L110 54 L120 40 L124 62 Z" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>' +
    '<circle cx="100" cy="46" r="3.5" fill="' + p.main + '"/><circle cx="82" cy="50" r="2.5" fill="' + p.glow + '"/><circle cx="118" cy="50" r="2.5" fill="' + p.glow + '"/>';
}

function renderDragon(element, stage, opts) {
  opts = opts || {};
  var p = PALETTES[element] || PALETTES.Fire;
  var id = ++dragonSvgCounter;
  var defs = '<defs>' +
    '<linearGradient id="body' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p.light + '"/><stop offset="1" stop-color="' + p.main + '"/></linearGradient>' +
    '<radialGradient id="aura' + id + '"><stop offset="0" stop-color="' + p.glow + '" stop-opacity=".55"/><stop offset="1" stop-color="' + p.glow + '" stop-opacity="0"/></radialGradient>' +
    '</defs>';
  var art;
  if (stage === 'Egg') art = eggArt(p, id);
  else if (stage === 'Hatchling') art = hatchlingArt(p).replace(/url\(#body\)/g, 'url(#body' + id + ')');
  else if (stage === 'Juvenile') art = juvenileArt(p, id);
  else art = adultArt(p, id);
  var cls = 'dragon-svg stage-' + stage.toLowerCase() + (opts.wobble ? ' wobble' : '');
  return '<svg class="' + cls + '" viewBox="0 0 200 200" role="img" aria-label="' + esc(element + ' dragon, ' + stage) + '">' + defs + art + '</svg>';
}
