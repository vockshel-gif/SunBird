/* Pop-up book data: the photo pieces, colour grades and attractions of each spread. They live in
   data/book.json, which the editor (editor/) writes; index.html reads them here. index.html keeps the
   book itself: its pages, the pop-up layers (their sizes are what keeps the book clip-free) and the
   moving parts (sky, clouds, sun, plane + PULL tab, Day sign, cart flap).

   A piece, in spread px (book px, the same as a card's own px):
     x  its left edge, measured from the fold (negative = on the left page)
     y  how far its bottom sits above the layer's glue line
     w, h  its size on the card
     layer  which pop-up layer it stands on (0 = sky, at the back), mode 'card' (printed on the
     layer's card) or 'float' (a paper piece d px in front of it, on a hinged spacer).
   A piece that crosses the fold is cut there, like the skyline: each page's half of the layer
   carries its own part. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var EDIT = Q.get('edit') === '1';      // inside the editor's live preview
  var NS = 'http://www.w3.org/2000/svg';
  /* Phones and tablets get the light book (index.html, LITE): the same pop-ups, drawn far cheaper.
     ?lite=1 forces it on (to try it on a computer), ?lite=0 off. Never in the editor. */
  var LITE = (function () {
    if (EDIT) return false;
    var q = Q.get('lite');
    if (q === '1' || q === '0') return q === '1';
    var mm = window.matchMedia;
    var coarse = !!(mm && mm('(pointer: coarse)').matches && !mm('(any-pointer: fine)').matches);
    var small = Math.min(screen.width || 9999, screen.height || 9999) < 600;
    return coarse || small;
  })();
  /* The website's copy (tools/publish_site.py) also carries half-size cut-outs in cutouts-m/: the
     light book uses those, they are a quarter of the pixels to load and decode. */
  var MOBILE_IMAGES = LITE && document.documentElement.getAttribute('data-mimg') === '1';

  /* in the editor's preview (and its check), the editor hands over its working copy, saved or not */
  function host() {
    try { return window.parent !== window && window.parent.PopupEditor ? window.parent.PopupEditor : null; } catch (e) { return null; }
  }
  function load() {
    var h = host();
    if (h && h.bookFor) return Promise.resolve(h.bookFor(window));
    var alt = /^[a-z0-9-]{1,40}$/.test(Q.get('data') || '') ? Q.get('data') : 'book';   // ?data=name: data/name.json (for checks)
    return fetch('data/' + alt + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (b) { if (!b) console.warn('popup book: data/book.json did not load, the book shows no photo pieces'); return b; });
  }

  /* ---------- colour grades ----------
     exposure, contrast, saturation, warmth: -100..100, 0 = as cut. All four are linear in the
     colour values, so one grade is one SVG colour matrix (in sRGB, like the eye judges it). */
  function neutral(g) { return !g || !(g.exposure || g.contrast || g.saturation || g.warmth); }
  function compose(A, B) {   // A after B, 3 x 4 affine matrices (last column = offset)
    var M = [];
    for (var i = 0; i < 3; i++) {
      M.push([]);
      for (var j = 0; j < 4; j++) {
        var v = j === 3 ? A[i][3] : 0;
        for (var k = 0; k < 3; k++) v += A[i][k] * B[k][j];
        M[i].push(v);
      }
    }
    return M;
  }
  function gradeMatrix(g) {
    g = g || {};
    var e = Math.pow(2, (g.exposure || 0) / 100),            // +-1 stop
        c = 1 + (g.contrast || 0) / 100 * 0.6,
        s = 1 + (g.saturation || 0) / 100,
        w = (g.warmth || 0) / 100;
    var M = [[e, 0, 0, 0], [0, e, 0, 0], [0, 0, e, 0]];
    M = compose([[c, 0, 0, 0.5 * (1 - c)], [0, c, 0, 0.5 * (1 - c)], [0, 0, c, 0.5 * (1 - c)]], M);
    var L = [0.2126, 0.7152, 0.0722], S = [];
    for (var i = 0; i < 3; i++) S.push([L[0] * (1 - s) + (i === 0 ? s : 0), L[1] * (1 - s) + (i === 1 ? s : 0), L[2] * (1 - s) + (i === 2 ? s : 0), 0]);
    M = compose(S, M);
    M = compose([[1 + 0.1 * w, 0, 0, 0.02 * w], [0, 1 + 0.015 * w, 0, 0], [0, 0, 1 - 0.13 * w, -0.01 * w]], M);
    return M;
  }
  function matrixValues(g) {
    var M = gradeMatrix(g), v = [];
    M.forEach(function (r) { v.push(r[0], r[1], r[2], 0, r[3]); });
    v.push(0, 0, 0, 1, 0);
    return v.map(function (n) { return +n.toFixed(5); }).join(' ');
  }
  var defs = null;
  /* the filter for one grade: made (or updated) in a hidden SVG; '' when the grade changes nothing,
     unless keep (the editor keeps a filter on everything it may grade, so a slider never rebuilds) */
  function filterFor(id, g, keep) {
    if (neutral(g) && !keep) return '';
    if (!defs) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      defs = document.createElementNS(NS, 'defs');
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }
    var f = document.getElementById(id);
    if (!f) {
      f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', id);
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.appendChild(document.createElementNS(NS, 'feColorMatrix'));
      defs.appendChild(f);
    }
    f.firstChild.setAttribute('type', 'matrix');
    f.firstChild.setAttribute('values', matrixValues(g));
    return 'url(#' + id + ')';
  }

  /* a piece's own filter (its grade) set inline replaces the stylesheet's card texture (index.html,
     body.card), so the texture goes back on after it */
  function withCard(f) { return f && document.body.classList.contains('card') ? f + ' url(#card)' : f; }

  /* ---------- pieces ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function srcOf(pc) {   // url: the editor's unsaved cut
    if (pc.url) return pc.url;
    var s = String(pc.src || '');
    if (MOBILE_IMAGES) s = s.replace(/^cutouts\//, 'cutouts-m/');
    return s + (pc.v ? '?v=' + pc.v : '');
  }
  function num(v) { return +(+v).toFixed(2); }
  // a colour from the data, as a safe CSS colour (#rgb or #rrggbb, else a neutral grey)
  function colour(c) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '') ? c : '#C8CED6'; }
  /* Paper shapes the book draws itself, placed like photos: a cloud (the #cloud shape with the
     smooth #cut edge) and a sun (two stacked paper discs, the small one 5 px further out, with a
     soft shadow on the big one). Their box includes a 7 px margin for the white edge, drawn 1:1. */
  var DECOR = { cloud: 1, sun: 1 };
  function decorArt(pc, part) {
    var w = num(pc.w), h = num(pc.h), p = 7;
    if (pc.kind === 'cloud')
      return '<use href="#cloud" x="' + p + '" y="' + p + '" width="' + num(w - 2 * p) + '" height="' + num(h - 2 * p) + '" filter="url(#cut)"/>';
    var c = (pc.colors || ['#FF8A3D', '#FFB866']).map(colour), r = Math.max(4, Math.min(w, h) / 2 - p);
    if (part === 'inner')
      return '<filter id="bk-lift"><feDropShadow dx="-3" dy="3" stdDeviation="2" flood-opacity=".3"/></filter>' +
        '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + num(r * 2 / 3) + '" fill="' + c[1] + '" filter="url(#bk-lift)"/>';
    return '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + num(r) + '" fill="' + c[0] + '" filter="url(#cut)"/>';
  }
  /* A piece that moves with the day's PULL tab (data pull: { x, y } how far it goes, y up like its own
     y; r0, r1 its tilt in degrees before and after): it flies along a gentle curve through C to E,
     the curve Day 1's plane has always taken (C is 0.594 of the way across and a little up). In css
     px from where it stands, y down. */
  function pullPath(pc) {
    var p = pc.pull || {}, ex = +p.x || 0, ey = -(+p.y || 0);
    return { ex: ex, ey: ey, cx: ex * 0.594, cy: -0.149 * ey, r0: p.r0 != null ? +p.r0 : 2, r1: p.r1 != null ? +p.r1 : 9 };
  }
  // one half's copy of a piece: left in that card's px; cl/cr cut off what lies past the fold
  // (its grade is added in afterBuild, to the printed copy only)
  function pieceHTML(pc, side, left, cl, cr, part) {
    var P = pc.pull && pullPath(pc);
    var box = 'data-pid="' + esc(pc.id) + '" data-side="' + side + '"' + (part ? ' data-part="' + part + '"' : '') +
      (P ? ' data-pull="' + [P.ex, P.ey, P.cx, P.cy, P.r0, P.r1].map(num).join(',') + '"' : '') +
      ' style="left:' + num(left) + 'px;width:' + num(pc.w) + 'px;height:' + num(pc.h) + 'px' +
      (pc.y ? ';bottom:' + num(pc.y) + 'px' : '') + (cl || cr ? ';clip-path:inset(0 ' + num(cr) + 'px 0 ' + num(cl) + 'px)' : '') + '"';
    if (DECOR[pc.kind]) return '<svg ' + box + ' viewBox="0 0 ' + num(pc.w) + ' ' + num(pc.h) + '" aria-hidden="true">' + decorArt(pc, part) + '</svg>';
    if (pc.kind === 'flap') {   // lift-the-flap: the photo is a lid hinged on its right edge, a note under it
      var u = pc.under || {}, src = esc(srcOf(pc));
      return '<div class="flap" ' + box + ' title="Lift the flap"><div class="under"><b>' + esc(u.kicker) + '</b><span>' + esc(u.text).replace(/\n/g, '<br>') + '</span></div>' +
        '<img class="lid lid-front" src="' + src + '" alt="' + esc(pc.alt || pc.name) + '" draggable="false"><img class="lid lid-back" src="' + src + '" alt="" draggable="false"></div>';
    }
    return '<img ' + box + ' src="' + esc(srcOf(pc)) + '" alt="' + esc(pc.alt || pc.name) + '" draggable="false">';
  }
  /* where a piece sits on one half of its layer: null if none of it is on that half */
  function onHalf(pc, side, w) {
    var x0 = pc.x, x1 = pc.x + pc.w;
    if (side === 'L' ? x0 >= -0.5 : x1 <= 0.5) return null;
    return { left: side === 'L' ? w + x0 : x0, cl: side === 'R' ? Math.max(0, -x0) : 0, cr: side === 'L' ? Math.max(0, x1) : 0 };
  }
  /* Put each spread's pieces on its layers' cards, before index.html builds them. Pieces on a card
     are printed in list order (later = on top), between the card's own art (html) and anything that
     sits on top of them (top: e.g. the cart flap). Floating pieces join the card's own floats. In the
     editor every piece is put on both halves (the part past the fold cut away), so it can be dragged
     across the fold without rebuilding the book. */
  function applyPieces(SPREADS, book) {
    ((book && book.spreads) || []).forEach(function (sd, si) {
      var sp = SPREADS[si];
      if (!sp) return;
      (sd.pieces || []).forEach(function (pc) {
        var layer = sp.layers[pc.layer];
        if (!layer || pc.hidden) return;
        var decor = DECOR[pc.kind];
        ['L', 'R'].forEach(function (side) {
          var p = layer[side], at = onHalf(pc, side, p.w);
          if (!at && !EDIT) return;
          at = at || { left: side === 'L' ? p.w + pc.x : pc.x, cl: side === 'R' ? pc.w : 0, cr: side === 'L' ? pc.w : 0 };
          var html = pieceHTML(pc, side, at.left, at.cl, at.cr);
          // clouds and suns always float, and only shade their own card (like the hand-placed ones did)
          if (pc.mode === 'float' || decor) {
            var fl = p.float = p.float || [], d = pc.d || (pc.kind === 'sun' ? 4 : 6), cast = decor ? !!pc.cast : pc.cast !== false;
            fl.push({ d: d, cast: cast, html: html, pid: pc.id });
            if (pc.kind === 'sun') fl.push({ d: d + 5, cast: false, html: pieceHTML(pc, side, at.left, at.cl, at.cr, 'inner'), pid: pc.id, part: 'inner' });
          } else p.html = (p.html || '') + html;
        });
      });
    });
    SPREADS.forEach(function (sp) {
      sp.layers.forEach(function (layer) {
        ['L', 'R'].forEach(function (side) {
          var p = layer[side];
          if (p.top) { p.html = (p.html || '') + p.top; delete p.top; }
        });
      });
    });
  }
  /* after index.html has built the cards, the grades: each piece's on its printed copies, and one
     over a whole spread (its cards and floats). Only where a grade changes something, and never on
     the shading copies, plain backs or shadows (they are drawn black anyway): a filter makes every
     repaint of its card slower. */
  function afterBuild(SPREADS, book) {
    ((book && book.spreads) || []).forEach(function (sd, si) {
      var sp = SPREADS[si];
      if (!sp) return;
      (sd.pieces || []).forEach(function (pc) {
        var f = filterFor('bk-g-' + pc.id, pc.grade);
        if (f) document.querySelectorAll('.vp > .face.front:not(.shade) > [data-pid="' + pc.id + '"]').forEach(function (el) { el.style.filter = withCard(f); });
      });
      var fs = filterFor('bk-s-' + si, sd.grade);
      if (!fs) return;
      sp.layers.forEach(function (layer) {
        ['L', 'R'].forEach(function (side) {
          [layer[side]].concat(layer[side].float || []).forEach(function (c) { if (c.el) c.el.children[0].style.filter = fs; });
        });
      });
    });
  }

  /* ---------- attractions ----------
     Each day's Attractions drawer: { name, tag: in | opt | see, text, pic: { src, w, style } or
     { kind: 'boat' }, scene: one of SCENES (or sky / ground / sun of its own) } */
  var SCENES = {
    day:    { sky: 'linear-gradient(#A9DBF2, #EEF5F4)', ground: '#D9C9A2' },
    lake:   { sky: 'linear-gradient(#BFE2F0, #F4EEE2)', ground: '#7EA6B4' },
    sunset: { sky: 'linear-gradient(#FFB989, #FFE9CF)', ground: '#A9C987', sun: true },
    dusk:   { sky: 'linear-gradient(#F6A98A, #FCE3CC)', ground: '#C9B48C' },
    sea:    { sky: 'linear-gradient(#FF9E73, #FFE0BD)', ground: '#3E7FA8', sun: true },
    evening:{ sky: 'linear-gradient(#B9B6E6, #F6E3D6)', ground: '#8F9BAA' },
    hills:  { sky: 'linear-gradient(#BFE6F5, #EAF6EC)', ground: '#7FB07A' }
  };
  var FADE_SIDES = '-webkit-mask-image:linear-gradient(to right, transparent, #000 22%, #000 78%, transparent);mask-image:linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)';
  function picHTML(pic, builtins) {
    if (!pic) return '';
    if (pic.kind) return (builtins && builtins[pic.kind]) || '';
    return '<img src="' + esc(srcOf(pic)) + '" alt="" draggable="false" style="width:' + num(pic.w || 120) + 'px' +
      (pic.h ? ';height:' + num(pic.h) + 'px;object-fit:cover;object-position:' + esc(pic.pos || '50% 100%') : '') +
      (pic.fade ? ';' + FADE_SIDES : '') + (pic.round ? ';border-radius:3px' : '') + '">';
  }
  var BUILTINS = {};   // pictures drawn by index.html itself (the boat), handed over by applyAttractions
  function attraction(a, builtins) {
    var sc = SCENES[a.scene] || SCENES.day;
    builtins = builtins || BUILTINS;
    return { name: esc(a.name), tag: a.tag in { in: 1, opt: 1, see: 1 } ? a.tag : 'in', text: esc(a.text),
             sky: a.sky || sc.sky, ground: a.ground || sc.ground, sun: a.sun != null ? a.sun : !!sc.sun, pic: picHTML(a.pic, builtins) };
  }
  /* each spread's day gets the drawer items from the data (index.html's own list is the fallback) */
  function applyAttractions(SEE_DO, book, builtins) {
    BUILTINS = builtins || {};
    ((book && book.spreads) || []).forEach(function (sd) {
      if (sd.day && sd.attractions && sd.attractions.length)
        SEE_DO[sd.day] = { items: sd.attractions.map(function (a) { return attraction(a, builtins); }) };
    });
  }

  /* ---------- the editor's preview ---------- */
  if (EDIT) {
    var st = document.createElement('style');
    st.textContent = 'body.edit header, body.edit .info, body.edit .tune-btn, body.edit .cam { display:none !important; }' +
      'body.edit .stage { cursor:default; }' +
      'body.edit .vp img[data-pid], body.edit .vp svg[data-pid] * { pointer-events:auto; }';
    document.head.appendChild(st);
    document.body.classList.add('edit');
  }
  function ready(api) {
    var h = host();
    if (h && h.bookReady) h.bookReady(window, api);
  }

  window.PopupBookData = { load: load, edit: EDIT, lite: LITE, mobileImages: MOBILE_IMAGES, applyPieces: applyPieces, afterBuild: afterBuild, applyAttractions: applyAttractions,
                           attraction: attraction, filterFor: filterFor, gradeMatrix: gradeMatrix, onHalf: onHalf, SCENES: SCENES, ready: ready,
                           colour: colour, decorArt: decorArt, DECOR: DECOR, pullPath: pullPath, pieceHTML: pieceHTML,
                           withCard: withCard };
})();
