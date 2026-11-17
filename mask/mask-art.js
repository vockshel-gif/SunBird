// Gini Raksha (fire demon) mask artwork, drawn from scratch as SVG.
//
// The mask is split into parts so the 3D mask can move them on their own:
//   faceSVG()  – forehead, eyes, nose, upper teeth, fangs (and the dark mouth behind the jaw)
//   jawSVG()   – lower teeth, lip, chin and tongue (drops when you open your mouth)
//   crownSVG() – the crown of flames behind the head
//   earSVG()   – the flame "ear" on the left side (mirrored for the right side)
//
// Face units: the face is 400 wide, its eyes sit at (122, 228) and (278, 228).
// mask.js uses the same numbers to place the parts, so change them together.

export const C = {
  red: '#e8253f',
  redDeep: '#c9142f',
  yellow: '#ffc21f',
  orange: '#ff8a1a',
  maroon: '#5a1430',
  maroonDeep: '#40091f',
  ink: '#2a0a0f',
  white: '#fff7ec',
  green: '#7dc243',
  black: '#140708',
  mouth: '#2a0508',
};

const r1 = (n) => Math.round(n * 10) / 10;
const xy = (p) => r1(p[0]) + ' ' + r1(p[1]);
const line = (a) => a.map(xy).join(' L ');
const rad = (deg) => (deg * Math.PI) / 180;
// Angle 0 points straight up, positive angles turn clockwise.
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];

function svg(w, h, body, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// A mirrored outline: give the right half (top to bottom), get the whole shape.
function symPath(start, segs, mid = 200) {
  const m = ([x, y]) => [2 * mid - x, y];
  const ends = [start, ...segs.map((s) => s[2])];
  let d = `M ${start}`;
  for (const [c1, c2, p] of segs) d += ` C ${c1} ${c2} ${p}`;
  d += ` L ${m(ends[ends.length - 1])}`;
  for (let i = segs.length - 1; i >= 0; i--) d += ` C ${m(segs[i][1])} ${m(segs[i][0])} ${m(ends[i])}`;
  return d + ' Z';
}

function sector(cx, cy, r, a0, a1) {
  const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${xy(p0)} A ${r} ${r} 0 ${big} 1 ${xy(p1)} Z`;
}

// ------------------------------------------------------------------ flames
// One wavy flame tongue. (x, y) is the base, angle 0 points up, negative leans left.
function flame({ x, y, angle = 0, len, width, bend = 0, wave = 0.05, phase = 0, kind = 'red' }) {
  const ca = Math.cos(rad(angle)), sa = Math.sin(rad(angle));
  const at = (u, v) => [x + v * ca + u * sa, y - u * ca + v * sa];
  const N = 44, spine = [], half = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = len * (bend * t * t + wave * Math.sin(t * Math.PI * 1.7 + phase) * Math.min(1, t * 2.5));
    spine.push([t * len, v]);
    half.push((width / 2) * Math.pow(1 - t, 0.85) * (1 + 0.2 * Math.sin(t * Math.PI)));
  }
  const edge = (k) => spine.map(([u, v], i) => {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(N, i + 1)];
    const du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv) || 1;
    return at(u - (dv / L) * half[i] * k, v + (du / L) * half[i] * k);
  });
  const stripe = (k, t0, t1) => 'M ' + line(edge(k).slice(Math.round(t0 * N), Math.round(t1 * N) + 1));
  const outline = 'M ' + line(edge(-1)) + ' L ' + line(edge(1).reverse()) + ' Z';
  if (kind === 'red') {
    return `<path d="${outline}" fill="${C.red}" stroke="${C.ink}" stroke-width="4.5" stroke-linejoin="round"/>` +
      `<path d="${stripe(0.42, 0.04, 0.8)}" fill="none" stroke="${C.white}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="${stripe(-0.5, 0.06, 0.7)}" fill="none" stroke="${C.orange}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<path d="${outline}" fill="${C.yellow}" stroke="#b9481a" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="${stripe(0.05, 0.05, 0.86)}" fill="none" stroke="${C.red}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="${stripe(-0.55, 0.1, 0.6)}" fill="none" stroke="${C.orange}" stroke-width="2.6" stroke-linecap="round"/>`;
}

// ------------------------------------------------------------------ rosettes
// The scalloped white / yellow / green rings around the eyes, forehead and ears.
function rosette(cx, cy, r, a0, a1, { scallops = 14, ring = true } = {}) {
  let s = `<path d="${sector(cx, cy, r, a0, a1)}" fill="${C.white}"/>`;
  for (let i = 0; i <= scallops; i++) {
    const p = polar(cx, cy, r, a0 + ((a1 - a0) * i) / scallops);
    s += `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r * 0.13}" fill="${C.white}" stroke="${C.ink}" stroke-width="2.4"/>`;
  }
  s += `<path d="${sector(cx, cy, r * 0.97, a0, a1)}" fill="${C.white}"/>`;
  s += `<path d="${sector(cx, cy, r * 0.84, a0, a1)}" fill="${C.ink}"/>`;
  s += `<path d="${sector(cx, cy, r * 0.8, a0, a1)}" fill="${C.yellow}"/>`;
  const n = Math.round((a1 - a0) / 9);
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    s += `<path d="M ${xy(polar(cx, cy, r * 0.6, a))} L ${xy(polar(cx, cy, r * 0.8, a))}" stroke="#b9481a" stroke-width="2.2"/>`;
  }
  s += `<path d="${sector(cx, cy, r * 0.62, a0, a1)}" fill="${C.green}"/>`;
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    s += `<path d="M ${xy(polar(cx, cy, r * 0.5, a))} L ${xy(polar(cx, cy, r * 0.62, a))}" stroke="#3f7a1f" stroke-width="1.8"/>`;
  }
  if (ring) s += `<path d="${sector(cx, cy, r * 0.52, a0, a1)}" fill="${C.red}"/>`;
  return s;
}

// ------------------------------------------------------------------ face
export function faceSVG(scale = 2.5) {
  const outline = symPath([200, 14], [
    [[262, 14], [330, 38], [360, 100]],
    [[382, 145], [394, 190], [390, 236]],
    [[386, 286], [368, 326], [346, 362]],
    [[330, 396], [324, 444], [300, 490]],
  ]);
  const eyeRing = (cx, cy) => rosette(cx, cy, 94, -128, 128, { scallops: 16 });
  const eye = (cx, cy) =>
    `<circle cx="${cx}" cy="${cy}" r="47" fill="${C.maroon}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="39" fill="${C.white}" stroke="${C.red}" stroke-width="5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="27" fill="${C.black}"/>` +
    `<circle cx="${cx - 9}" cy="${cy - 10}" r="7" fill="#fff" opacity=".9"/>` +
    `<circle cx="${cx + 8}" cy="${cy + 9}" r="3" fill="#fff" opacity=".6"/>`;
  const mirrorX = (d) => `<g transform="translate(400 0) scale(-1 1)">${d}</g>`;
  const whiskers =
    `<path d="M 66 300 C 98 294 128 300 152 314" fill="none" stroke="${C.yellow}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M 62 318 C 94 314 122 320 144 332" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/>`;
  const nostril = `<path d="M 172 304 C 150 302 146 282 162 276" fill="none" stroke="${C.yellow}" stroke-width="5" stroke-linecap="round"/>`;
  const fang =
    `<path d="M 68 346 C 64 394 74 444 98 494 C 106 450 106 398 100 352 Z" fill="${C.white}" stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<path d="M 76 356 C 74 382 78 408 85 428" fill="none" stroke="${C.red}" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
  let teethLines = '';
  for (let i = 1; i < 8; i++) {
    const x = 96 + i * 26;
    teethLines += `<path d="M ${x} 350 L ${x} 426" stroke="#d8cbbd" stroke-width="2.6"/>`;
  }
  const teeth = 'M 92 352 C 140 372 170 380 200 380 C 230 380 260 372 308 352 L 304 394 C 260 412 230 420 200 420 C 170 420 140 412 96 394 Z';

  const body =
    `<defs>
      <clipPath id="fc"><path d="${outline}"/></clipPath>
      <clipPath id="tc"><path d="${teeth}"/></clipPath>
      <radialGradient id="shade" cx="50%" cy="42%" r="62%">
        <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/>
      </radialGradient>
    </defs>
    <g clip-path="url(#fc)">
      <rect width="400" height="500" fill="${C.red}"/>
      <path d="M 0 0 H 400 V 282 C 330 300 270 322 200 326 C 130 322 70 300 0 282 Z" fill="${C.maroon}"/>
      <path d="M 104 370 H 296 V 470 C 296 486 284 494 268 494 H 132 C 116 494 104 486 104 470 Z" fill="${C.mouth}"/>
      ${eyeRing(122, 228)}${eyeRing(278, 228)}
      ${rosette(200, 240, 152, -25, 25, { scallops: 6 })}
      <path d="${sector(200, 240, 44, -25, 25)}" fill="${C.maroonDeep}"/>
      ${eye(122, 228)}${eye(278, 228)}
      <path d="M 200 238 L 230 304 C 214 312 186 312 170 304 Z" fill="${C.maroonDeep}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
      ${[178, 189, 200, 211, 222].map((x) => `<path d="M 200 248 L ${x} ${x === 200 ? 307 : 302}" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/>`).join('')}
      ${nostril}${mirrorX(nostril)}
      <path d="M 136 320 C 164 332 236 332 264 320" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/>
      ${whiskers}${mirrorX(whiskers)}
      <path d="${teeth}" fill="${C.white}"/>
      <g clip-path="url(#tc)">${teethLines}</g>
      <path d="${teeth}" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M 60 330 C 110 342 150 354 200 354 C 250 354 290 342 340 330 C 336 342 328 350 322 356 C 280 372 240 382 200 382 C 160 382 120 372 78 356 C 72 350 64 342 60 330 Z" fill="${C.red}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M 84 340 C 120 352 160 362 200 362 C 240 362 280 352 316 340" fill="none" stroke="${C.yellow}" stroke-width="2.6" stroke-linecap="round"/>
      <rect width="400" height="500" fill="url(#shade)"/>
    </g>
    <path d="${outline}" fill="none" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
    ${fang}${mirrorX(fang)}`;
  return svg(400, 500, body, scale);
}

// ------------------------------------------------------------------ jaw
// Its top edge (y = 0) sits at face y = 380.
export function jawSVG(scale = 2.5) {
  const tongue = 'M 172 44 C 168 100 172 170 186 214 C 192 236 208 236 214 214 C 228 170 232 100 228 44 C 216 52 184 52 172 44 Z';
  let lines = '';
  for (let i = 1; i < 7; i++) {
    const x = 112 + i * 25;
    lines += `<path d="M ${x} 8 L ${x} 74" stroke="#d8cbbd" stroke-width="2.6"/>`;
  }
  const teeth = 'M 112 16 C 150 30 175 38 200 38 C 225 38 250 30 288 16 L 284 52 C 250 66 225 72 200 72 C 175 72 150 66 116 52 Z';
  const body =
    `<defs><clipPath id="jt"><path d="${teeth}"/></clipPath></defs>
    <path d="M 104 10 C 150 30 175 38 200 38 C 225 38 250 30 296 10 C 304 70 292 130 264 178 C 248 206 226 222 200 224 C 174 222 152 206 136 178 C 108 130 96 70 104 10 Z" fill="${C.red}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 150 132 C 170 160 230 160 250 132" fill="none" stroke="${C.yellow}" stroke-width="4" stroke-linecap="round"/>
    <path d="M 166 170 C 184 188 216 188 234 170" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/>
    <path d="${teeth}" fill="${C.white}"/>
    <g clip-path="url(#jt)">${lines}</g>
    <path d="${teeth}" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 114 52 C 150 66 175 74 200 74 C 225 74 250 66 286 52 C 284 64 280 74 274 82 C 250 98 225 104 200 104 C 175 104 150 98 126 82 C 120 74 116 64 114 52 Z" fill="${C.redDeep}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 128 66 C 160 80 180 86 200 86 C 220 86 240 80 272 66" fill="none" stroke="${C.yellow}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${tongue}" fill="${C.red}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="${tongue}" transform="translate(200 130) scale(.78) translate(-200 -130)" fill="none" stroke="${C.yellow}" stroke-width="4"/>
    <path d="M 200 62 C 198 120 200 170 200 206" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/>`;
  return svg(400, 250, body, scale);
}

// ------------------------------------------------------------------ crown
// Base of the flames at (350, 690); that point sits behind the face at face y = 120.
export function crownSVG(scale = 2) {
  let back = '', front = '';
  const nb = 8;
  for (let i = 0; i < nb; i++) {
    const t = i / (nb - 1) - 0.5;
    back += flame({ x: 350 + t * 370, y: 690, angle: t * 24, len: 610 - Math.abs(t) * 230, width: 104, bend: t * 0.1, wave: 0.045, phase: i * 1.3, kind: 'yellow' });
  }
  const nf = 7;
  for (let i = 0; i < nf; i++) {
    const t = i / (nf - 1) - 0.5;
    front += flame({ x: 350 + t * 330, y: 690, angle: t * 22, len: 590 - Math.abs(t) * 250, width: 86, bend: t * 0.09 + (i % 2 ? 0.03 : -0.03), wave: 0.05, phase: i * 2.1 + 1, kind: 'red' });
  }
  return svg(700, 700, back + front, scale);
}

// ------------------------------------------------------------------ side "ear"
// Left side piece. The ear rosette's centre is (380, 360); flames fan out to the left and up.
export function earSVG(scale = 2) {
  const cx = 380, cy = 360;
  let back = '', front = '';
  const ya = [-104, -82, -60, -38, -16];
  ya.forEach((a, i) => {
    const b = polar(cx, cy, 34, a);
    back += flame({ x: b[0], y: b[1], angle: a, len: 330 - Math.abs(a + 60) * 0.9, width: 96, bend: 0.1, wave: 0.04, phase: i * 1.7, kind: 'yellow' });
  });
  const ra = [-94, -71, -49, -27];
  ra.forEach((a, i) => {
    const b = polar(cx, cy, 30, a);
    front += flame({ x: b[0], y: b[1], angle: a, len: 315 - Math.abs(a + 60) * 0.9, width: 80, bend: 0.11, wave: 0.045, phase: i * 2.3 + 0.6, kind: 'red' });
  });
  const rx = 72, ry = 84;
  let scallops = '';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    scallops += `<circle cx="${r1(cx + Math.cos(a) * rx)}" cy="${r1(cy + Math.sin(a) * ry)}" r="11" fill="${C.white}" stroke="${C.ink}" stroke-width="2.4"/>`;
  }
  let spokes = '';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    spokes += `<path d="M ${r1(cx + c * rx * 0.6)} ${r1(cy + s * ry * 0.6)} L ${r1(cx + c * rx * 0.8)} ${r1(cy + s * ry * 0.8)}" stroke="#b9481a" stroke-width="2.2"/>`;
  }
  let hatch = '';
  for (let k = -60; k <= 60; k += 14) {
    hatch += `<path d="M ${cx + k - 40} ${cy - 40} L ${cx + k + 40} ${cy + 40}" stroke="${C.redDeep}" stroke-width="2.4"/>`;
    hatch += `<path d="M ${cx + k + 40} ${cy - 40} L ${cx + k - 40} ${cy + 40}" stroke="${C.redDeep}" stroke-width="2.4"/>`;
  }
  const disc =
    `<defs><clipPath id="ec"><ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.5}" ry="${ry * 0.5}"/></clipPath></defs>` +
    scallops +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.white}"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.84}" ry="${ry * 0.84}" fill="${C.ink}"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.8}" ry="${ry * 0.8}" fill="${C.yellow}"/>` + spokes +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.6}" ry="${ry * 0.6}" fill="${C.green}"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.5}" ry="${ry * 0.5}" fill="${C.red}"/>` +
    `<g clip-path="url(#ec)">${hatch}</g>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.5}" ry="${ry * 0.5}" fill="none" stroke="${C.ink}" stroke-width="2.4"/>`;
  return svg(480, 520, back + front + disc, scale);
}
