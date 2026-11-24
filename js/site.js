/* Sunbird Lanka Tours – menu, slider and enquiry forms */
(function () {
  "use strict";
  var d = document, body = d.body;

  // ---- photos fade in as they arrive instead of popping in. Only photos still on their way when the page starts
  // get this: lazy ones and those waiting for a data-src (menu sheets, slides). A photo that is already there shows
  // at once, and the big first-screen photos are left alone (the page transition waits for those itself). A photo
  // with its own animation is left alone too. It shows once decoded, so the fade never stutters.
  (function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var skip = ".th-bg, .pt, .hero-home, .hl-logo, .ab-open-bg, .tl-frame";
    d.querySelectorAll('img[loading="lazy"], img[data-src]').forEach(function (img) {
      if ((img.complete && (img.naturalWidth || img.getAttribute("src"))) || img.closest(skip)) return;
      if (window.getComputedStyle(img).animationName !== "none") return;
      img.classList.add("img-wait");
      var shown = false;
      var show = function () {
        if (shown) return;
        shown = true;
        img.classList.remove("img-wait");
        img.classList.add("img-in");
        setTimeout(function () { img.classList.remove("img-in"); }, 900);
      };
      var arrive = function () {
        img.removeEventListener("load", arrive);
        if (img.decode) img.decode().then(show, show); else show();
      };
      img.addEventListener("load", arrive);
      img.addEventListener("error", show);
    });
  })();

  // ---- the menu (build.py nav). Phones: the menu button opens the menu over the page, and the + beside a menu
  // word folds its lines open. Big screens: pointing at a menu word opens its sheet under the header. There is one
  // paper background for all the sheets; moving from word to word, the sheet's lines slide across from that side
  // and the background grows or shrinks to fit. The thin line under the menu words glides to the word you point
  // at and goes back to the section you are in. Pointing at a line in the sheet shows its photo. The photos only
  // load once the pointer comes into the header, so pages where nobody opens the menu don't download them.
  var toggle = d.querySelector(".nav-toggle"), nav = d.getElementById("nav"), siteHdr = d.querySelector(".site-header");
  var sheetClose = function () {}, sheetHush = function () {};
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  d.querySelectorAll(".sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentNode.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  if (nav) {
    nav.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (a && !e.defaultPrevented) {
        body.classList.remove("nav-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        // the line under the menu words stays on the word whose page is opening, instead of gliding back to the
        // section you are leaving while the page fades out (not for links opening in a new tab: you stay here)
        var away = a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0;
        sheetClose(away ? null : a);
        // the next page opens on its own content, not on the sheet of the word the pointer is still resting on
        // (see "hush" below)
        try { sessionStorage.setItem("sbNavHush", String(Date.now())); } catch (err) { /* the sheet may open there */ }
        sheetHush();
      }
    });
  }
  // the language button shows the chosen language's code (GTranslate keeps the choice in its "googtrans" cookie)
  var langCode = d.querySelector(".lang-code");
  if (langCode) {
    var setLang = function (code) { if (code) langCode.textContent = code.split("-")[0].toUpperCase(); };
    var gt = /(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/.exec(d.cookie);
    setLang(gt && decodeURIComponent(gt[1]));
    langCode.parentNode.addEventListener("change", function (e) { setLang((e.target.value || "").split("|")[1]); });
  }
  if (siteHdr && nav) (function () {
    var wide = window.matchMedia("(min-width: 901px)"), canHover = window.matchMedia("(hover: hover)");
    var words = [].slice.call(nav.querySelectorAll(":scope > ul > li"));
    var here = nav.querySelector(":scope > ul > li.here");
    var bg = siteHdr.querySelector(".mega-bg"), ink = siteHdr.querySelector(".nav-ink"), scrim = d.querySelector(".mega-scrim");
    var cur = null, tIn = 0, tOut = 0, tRoll = 0, tPaper = 0, quiet = false, warmed = false, openY = 0;
    // "hush": after a click in the menu the pointer usually still rests on the word you clicked, on the new page
    // too. The page then shows its own content: no sheet opens until the pointer has left the menu words and
    // comes back to one. (The click leaves a time in sessionStorage "sbNavHush"; it counts for 20 s.)
    var hush = false;
    try {
      hush = Date.now() - (+sessionStorage.getItem("sbNavHush") || 0) < 20000;
      sessionStorage.removeItem("sbNavHush");
    } catch (err) { /* no hush */ }
    sheetHush = function () { hush = true; };
    // the pointer is off the menu words: measured, not taken from the element under it, because the arrival
    // screen of the page transition lies over everything at first
    d.addEventListener("mousemove", function (e) {
      if (!hush) return;
      var on = words.some(function (li) {
        var r = li.querySelector(".top").getBoundingClientRect();
        return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
      });
      if (!on) hush = false;
    }, { passive: true });
    var load = function (imgs) {
      [].forEach.call(imgs, function (img) {
        if (!img.hasAttribute("data-src")) return;
        if (img.hasAttribute("data-srcset")) img.setAttribute("srcset", img.getAttribute("data-srcset"));
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
        img.removeAttribute("data-srcset");
      });
    };
    // the line under a word: 100px wide in the CSS, stretched to the word's width. When it wasn't showing, it
    // grows out from the middle of the word instead of sliding in from wherever it was last.
    var inkTo = function (li) {
      if (!ink) return;
      if (!li || !wide.matches) { ink.classList.remove("on"); return; }
      var a = li.querySelector(".top"), cs = window.getComputedStyle(a), r = a.getBoundingClientRect(), h = siteHdr.getBoundingClientRect();
      var pl = parseFloat(cs.paddingLeft) || 0, w = r.width - pl - (parseFloat(cs.paddingRight) || 0), x = r.left - h.left + pl;
      if (!ink.classList.contains("on")) {
        ink.style.transition = "none";
        ink.style.transform = "translate3d(" + (x + w / 2).toFixed(1) + "px,0,0) scaleX(0)";
        void ink.offsetWidth;
        ink.style.transition = "";
      }
      ink.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0) scaleX(" + (w / 100).toFixed(3) + ")";
      ink.classList.add("on");
    };
    // the sheet you leave keeps "was" while it goes: 0.45 s sliding aside to the next one, 0.75 s rolling up on a close
    var leave = function (li, ms) {
      li.classList.remove("on");
      li.classList.add("was");
      clearTimeout(li._was);
      li._was = setTimeout(function () { li.classList.remove("was"); }, ms || 450);
    };
    var show = function (li) {
      clearTimeout(tIn);
      clearTimeout(tOut);
      if (li === cur) return;
      var pg = li.querySelector(".mega-pg");
      if (!pg) { close(); inkTo(li); return; }
      clearTimeout(tRoll);
      clearTimeout(tPaper);
      siteHdr.classList.remove("closing");
      var prev = cur;
      siteHdr.style.setProperty("--mdx", prev ? (words.indexOf(li) > words.indexOf(prev) ? "36px" : "-36px") : "0px");
      siteHdr.style.setProperty("--mdy", prev ? "0px" : "-14px");
      if (prev) leave(prev);
      if (!li.classList.contains("was") && pg._pick) pg._pick(pg._home);   // a fresh sheet starts on this page's line, or its first
      li.classList.remove("was");
      void window.getComputedStyle(pg).transform;   // let it start from its side before it slides in
      load(pg.querySelectorAll(".mp-ph img"));
      if (!prev) openY = window.scrollY;
      cur = li;
      li.classList.add("on");
      siteHdr.classList.add("mx", "is-open");
      if (bg) bg.style.height = pg.offsetHeight + "px";
      if (scrim) scrim.classList.add("on");
      inkTo(li);
    };
    var close = function () {
      clearTimeout(tIn);
      aimAt = null;
      if (cur) {
        siteHdr.style.setProperty("--mdx", "0px");
        siteHdr.classList.add("closing");   // the roll-up (site.css)
        clearTimeout(tRoll);
        tRoll = setTimeout(function () { siteHdr.classList.remove("closing"); }, 750);
        leave(cur, 750);
        cur = null;
        // the header keeps the paper colour until the paper has mostly rolled up, then fades back to its own look
        clearTimeout(tPaper);
        tPaper = setTimeout(function () { siteHdr.classList.remove("is-open"); }, 380);
        if (bg) bg.style.height = "0px";
        if (scrim) scrim.classList.remove("on");
      }
      inkTo(here);
    };
    // closing after a click in the menu: the word the link sits under is where you are going, so it becomes "here"
    sheetClose = function (from) {
      var li = from ? words.filter(function (w) { return w.contains(from); })[0] : null;
      if (li && li !== here) {
        if (here) here.classList.remove("here");
        li.classList.add("here");
        here = li;
      }
      close();
    };
    // While a sheet is open, the way down to one of its lines often crosses another menu word (from "About us"
    // down to "MICE & events" passes over "Travel guide"). So where the pointer has been in the last moment is
    // kept: heading down, into the open sheet, a word it passes over only takes over if the pointer stops on it;
    // moving along the words (or back up to them) switches as quickly as before.
    var trail = [], aimAt = null, aimQuick = false;
    var heading = function () {
      if (trail.length < 2) return false;
      var a = trail[0], b = trail[trail.length - 1], dy = b[1] - a[1];
      return dy >= 3 && dy > Math.abs(b[0] - a[0]) * 0.1;
    };
    var aim = function () {
      if (!aimAt) return;
      var quick = !heading();
      if (quick && aimQuick) return;   // already about to switch
      aimQuick = quick;
      clearTimeout(tIn);
      var li = aimAt;
      tIn = setTimeout(function () { aimAt = null; show(li); }, quick ? 70 : 240);
    };
    siteHdr.addEventListener("mousemove", function (e) {
      var now = Date.now();
      trail.push([e.clientX, e.clientY, now]);
      while (trail.length > 2 && now - trail[0][2] > 120) trail.shift();
      aim();
    });
    words.forEach(function (li) {
      var a = li.querySelector(".top");
      // a short wait before switching, so that brushing past a word doesn't open it
      li.addEventListener("mouseenter", function () {
        if (!wide.matches || !canHover.matches || hush) return;
        clearTimeout(tIn);
        aimAt = null;
        if (cur && cur !== li) { aimAt = li; aimQuick = false; aim(); }
        else tIn = setTimeout(function () { show(li); }, cur ? 70 : 90);
      });
      li.addEventListener("mouseleave", function () { clearTimeout(tIn); aimAt = null; hush = false; });
      a.addEventListener("focus", function () { if (wide.matches && !quiet) show(li); });
      // touch screens: the first tap opens the sheet, a second tap follows the link
      a.addEventListener("click", function (e) {
        if (wide.matches && !canHover.matches && li.querySelector(".mega-pg") && cur !== li) { e.preventDefault(); show(li); }
      });
    });
    nav.querySelectorAll(".mega-pg").forEach(function (pg) {
      var rows = [].slice.call(pg.querySelectorAll(".mp-row")), imgs = pg.querySelectorAll(".mp-ph > *");
      pg._home = Math.max(0, rows.findIndex(function (r) { return r.pathname === location.pathname && !r.hash; }));
      pg._pick = function (k) {
        rows.forEach(function (r, n) { r.classList.toggle("on", n === k); });
        [].forEach.call(imgs, function (im, n) { im.classList.toggle("on", n === k); });
      };
      rows.forEach(function (r, k) {
        r.addEventListener("mouseenter", function () { pg._pick(k); });
        r.addEventListener("focus", function () { pg._pick(k); });
      });
    });
    siteHdr.addEventListener("mouseenter", function () {
      clearTimeout(tOut);
      if (!warmed && wide.matches) { warmed = true; load(nav.querySelectorAll(".mp-ph img:first-child")); }
    });
    siteHdr.addEventListener("mouseleave", function () {
      clearTimeout(tIn);
      if (cur && wide.matches && canHover.matches) tOut = setTimeout(close, 200);
    });
    siteHdr.addEventListener("focusout", function (e) { if (cur && !siteHdr.contains(e.relatedTarget)) close(); });
    d.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !cur) return;
      var a = cur.querySelector(".top");
      close();
      quiet = true; a.focus(); quiet = false;
    });
    d.addEventListener("click", function (e) { if (cur && !siteHdr.contains(e.target)) close(); });
    // scrolling puts the sheet away, back to the page: any turn of the mouse wheel or trackpad (even where the page
    // turns something itself, like the home page's tour wheel), or the page moving a little way by any other means
    // (keys, the scroll bar, a finger)
    window.addEventListener("wheel", function (e) { if (cur && (e.deltaY || e.deltaX)) close(); }, { passive: true });
    window.addEventListener("scroll", function () { if (cur && Math.abs(window.scrollY - openY) > 24) close(); }, { passive: true });
    var fit = function () {
      if (cur && bg) bg.style.height = cur.querySelector(".mega-pg").offsetHeight + "px";
      if (ink) { ink.classList.remove("on"); inkTo(cur || here); }
    };
    window.addEventListener("resize", fit);
    if (wide.addEventListener) wide.addEventListener("change", function () { close(); fit(); });
    // the line rests under this page's section once the fonts have given the words their real widths
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(fit); else fit();
  })();

  // ---- home hero: a short looping film over the photo (build.py home_hero). The photo shows first and the
  // film fades in over it once it is really playing. It is not loaded at all for people who have turned motion
  // off, asked to save data or are on 2G/3G mobile data. Tall screens (phones) get the tall cut. The place name
  // in the corner follows the film. It only plays while you can see it: off screen, or covered by the next
  // card of the home page stack (hvState.covered, set by the stack below), it rests so scrolling stays smooth.
  //
  // The film comes in two parts so it can start quickly: part 1 (the first 10.6 s, about a quarter of the
  // film) downloads the moment the page opens and starts playing as soon as it has arrived; part 2 downloads
  // while part 1 plays. Each part is played from memory, so it never stops to wait for the network. There are
  // two video layers: one plays while the other waits, paused on its first frame, and takes over instantly
  // when the first one ends (part 1 -> part 2 -> part 1 ...). If part 2 has not arrived by the end of part 1,
  // part 1 dissolves back to its own start (like a cut between shots) and part 2 takes over on a later pass.
  var hv = d.querySelector(".hh-video"), hvState = { seen: true, covered: false }, hvSync = function () {};
  var hvNet = navigator.connection || {};
  // (only the browser's own 2G/3G verdict counts, not its speed guess: Chrome's "downlink" figure is often far
  // too low on a good connection, and a slow one is fine anyway, as part 2 just arrives later)
  var hvSlow = !!hvNet.saveData || /(^|-)(2g|3g)$/.test(hvNet.effectiveType || "");
  if (hv && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !hvSlow) (function () {
    var tall = window.matchMedia("(max-aspect-ratio: 4/5)").matches, rows = [];
    try { rows = JSON.parse(hv.getAttribute("data-files") || "[]"); } catch (err) { rows = []; }
    // [screen, width, height, fps, codec, kbps, part 1, part 2]; the last row for each screen is the plain one
    rows = rows.filter(function (r) { return r[0] === (tall ? "tall" : "wide"); });
    if (!rows.length) return;
    var media = hv.parentNode, vids = [hv, hv.cloneNode(false)];
    media.appendChild(vids[1]);
    // (filmPart / filmReady: which part a layer holds and whether its first frame is ready. Not "part":
    // every element already has a built-in .part)
    vids.forEach(function (v) { v.preload = "auto"; v.filmPart = -1; v.filmReady = false; });
    var row = null, urls = [], cur = 0, curPart = 0, started = false, dissolving = false, dur0 = 0, gen = 0;

    // Which version: the first row this device says it can decode smoothly AND power-efficiently (in hardware)
    var pick = function (done) {
      var mc = navigator.mediaCapabilities, i = 0;
      var next = function () {
        if (i >= rows.length - 1) { done(rows[rows.length - 1]); return; }
        var r = rows[i++], type = 'video/mp4; codecs="' + r[4] + '"';
        if (!hv.canPlayType(type)) { next(); return; }
        if (!mc || !mc.decodingInfo) { done(r); return; }
        mc.decodingInfo({ type: "file", video: { contentType: type, width: r[1], height: r[2], bitrate: r[5] * 1000, framerate: r[3] } })
          .then(function (res) { if (res.supported && res.smooth && res.powerEfficient) done(r); else next(); }, next);
      };
      next();
    };
    // download part k into memory; done(address) ("" when part 2 is missing or could not be fetched)
    var get = function (k, done) {
      var src = row[6 + k];
      if (!src) { done(""); return; }
      if (!window.fetch || !window.URL || !URL.createObjectURL) { done(src); return; }
      fetch(src).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
        .then(function (b) { done(URL.createObjectURL(b)); }, function () { done(k === 0 ? src : ""); });
    };
    // The opening screen (js/hello.js): starting a film layer (the video decoder starting up) holds up every
    // moving thing on screen for a moment, even the moves the graphics card does, and that showed as a stutter
    // in the logo. The film can't be seen under the screen anyway, so while the screen is up a layer waits
    // until it has gone and the hero's words have risen into place (0.6 s more); the film then fades in over
    // the photo as usual. The film still downloads meanwhile.
    var afterHello = function (fn) {
      if (!d.querySelector(".hl")) { fn(); return; }
      d.addEventListener("sbhello:gone", function () { setTimeout(fn, 600); }, { once: true });
    };
    var load = function (v, k) {
      v.filmPart = k; v.filmReady = false;
      afterHello(function () { if (v.filmPart === k && v.getAttribute("src") !== urls[k]) v.src = urls[k]; });
    };
    var play = function (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* refused: the photo stays */ }); };
    hvSync = function () {
      var v = vids[cur];
      if (!started || !v.getAttribute("src")) return;
      if (hvState.seen && !hvState.covered && !d.hidden) play(v); else if (!v.paused) v.pause();
    };
    // make sure the waiting layer holds what comes next: after part 1 that is part 2 if it has arrived,
    // otherwise part 1 again (for the dissolve); after part 2 it is part 1
    var prepare = function () {
      if (dissolving) return;
      var spare = vids[1 - cur], need = curPart === 0 && urls[1] ? 1 : 0;
      if (spare.filmPart !== need) load(spare, need);
    };
    // part 1 -> part 2 -> part 1: the waiting layer shows its first frame and plays as this one ends
    var handOver = function () {
      var old = vids[cur], spare = vids[1 - cur];
      spare.classList.add("show");
      old.classList.remove("show");
      cur = 1 - cur;
      curPart = spare.filmPart;
      hvSync();
      old.currentTime = 0;     // ready for the next time round (it already holds the part that comes next)
      prepare();
    };
    // part 2 is late: part 1 dissolves back into its own beginning
    var dissolve = function () {
      var old = vids[cur], spare = vids[1 - cur];
      if (spare.filmPart !== 0 || !spare.filmReady) return;
      dissolving = true;
      spare.currentTime = 0;
      spare.classList.add("dissolve", "show");
      cur = 1 - cur;
      curPart = 0;
      hvSync();
      setTimeout(function () {
        old.classList.remove("show");
        old.pause();
        spare.classList.remove("dissolve");
        dissolving = false;
        prepare();
      }, 850);
    };
    var begin = function (r) {
      var my = ++gen;
      row = r;
      get(0, function (u0) {
        if (my !== gen) return;
        urls[0] = u0;
        load(vids[0], 0);
        prepare();     // the waiting layer gets part 1 too, ready for the dissolve if part 2 is late
        // part 2 downloads straight after part 1, while part 1 plays
        get(1, function (u1) { if (my !== gen) return; urls[1] = u1; prepare(); });
      });
    };
    // a device that says it can play the 60 fps film but then does not keep up with it (it stalls, or drops
    // more than 1 frame in 12) is moved to the plain 30 fps version; so is one where a file fails
    var stepDown = function () {
      if (!row || row === rows[rows.length - 1]) return;
      vids.forEach(function (v) { v.pause(); v.classList.remove("show", "ease", "dissolve"); v.filmPart = -1; v.filmReady = false; v.removeAttribute("src"); v.load(); });
      media.classList.remove("hh-live");
      urls.forEach(function (u) { if (u && u.indexOf("blob:") === 0) URL.revokeObjectURL(u); });
      urls = []; cur = 0; curPart = 0; started = false; dissolving = false;
      begin(rows[rows.length - 1]);
    };
    var stalls = 0, seekAt = 0;
    vids.forEach(function (v) {
      v.addEventListener("loadeddata", function () {
        v.filmReady = true;
        if (v.filmPart === 0 && v.duration) dur0 = v.duration;
        if (!started && v === vids[cur]) { started = true; hvSync(); }
      });
      v.addEventListener("playing", function () {
        if (v !== vids[cur] || media.classList.contains("hh-live") || v.classList.contains("show")) return;
        // the very first start: fade in over the photo, then stop drawing the photo underneath
        v.classList.add("ease", "show");
        setTimeout(function () { v.classList.remove("ease"); if (v.classList.contains("show")) media.classList.add("hh-live"); }, 1400);
      });
      v.addEventListener("timeupdate", function () {
        if (v !== vids[cur] || dissolving || curPart !== 0 || !v.duration) return;
        if (v.duration - v.currentTime < 0.9 && vids[1 - cur].filmPart !== 1) dissolve();
      });
      v.addEventListener("ended", function () {
        if (v !== vids[cur] || dissolving) return;
        var spare = vids[1 - cur], next = curPart === 0 && urls[1] ? 1 : 0;
        if (spare.filmPart !== next) load(spare, next);
        if (spare.filmReady) { handOver(); return; }
        spare.addEventListener("loadeddata", function once() {
          spare.removeEventListener("loadeddata", once);
          if (v === vids[cur]) handOver();
        });
      });
      v.addEventListener("error", function () { if (v.getAttribute("src")) stepDown(); });
      v.addEventListener("seeking", function () { seekAt = Date.now(); });
      v.addEventListener("waiting", function () {
        if (v === vids[cur] && media.classList.contains("hh-live") && Date.now() - seekAt > 800 && ++stalls >= 3) stepDown();
      });
    });
    var watch = setInterval(function () {
      if (row === rows[rows.length - 1]) { clearInterval(watch); return; }
      var shown = 0, dropped = 0;
      vids.forEach(function (v) { var q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality(); if (q) { shown += q.totalVideoFrames; dropped += q.droppedVideoFrames; } });
      if (shown > 240 && dropped * 12 > shown) { clearInterval(watch); stepDown(); }
    }, 2000);

    pick(begin);
    // browsers pause muted films in background tabs: start again when the page is back in view
    d.addEventListener("visibilitychange", function () { hvSync(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { hvState.seen = es[0].isIntersecting; hvSync(); })
        .observe(hv.closest(".hero-home"));
    }
    // the place name in the corner: the film's own time is part 1's length plus the time into part 2
    var hvPlace = d.querySelector(".hh-place[data-places]");
    if (hvPlace) {
      var places = JSON.parse(hvPlace.getAttribute("data-places")), label = hvPlace.querySelector("span"), shownName = label.textContent;
      vids.forEach(function (v) {
        v.addEventListener("timeupdate", function () {
          if (v !== vids[cur]) return;
          var t = (curPart === 1 ? dur0 : 0) + v.currentTime, name = places[0][1];
          places.forEach(function (r) { if (t >= r[0]) name = r[1]; });
          if (name === shownName) return;
          shownName = name;
          label.classList.add("swap");
          setTimeout(function () { label.textContent = name; label.classList.remove("swap"); }, 350);
        });
      });
    }
  })();

  // ---- arriving from the home page's tour wheel: the page opens on the same full-screen picture the wheel
  // ended on (put up by the small script at the top of <body>, see build.py); fade it away to reveal this page
  // It only lifts once the pictures are ready: its own photo and the big photo at the top of this page, so it
  // never fades onto an empty dark top that a photo then pops into (at most 1.8 s, then it lifts anyway). The
  // page's own opening movements wait under it until then (html class "landed", site.css).
  var arrival = d.querySelector(".pt-in");
  if (arrival) {
    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      d.documentElement.classList.add("landed");
      arrival.classList.add("done");
      setTimeout(function () { arrival.remove(); d.documentElement.classList.remove("arriving"); }, 1500);
    };
    var ready = function (img) {
      if (!img || !window.Promise) return null;
      return img.decode ? img.decode().catch(function () {}) : null;
    };
    if (window.Promise) {
      var waits = [arrival.querySelector("img"), d.querySelector(".th-bg img, .page-hero img")].map(ready).filter(Boolean);
      waits.push(new Promise(function (done) { setTimeout(done, 350); }));
      Promise.all(waits).then(function () { requestAnimationFrame(reveal); });
      setTimeout(reveal, 1800);
    } else setTimeout(reveal, 350);
  }

  // ---- tour pages: the itinerary, day by day (build.py day_by_day). Days fold open smoothly; the photos
  // move with parallax (see below).
  d.querySelectorAll(".dbd").forEach(function (dbd) {
    var days = [].slice.call(dbd.querySelectorAll(".day")), all = dbd.querySelector(".dbd-all");
    var still = function () { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
    var syncAll = function () {
      if (!all) return;
      var every = days.every(function (x) { return x.open && !x.classList.contains("closing"); });
      all.setAttribute("aria-pressed", every ? "true" : "false");
      all.querySelector(".dbd-all-t").textContent = every ? "Close every day" : "Open every day";
    };
    var setOpen = function (day, open) {
      var box = day.querySelector(".day-body");
      if (day.anim) { day.anim.cancel(); day.anim = null; }
      day.classList.remove("closing");
      if (open === day.open) { syncAll(); return; }
      if (still() || !box.animate) { day.open = open; syncAll(); return; }
      if (open) {
        day.open = true;
        day.anim = box.animate([{ height: "0px", opacity: 0 }, { height: box.offsetHeight + "px", opacity: 1 }],
                               { duration: 460, easing: "cubic-bezier(.2,.7,.2,1)" });
        day.anim.onfinish = function () { day.anim = null; };
      } else {
        day.classList.add("closing");
        day.anim = box.animate([{ height: box.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
                               { duration: 340, easing: "cubic-bezier(.4,0,.2,1)" });
        day.anim.onfinish = function () { day.open = false; day.classList.remove("closing"); day.anim = null; syncAll(); };
      }
      syncAll();
    };
    days.forEach(function (day) {
      day.querySelector("summary").addEventListener("click", function (e) {
        e.preventDefault();
        setOpen(day, !day.open || day.classList.contains("closing"));
      });
      day.addEventListener("toggle", syncAll);   // e.g. opened by the browser's find-in-page
    });
    if (all) all.addEventListener("click", function () {
      var open = all.getAttribute("aria-pressed") !== "true";
      days.forEach(function (day) { setOpen(day, open); });
    });
    // "Colombo · Kandy · …" and links to #day-N open that day and bring it into view
    var goTo = function (id, smooth) {
      var day = id && d.getElementById(id);
      if (!day || days.indexOf(day) < 0) return false;
      setOpen(day, true);
      // arriving on #day-N (back from a place's page) lands on the day at once; "auto" would follow the page's
      // smooth scrolling and glide down from the very top
      day.scrollIntoView({ behavior: smooth && !still() ? "smooth" : "instant", block: "start" });
      return true;
    };
    dbd.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#day-"]');
      if (a && goTo(a.getAttribute("href").slice(1), true)) { e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); }
    });
    if (/^#day-/.test(location.hash)) goTo(location.hash.slice(1), false);

    // ---- the photos, with parallax. On wide screens every day's first photo is a slide in the window beside
    // the days: as you scroll, the next day's photo slides up into the window while the picture inside it moves at
    // half speed, and the current one drifts gently as you read. Opening a day glides the window to its photo.
    // A day's own photos (inside the open day) drift slower than the page too.
    var side = dbd.querySelector(".dbd-side");
    var slides = side ? [].slice.call(side.querySelectorAll(".dbd-slide")) : [];
    var pics = [].slice.call(dbd.querySelectorAll(".day-pic"));
    var capN = side && side.querySelector(".dbd-cap-n"), capW = side && side.querySelector(".dbd-cap-w");
    var countN = side && side.querySelector(".dbd-count-n");
    var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    // pos: the slide showing (glides to whole days); flow: where the reader is, smoothed (drives the drift)
    var spans = [], pos = 0, flow = 0, held = null, heldAt = 0, settleUntil = 0, raf = 0, lastT = 0, shownCap = -1, capTimer = 0;
    // where the reader is: day i plus how far through it (0–1), measured at the upper middle of the screen
    var readerAt = function () {
      var line = window.innerHeight * 0.45;
      var tops = days.map(function (x) { return x.getBoundingClientRect().top; });
      var end = days[days.length - 1].getBoundingClientRect().bottom;
      spans = tops.map(function (t, i) { return (i + 1 < tops.length ? tops[i + 1] : end) - t; });
      for (var i = tops.length - 1; i >= 0; i--) {
        if (tops[i] <= line) return i + clamp((line - tops[i]) / Math.max(spans[i], 1), 0, 0.999);
      }
      return 0;
    };
    var load = function (j) {
      var img = slides[j] && slides[j].querySelector("img[data-src]");
      if (img) {
        // the smaller WebP widths (build.py) go in first, so the browser only fetches one photo
        if (img.getAttribute("data-srcset")) { img.srcset = img.getAttribute("data-srcset"); img.removeAttribute("data-srcset"); }
        img.src = img.getAttribute("data-src"); img.removeAttribute("data-src");
      }
    };
    var caption = function (c, first) {
      days.forEach(function (x, j) { x.classList.toggle("on", j === c); });
      var label = days[c].querySelector(".day-n").textContent, n = (label.match(/\d+/) || [c + 1])[0];
      countN.textContent = (n < 10 ? "0" : "") + n;
      var set = function () { capN.textContent = label; capW.textContent = days[c].dataset.where || ""; side.classList.remove("swapping"); };
      clearTimeout(capTimer);
      if (first || still()) return set();
      side.classList.add("swapping");
      capTimer = setTimeout(set, 200);
    };
    var paint = function () {
      var calm = still(), s = calm ? Math.round(pos) : pos;
      slides.forEach(function (el, j) {
        var dd = j - s;
        if (dd <= -1 || dd >= 1) {
          if (el.away !== (dd < 0)) { el.away = dd < 0; el.style.transform = "translate3d(0," + (dd < 0 ? -100 : 100) + "%,0)"; }
          return;
        }
        el.away = null;
        var u = clamp(flow - j, 0, 1);   // how far through its day you have read: the picture rises slowly
        el.style.transform = "translate3d(0," + (dd * 100).toFixed(3) + "%,0)";
        el.style.setProperty("--py", calm ? "0%" : (-dd * 36 + (0.5 - u) * 16).toFixed(3) + "%");
        el.style.setProperty("--dim", dd < 0 ? (-dd * 0.55).toFixed(3) : "0");
      });
      var c = Math.round(s);
      if (c !== shownCap) { caption(c, shownCap < 0); shownCap = c; }
      [c - 1, c + 1, c + 2].forEach(load);
    };
    var drift = function () {
      if (still()) return;
      var vh = window.innerHeight;
      pics.forEach(function (box) {
        var r = box.getBoundingClientRect();
        if (!r.height || r.bottom < 0 || r.top > vh) return;
        box.firstChild.style.setProperty("--py", (clamp((r.top + r.height / 2 - vh / 2) / vh, -0.8, 0.8) * 12).toFixed(2) + "%");
      });
    };
    var tick = function (t) {
      raf = 0;
      drift();
      var moving = false;
      if (slides.length && side.offsetWidth) {   // narrow screens: no window beside the days
        var dt = lastT ? Math.min(200, t - lastT) : 16.7;
        lastT = t;
        var at = readerAt(), target = Math.floor(at);
        if (held !== null && Math.abs(window.scrollY - heldAt) > 160) held = null;   // scrolled on: follow the page again
        if (held !== null) target = held;
        var k = function (f) { return still() ? 1 : 1 - Math.pow(1 - f, dt / 16.7); };   // the same glide at any frame rate
        pos += (target - pos) * k(0.1);
        flow += (at - flow) * k(0.16);
        if (Math.abs(target - pos) < 0.0005) pos = target;
        if (Math.abs(at - flow) < 0.0005) flow = at;
        paint();
        moving = pos !== target || flow !== at;
      }
      if (moving || performance.now() < settleUntil) raf = requestAnimationFrame(tick);
      else lastT = 0;
    };
    var wake = function () { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    days.forEach(function (day, i) {
      day.querySelector("summary").addEventListener("click", function () {
        if (day.open && !day.classList.contains("closing")) { held = i; heldAt = window.scrollY; }   // just opened
        settleUntil = performance.now() + 800;   // days fold open and shut: keep the photos in step meanwhile
        wake();
      });
    });
    if (all) all.addEventListener("click", function () { settleUntil = performance.now() + 800; wake(); });
    if (slides.length) { load(0); load(1); }
    wake();
  });

  // ---- destinations. On a place's page the "Top attractions" row slides sideways with the round arrows, and
  // the thin line under it shows which part of the row is in view; the three photos at the top drift a little
  // inside their frames as the page scrolls. On /destinations/ pointing at a place lights up its pin.
  var calmDest = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  d.querySelectorAll(".dest-sights").forEach(function (box) {
    var list = box.querySelector(".ds-list"), nav = box.querySelector(".ds-nav"), bar = box.querySelector(".ds-bar i");
    var prev = box.querySelector(".ds-prev"), next = box.querySelector(".ds-next");
    if (!list || !nav || !bar) return;
    var step = function () {
      var it = list.children;
      return it.length > 1 ? (it[1].offsetLeft - it[0].offsetLeft) * Math.max(1, Math.floor(list.clientWidth / (it[1].offsetLeft - it[0].offsetLeft) - 0.2)) : list.clientWidth;
    };
    var track = function () {
      var max = list.scrollWidth - list.clientWidth, fits = max < 4;
      nav.classList.toggle("fits", fits);
      bar.parentNode.style.visibility = fits ? "hidden" : "";
      prev.disabled = list.scrollLeft < 4;
      next.disabled = list.scrollLeft > max - 4;
      bar.style.width = (list.clientWidth / list.scrollWidth * 100).toFixed(2) + "%";
      bar.style.left = (list.scrollLeft / list.scrollWidth * 100).toFixed(2) + "%";
    };
    var go = function (dir) { list.scrollBy({ left: dir * step(), behavior: calmDest ? "auto" : "smooth" }); };
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    list.addEventListener("scroll", track, { passive: true });
    window.addEventListener("resize", track);
    track();
  });
  var destPics = [].slice.call(d.querySelectorAll(".dh-ph img"));
  if (destPics.length && !calmDest) {
    var destHero = d.querySelector(".dest-hero"), destBusy = false, destSpeed = [5, 7, 6];
    var destDrift = function () {
      destBusy = false;
      var r = destHero.getBoundingClientRect(), p = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
      destPics.forEach(function (im, i) { im.style.setProperty("--dy", (p * destSpeed[i % 3]).toFixed(2) + "%"); });
    };
    window.addEventListener("scroll", function () { if (!destBusy) { destBusy = true; requestAnimationFrame(destDrift); } }, { passive: true });
    destDrift();
  }
  d.querySelectorAll(".dest-index").forEach(function (box) {
    var pins = {};
    box.querySelectorAll(".isle-pin[data-slug]").forEach(function (p) { pins[p.getAttribute("data-slug")] = p; });
    box.querySelectorAll(".place-card[data-slug]").forEach(function (c) {
      var p = pins[c.getAttribute("data-slug")];
      if (!p) return;
      var on = function () { p.classList.add("on"); }, off = function () { p.classList.remove("on"); };
      c.addEventListener("mouseenter", on);
      c.addEventListener("mouseleave", off);
      c.addEventListener("focus", on);
      c.addEventListener("blur", off);
    });
  });

  // ---- /destinations/: the big island (build.py place_map). Pointing at the map lights up the nearest place
  // and the island turns yellow around it; a click or tap chooses it and shows its card beside the map (a sheet
  // from the bottom on phones). Clicking the place that's already chosen opens its page.
  d.querySelectorAll(".pmap").forEach(function (box) {
    var svg = box.querySelector("svg"), spot = box.querySelector(".pm-spot");
    if (!svg || !spot || !svg.getScreenCTM) return;
    var pins = [].slice.call(box.querySelectorAll(".pm-pin")), byPin = {}, cards = {}, names = {};
    pins.forEach(function (p) { byPin[p.getAttribute("data-slug")] = p; });
    box.querySelectorAll(".pm-place").forEach(function (c) { cards[c.getAttribute("data-slug")] = c; c.tabIndex = -1; });
    box.querySelectorAll(".pm-reg a").forEach(function (a) { names[a.getAttribute("data-slug")] = a; });
    var hot = null, chosen = null, calm = calmDest, phone = window.matchMedia("(max-width: 979px)");
    var slugOf = function (el) { return el.getAttribute("data-slug"); };

    // the yellow glow glides to the lit place and opens out, and closes when nothing is lit
    var now = { x: 0, y: 0, r: 0 }, aim = { x: 0, y: 0, r: 0 }, busy = false;
    var draw = function () {
      var k = calm ? 1 : .16;
      now.x += (aim.x - now.x) * k;
      now.y += (aim.y - now.y) * k;
      now.r += (aim.r - now.r) * (calm ? 1 : .12);
      spot.setAttribute("cx", now.x.toFixed(1));
      spot.setAttribute("cy", now.y.toFixed(1));
      spot.setAttribute("r", Math.max(0, now.r).toFixed(1));
      busy = Math.abs(aim.x - now.x) + Math.abs(aim.y - now.y) + Math.abs(aim.r - now.r) > .5;
      if (busy) requestAnimationFrame(draw);
    };
    var glow = function () {
      var pin = hot || chosen;
      if (pin) {
        var x = +pin.getAttribute("data-x"), y = +pin.getAttribute("data-y");
        if (now.r < 2) { now.x = x; now.y = y; }
        aim.x = x; aim.y = y; aim.r = 120;
      } else aim.r = 0;
      if (!busy) { busy = true; requestAnimationFrame(draw); }
    };
    var light = function (pin) {
      if (pin === hot) return;
      if (hot) { hot.classList.remove("hot"); if (names[slugOf(hot)]) names[slugOf(hot)].classList.remove("hot"); }
      hot = pin;
      if (hot) { hot.classList.add("hot"); if (names[slugOf(hot)]) names[slugOf(hot)].classList.add("hot"); }
      box.classList.toggle("has-hot", !!hot);
      glow();
    };
    // the place nearest the pointer (within a finger's or a pointer's reach); over a name, that name's place
    var nearest = function (e) {
      if (e.target.closest && e.target.closest("text")) return e.target.closest(".pm-pin");
      var m = svg.getScreenCTM();
      if (!m) return null;
      var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), best = null;
      var reach = (e.pointerType === "touch" || phone.matches ? 30 : 24) / m.a;
      pins.forEach(function (pin) {
        var dd = Math.hypot(p.x - pin.getAttribute("data-x"), p.y - pin.getAttribute("data-y"));
        if (dd < reach) { reach = dd; best = pin; }
      });
      return best;
    };

    var choose = function (slug, byKeys) {
      var pin = byPin[slug], card = cards[slug];
      if (!pin || !card) return;
      if (chosen) { chosen.classList.remove("chosen"); cards[slugOf(chosen)].classList.remove("on"); }
      chosen = pin;
      pin.classList.add("chosen");
      card.classList.remove("on");
      void card.offsetWidth;   // start the card's arrival again when it's the same place
      card.classList.add("on");
      card.scrollTop = 0;
      box.classList.add("chose");
      glow();
      if (byKeys) card.focus({ preventScroll: true });
      if (!phone.matches) {   // big screens: bring the card's top into view if the page is scrolled past it
        var top = card.getBoundingClientRect().top;
        if (top < 70) window.scrollBy({ top: top - 100, behavior: calm ? "auto" : "smooth" });
      } else requestAnimationFrame(function () {
        // keep the place in sight above the sheet
        var r = pin.querySelector(".pm-dot").getBoundingClientRect();
        var room = window.innerHeight - card.offsetHeight;
        if (r.top < 80 || r.bottom > room - 24) window.scrollBy({ top: r.top - Math.max(80, room * .45), behavior: calm ? "auto" : "smooth" });
      });
    };
    var unchoose = function () {
      if (!chosen) return;
      var pin = chosen;
      chosen.classList.remove("chosen");
      cards[slugOf(chosen)].classList.remove("on");
      chosen = null;
      box.classList.remove("chose");
      glow();
      return pin;
    };

    svg.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") light(nearest(e)); });
    svg.addEventListener("pointerleave", function () { light(null); });
    svg.addEventListener("click", function (e) {
      var keys = e.detail === 0, pin = keys ? e.target.closest(".pm-pin") : nearest(e);
      if (!pin) return;
      if (pin === chosen) {   // the chosen place again: open its page (on phones its sheet is already open)
        if (phone.matches) e.preventDefault();
        else if (!e.target.closest(".pm-pin")) location.href = pin.getAttribute("href");
        return;
      }
      e.preventDefault();
      choose(slugOf(pin), keys);
    });
    pins.forEach(function (pin) {
      pin.addEventListener("focus", function () { if (pin.matches(":focus-visible")) light(pin); });   // the keyboard, not a tap
      pin.addEventListener("blur", function () { if (hot === pin) light(null); });
    });
    Object.keys(names).forEach(function (slug) {
      var a = names[slug];
      a.addEventListener("mouseenter", function () { light(byPin[slug]); });
      a.addEventListener("mouseleave", function () { light(null); });
      a.addEventListener("click", function (e) { e.preventDefault(); choose(slug, e.detail === 0); });
    });
    box.querySelectorAll(".pm-near button").forEach(function (b) {
      b.addEventListener("click", function (e) { choose(b.getAttribute("data-go"), e.detail === 0); });
      b.addEventListener("mouseenter", function () { light(byPin[b.getAttribute("data-go")]); });
      b.addEventListener("mouseleave", function () { light(null); });
    });
    box.querySelectorAll(".pm-back").forEach(function (b) {
      b.addEventListener("click", function () {
        var pin = unchoose();
        if (pin && !phone.matches) pin.focus({ preventScroll: true });
      });
    });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && chosen) unchoose(); });
    // a phone's sheet closes once the map has scrolled away
    if ("IntersectionObserver" in window) new IntersectionObserver(function (list) {
      if (phone.matches && !list[0].isIntersecting) unchoose();
    }).observe(box.querySelector(".pm-map"));
  });

  // ---- header shadow
  var header = d.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pageshow", onScroll);   // also when the page reopens part-way down
  onScroll();

  // ---- the full-screen first screen (tour pages and every page that opens on a photo, build.py tour_hero and
  // screen_hero), in layers as you scroll: the photo drifts down at under half the page's speed and zooms in a
  // touch, the words in the middle float up a little slower than the page and fade, the facts along the bottom
  // fade sooner, and the photo dims. Only transforms and opacity change, so it stays smooth.
  var thBox = d.querySelector(".tour-hero"), thImg = thBox && thBox.querySelector(".th-bg img");
  if (thImg && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var thIn = thBox.querySelector(".th-in"), thFoot = thBox.querySelector(".th-foot"), thDim = thBox.querySelector(".th-dim");
    var thBusy = false, thH = thBox.offsetHeight, thLast = -1;
    var thDrift = function () {
      thBusy = false;
      var y = Math.max(0, Math.min(window.scrollY, thH)), k = y / thH;
      if (y === thLast) return;
      thLast = y;
      thImg.style.setProperty("--py", (y * .42).toFixed(1) + "px");
      thImg.style.setProperty("--pz", (1 + k * .08).toFixed(4));
      if (thIn) {
        thIn.style.transform = y ? "translate3d(0," + (y * .24).toFixed(1) + "px,0)" : "";
        thIn.style.opacity = y ? Math.max(0, 1 - k * 1.6).toFixed(3) : "";
      }
      if (thFoot) thFoot.style.opacity = y ? Math.max(0, 1 - k * 2.4).toFixed(3) : "";
      if (thDim) thDim.style.opacity = (k * .6).toFixed(3);
    };
    var thAsk = function () { if (!thBusy) { thBusy = true; requestAnimationFrame(thDrift); } };
    window.addEventListener("scroll", thAsk, { passive: true });
    window.addEventListener("resize", function () { thH = thBox.offsetHeight; thLast = -1; thAsk(); });
    thDrift();
  }

  // ---- home slider
  var slider = d.querySelector(".slider");
  if (slider) {
    var slides = slider.querySelectorAll(".slide"), dots = slider.querySelectorAll(".dots button"), i = 0, timer;
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var go = function (n) {
      slides[i].classList.remove("active"); if (dots[i]) dots[i].classList.remove("active");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("active"); if (dots[i]) dots[i].classList.add("active");
    };
    var start = function () {
      clearInterval(timer);
      if (!still && slides.length > 1) timer = setInterval(function () { go(i + 1); }, 6000);
    };
    dots.forEach(function (dot, n) { dot.addEventListener("click", function () { go(n); start(); }); });
    slider.addEventListener("mouseenter", function () { clearInterval(timer); });
    slider.addEventListener("mouseleave", start);
    start();
  }

  // ---- moving between pages: a pale circle grows out of the exact spot you clicked until it fills the screen,
  // carrying the name of what you clicked; the next page opens on that same colour and fades it away
  // (the small script at the top of every page puts the same screen up first: ARRIVE_SCRIPT in build.py)
  var calmMotion = function () { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var leaving = false;
  // kind "plain": the slower version for "Want it all?" (to the tour finder), with the sentence; kind "nav": every other page link
  var cover = function (href, x, y, word, lead, kind) {
    leaving = true;
    try { sessionStorage.setItem("sbTrip", JSON.stringify({ kind: kind, word: word, lead: lead, t: Date.now() })); } catch (err) { /* opens without it */ }
    var o = d.createElement("div");
    o.className = "pt pt-out pt-" + kind;
    o.setAttribute("aria-hidden", "true");
    // the circle: a soft-edged disc centred on the click, just big enough that its solid middle reaches the
    // farthest corner of the screen. It grows and fades in at once; both are things the browser animates
    // without redrawing, so it stays smooth even while the next page starts loading.
    var vw = window.innerWidth, vh = window.innerHeight;
    var far = Math.max(Math.hypot(x, y), Math.hypot(vw - x, y), Math.hypot(x, vh - y), Math.hypot(vw - x, vh - y));
    var rad = Math.ceil(far / 0.85), disc = d.createElement("i");
    disc.className = "pt-disc";
    disc.style.cssText = "width:" + rad * 2 + "px;height:" + rad * 2 + "px;left:" + Math.round(x - rad) + "px;top:" + Math.round(y - rad) + "px";
    o.appendChild(disc);
    var say = d.createElement("p"), small = d.createElement("small"), em = d.createElement("em");
    say.className = "pt-word";
    small.textContent = lead || "";
    em.textContent = word || "";
    say.appendChild(small);
    say.appendChild(em);
    o.appendChild(say);
    body.appendChild(o);
    void o.offsetWidth;   // start as a faint dot where you clicked, then grow
    o.classList.add("go");
    // move on once the circle has filled the screen and the words have settled (site.css .pt-disc, .pt-word)
    setTimeout(function () { window.location.href = href; }, kind === "nav" ? 800 : 1000);
  };
  // "Want it all?" (to the tour finder on /tours/): the circle carries the sentence "I want a trip full of everything you love."
  var openMix = function (e, link, leadText) {
    if (leaving || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0 || calmMotion()) return;
    e.preventDefault();
    var b = link.getBoundingClientRect();
    cover(link.getAttribute("href"), b.left + b.width / 2, b.top + b.height / 2, "everything you love.", leadText, "plain");
  };
  // which links get the circle: pages of this site only - not other websites, WhatsApp, phone or e-mail links,
  // links opening in a new tab, downloads, or links to another spot on the same page
  var pageLink = function (a) {
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-no-pt")) return null;
    var url;
    // (the attribute, not a.href: on a map pin, an SVG link, a.href is an object and became "[object SVGAnimatedString]")
    try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    if (url.pathname === location.pathname && url.search === location.search) return null;
    if (/\.(pdf|jpe?g|png|webp|gif|zip|docx?|xlsx?)$/i.test(url.pathname)) return null;
    return url;
  };
  // every other page link (the wheel's photo and the mix circle above handle their own links first)
  d.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || calmMotion()) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null, url = pageLink(a);
    if (!url) return;
    e.preventDefault();
    if (leaving) return;
    var x = e.clientX, y = e.clientY;
    if (!x && !y) {   // opened with the keyboard: start from the middle of the link
      var b = a.getBoundingClientRect();
      x = b.left + b.width / 2;
      y = b.top + b.height / 2;
    }
    var say = nameOf(a);
    cover(url.href, x, y, say.word, say.lead, "nav");
  });
  // the words in the circle name where the link goes. A link can say it outright (data-pt, with an optional
  // small line above, data-pt-lead: "and 2 more" says "Tours that visit / Kandy"); a card or a menu row shows only
  // its title, not the number, tagline or length run into it ("01Our storyWho we are…"); otherwise the link's
  // own words, if they are short. Nothing rather than something odd.
  var NAME_IN = "h3, .ci-name, .tl-t, .mp-t, .pm-tt, .tile-all-t, :scope > span > strong";
  var nameOf = function (a) {
    var word = a.getAttribute("data-pt"), label;
    if (word == null) {
      try { label = a.querySelector(NAME_IN); } catch (err) { label = a.querySelector("h3, .ci-name, .tl-t, .mp-t"); }
      word = (label || a).textContent || "";
    }
    word = word.replace(/\s+/g, " ").trim();
    return { word: word.length > 40 ? "" : word, lead: word ? a.getAttribute("data-pt-lead") || "" : "" };
  };
  // start fetching a page as soon as the pointer rests on its link, so it is ready when the circle has grown
  var fetched = {};
  d.addEventListener("pointerover", function (e) {
    var url = pageLink(e.target.closest ? e.target.closest("a[href]") : null);
    if (!url || fetched[url.pathname]) return;
    fetched[url.pathname] = true;
    var l = d.createElement("link");
    l.rel = "prefetch";
    l.href = url.pathname;
    d.head.appendChild(l);
  }, { passive: true });
  // coming back with the browser's Back button: take the full-screen circle down again
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    leaving = false;
    d.querySelectorAll(".pt-out").forEach(function (o) { o.remove(); });
  });
  // the photo you clicked opens out from its place on the page (rect r) until it fills the screen, with the name
  // over it; the next page opens on that same picture and fades it away (ARRIVE_SCRIPT in build.py). Used by the
  // home page's wheel and by the lists of tour categories.
  var photoOut = function (href, r, src, word, lead) {
    leaving = true;
    var vw = window.innerWidth, vh = window.innerHeight;
    try {
      sessionStorage.setItem("sbTrip", JSON.stringify({ img: src, word: word, lead: lead || "", t: Date.now() }));
    } catch (err) { /* private mode: the next page simply opens without the picture */ }
    var o = d.createElement("div");
    o.className = "pt pt-out";
    o.setAttribute("aria-hidden", "true");
    o.style.setProperty("--from", "inset(" + Math.max(0, r.top) + "px " + Math.max(0, vw - r.right) + "px " +
      Math.max(0, vh - r.bottom) + "px " + Math.max(0, r.left) + "px)");
    var pic = new Image();
    pic.alt = "";
    pic.src = src;
    o.appendChild(pic);
    var shade = d.createElement("div");
    shade.className = "pt-shade";
    o.appendChild(shade);
    var say = d.createElement("p"), small = d.createElement("small"), em = d.createElement("em");
    say.className = "pt-word";
    small.textContent = lead || "";
    em.textContent = word || "";
    say.appendChild(small);
    say.appendChild(em);
    o.appendChild(say);
    body.appendChild(o);
    void o.offsetWidth;   // start from the photo's place on the page, then open out
    o.classList.add("go");
    setTimeout(function () { window.location.href = href; }, 820);
  };

  // ---- tour categories as an editorial index (build.py category_index: the top of /tours/ and "Other tour
  // categories" on each category page). Pointing at a row lights it up and changes the big photo beside the
  // list, with its line underneath; clicking one opens its photo out to fill the screen (photoOut). On phones
  // the rows are swipe cards with a progress line and "01 / 07" under them.
  d.querySelectorAll(".cat-index").forEach(function (ci) {
    var rows = [].slice.call(ci.querySelectorAll(".ci-row")), pics = [].slice.call(ci.querySelectorAll(".ci-frame img"));
    var frame = ci.querySelector(".ci-frame"), cap = ci.querySelector(".ci-cap"), cur = 0, capTimer = 0;
    var show = function (i) {
      if (i === cur || !rows[i]) return;
      rows[cur].classList.remove("on");
      if (pics[cur]) pics[cur].classList.remove("on");
      cur = i;
      rows[i].classList.add("on");
      if (pics[i]) pics[i].classList.add("on");
      if (!cap) return;
      clearTimeout(capTimer);
      cap.classList.add("swap");
      capTimer = setTimeout(function () { cap.textContent = rows[cur].getAttribute("data-line") || ""; cap.classList.remove("swap"); }, 250);
    };
    rows.forEach(function (row, i) {
      row.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") show(i); });
      row.addEventListener("focus", function () { show(i); });
      row.addEventListener("click", function (e) {
        if (leaving || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0 || calmMotion()) return;
        // the big photo beside the list on wide screens; on phones the row's own small one
        var wide = !!(frame && frame.offsetParent), img = wide ? pics[i] : row.querySelector(".ci-thumb");
        var src = img && (img.currentSrc || img.src);
        if (!src) return;   // the plain circle (every other page link) takes it instead
        e.preventDefault();
        show(i);
        var name = row.querySelector(".ci-name");
        photoOut(row.href, (wide ? frame : img).getBoundingClientRect(), src,
          name ? name.textContent.trim() : "", row.getAttribute("data-line"));
      });
    });
    var list = ci.querySelector(".ci-list"), bar = ci.querySelector(".ci-bar i"), count = ci.querySelector(".ci-count");
    if (list && bar && count && rows.length > 1) {
      var n = rows.length, busy = false, two = function (k) { return (k < 10 ? "0" : "") + k; };
      var track = function () {
        busy = false;
        var step = list.children[1].offsetLeft - list.children[0].offsetLeft || list.clientWidth;
        var k = list.scrollLeft >= list.scrollWidth - list.clientWidth - 2 ? n - 1 : Math.round(list.scrollLeft / step);
        k = Math.max(0, Math.min(n - 1, k));
        bar.style.width = ((k + 1) / n * 100).toFixed(2) + "%";
        count.textContent = two(k + 1) + " / " + two(n);
      };
      list.addEventListener("scroll", function () { if (!busy) { busy = true; requestAnimationFrame(track); } }, { passive: true });
    }
  });

  // ---- tour pages: the route map beside "The trip" (build.py tour_map) draws itself in once it's on screen:
  // the island fades up, the gold line runs from the start, and each place appears as the line reaches it
  if ("IntersectionObserver" in window && !calmMotion()) d.querySelectorAll(".tmap").forEach(function (map) {
    map.classList.add("pre");
    var seen = new IntersectionObserver(function (list) {
      if (list.some(function (e) { return e.isIntersecting; })) { map.classList.add("in"); seen.disconnect(); }
    }, { threshold: .3 });
    seen.observe(map);
  });
  // pointing at the map lights the island up in yellow around the pointer: a soft round mask over the yellow
  // copy of the island follows the pointer (gliding after it), opens out when it arrives and closes when it leaves
  d.querySelectorAll(".tmap").forEach(function (map) {
    var svg = map.querySelector("svg"), spot = map.querySelector(".tm-spot");
    if (!svg || !spot || !svg.getScreenCTM) return;
    var now = { x: 0, y: 0, r: 0 }, aim = { x: 0, y: 0, r: 0 }, busy = false, calm = calmMotion();
    var draw = function () {
      var k = calm ? 1 : .2;
      now.x += (aim.x - now.x) * k;
      now.y += (aim.y - now.y) * k;
      now.r += (aim.r - now.r) * (calm ? 1 : .12);
      spot.setAttribute("cx", now.x.toFixed(1));
      spot.setAttribute("cy", now.y.toFixed(1));
      spot.setAttribute("r", Math.max(0, now.r).toFixed(1));
      busy = Math.abs(aim.x - now.x) + Math.abs(aim.y - now.y) + Math.abs(aim.r - now.r) > .5;
      if (busy) requestAnimationFrame(draw);
    };
    var go = function () { if (!busy) { busy = true; requestAnimationFrame(draw); } };
    var follow = function (e) {
      var m = svg.getScreenCTM();
      if (!m) return;
      var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      if (now.r < 2) { now.x = p.x; now.y = p.y; }   // a new visit starts where the pointer is
      aim.x = p.x;
      aim.y = p.y;
      aim.r = 150;
      go();
    };
    svg.addEventListener("pointermove", follow);
    svg.addEventListener("pointerdown", follow);
    svg.addEventListener("pointerleave", function () { aim.r = 0; go(); });
  });

  // ---- "I want a trip full of ___" wheel (home page tour categories)
  d.querySelectorAll(".trip-wheel").forEach(function (sec) {
    var wheel = sec.querySelector(".tw-wheel");
    var words = [].slice.call(sec.querySelectorAll(".tw-word")), photos = [].slice.call(sec.querySelectorAll(".tw-photos img"));
    var line = sec.querySelector(".tw-line"), go = sec.querySelector(".tw-go"), goWord = go.querySelector("em");
    var lineText = line.querySelector("span") || line;
    // change a piece of text smoothly: fade the old words out, swap them, fade the new ones in
    // (if the wheel turns again mid-fade, the newest words win)
    // glide a button to its new width while its words change, instead of snapping (skipped where the
    // button is stretched to fill the row, as on phones)
    var fit = function (box, change) {
      if (!box || getComputedStyle(box).flexGrow !== "0") { change(); return; }
      var from = box.getBoundingClientRect().width;
      box.style.width = "";
      change();
      var to = box.getBoundingClientRect().width;
      box.style.width = from + "px";
      void box.offsetWidth;   // let the browser see the old width before moving to the new one
      box.style.width = to + "px";
    };
    var swap = function (el, text, box) {
      if (!el || (el.swapTo || el.textContent) === text) return;
      el.swapTo = text;
      clearTimeout(el.swapTimer);
      if (still || !el.textContent) { el.textContent = text; return; }
      el.classList.add("tw-swap");
      el.swapTimer = setTimeout(function () {
        fit(box, function () { el.textContent = el.swapTo; });
        el.classList.remove("tw-swap");
      }, 220);
    };
    var n = words.length, timer = null, touched = false, dragged = false, near = false;
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var wide = window.matchMedia("(min-width: 980px)");   // big screens: the ring; smaller: the straight list
    // the site may live in a sub-folder (see build.py); photos waiting to load need the same start
    var css = d.querySelector('link[href*="css/site.css"]');
    var base = css ? css.getAttribute("href").split("/css/site.css")[0] : "";
    // where the wheel is: x counts words (0 = the first) and sits between two of them while the wheel moves.
    // The chosen word is the one nearest to x. "mode" is what is moving it: "drag" (a finger or the mouse
    // holds it), "wheel" (a mouse wheel or trackpad), "glide" (coming to rest on a word), or nothing.
    var x = 0, target = 0, mode = null, tau = 0.17, raf = 0, lastT = 0, shown = -1, commitTimer = null;
    var mod = function (k) { return ((k % n) + n) % n; };
    var cur = function () { return mod(Math.round(x)); };
    var rel = function (k) { var r = mod(k - cur()); return r > n / 2 ? r - n : r; };
    var load = function (k) {
      var img = photos[mod(k)], src = img && img.getAttribute("data-src");
      if (src && !img.getAttribute("src")) {
        if (img.getAttribute("data-srcset")) img.srcset = img.getAttribute("data-srcset");
        img.src = (src.charAt(0) === "/" ? base : "") + src;
      }
    };
    // how far a finger has to travel to move the wheel by one word: the gap between two words on screen, so
    // the words stay under the finger (on the ring: the height of one step round it; in the list: one line)
    var step = function () {
      if (wide.matches) {
        var cs = getComputedStyle(wheel);
        return parseFloat(cs.getPropertyValue("--R")) * Math.sin(parseFloat(cs.getPropertyValue("--spread")) * Math.PI / 180) || 120;
      }
      return parseFloat(getComputedStyle(words[0]).fontSize) || 52;
    };
    // the photo, the line under the wheel and the yellow button follow the chosen word
    var commit = function () {
      clearTimeout(commitTimer);
      var c = cur();
      photos.forEach(function (img, k) { img.classList.toggle("on", k === c); });
      load(c);
      if (near) { load(c + 1); load(c - 1); }   // get the next photos ready once the wheel is close to the screen
      swap(lineText, words[c].getAttribute("data-line"));
      go.setAttribute("href", words[c].getAttribute("href"));
      swap(goWord, words[c].textContent, go);
    };
    // place every word for the wheel's position x: --k is its place on the ring (or in the list on phones), in
    // between whole numbers while it moves; it shrinks and fades the further it is from the chosen spot
    var draw = function () {
      var big = wide.matches;
      words.forEach(function (w, k) {
        var r = mod(k - x);
        if (r > n / 2) r -= n;
        var a = Math.abs(r), s, o;
        if (big) {
          s = a < 1 ? 1 - 0.22 * a : Math.max(0.62, 0.78 - 0.16 * (a - 1));
          o = a < 1 ? 1 - 0.5 * a : a < 2 ? 0.5 - 0.3 * (a - 1) : Math.max(0, 0.2 - 0.2 * (a - 2));
        } else {
          s = a < 1 ? 1 - 0.54 * a : 0.46;
          o = a < 1 ? 1 - 0.45 * a : Math.max(0, 0.55 - 0.55 * (a - 1));
        }
        w.style.setProperty("--k", Math.max(-3, Math.min(3, r)).toFixed(4));
        w.style.setProperty("--s", s.toFixed(4));    // the ring
        w.style.setProperty("--ms", s.toFixed(4));   // the list
        w.style.opacity = o.toFixed(3);
        w.style.visibility = o > 0.01 ? "visible" : "hidden";
      });
      var c = cur();
      if (c !== shown) {
        shown = c;
        words.forEach(function (w, k) { w.classList.toggle("on", k === c); });
        // the photo and the words below follow once the wheel stays on a word for a moment, so a fast
        // spin doesn't flash every photo past
        clearTimeout(commitTimer);
        commitTimer = setTimeout(commit, 160);
      }
    };
    // the wheel moves like a real one: it follows the finger while held; let go, it carries on at the speed it
    // was thrown and slows down evenly (the same drag as a phone's own scrolling), coming to rest exactly on
    // the word nearest to where it would have stopped. Each frame closes part of the gap to where it is going.
    var frame = function (now) {
      raf = 0;
      // (the easing below is exact for any frame length, so a slow phone that drops frames still keeps time)
      var dt = Math.max(0, Math.min(0.25, (now - lastT) / 1000));
      lastT = now;
      if (mode === "glide" || mode === "wheel") {
        x = still ? target : target + (x - target) * Math.exp(-dt / (mode === "wheel" ? 0.09 : tau));
        if (Math.abs(x - target) < 0.0005) {
          x = target;
          if (mode === "glide") { mode = null; draw(); commit(); return; }
        }
      }
      draw();
      if (mode) raf = requestAnimationFrame(frame);
    };
    var run = function () { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } };
    var glideTo = function (t, time) { target = t; tau = time; mode = "glide"; run(); };
    // one or more words on (the arrows, the keys, a tap on a word, and the slow turning by itself); pressed
    // again while it is still moving, it goes on from where it was heading
    var turn = function (s) { glideTo((mode === "glide" || mode === "wheel" ? Math.round(target) : Math.round(x)) + s, 0.17); };
    // thrown at speed v (words a second): where it would stop is x + v × 0.35 s; it rests on the word nearest
    // to that, and the glide starts at the same speed it was thrown
    var fling = function (v) {
      v = Math.max(-30, Math.min(30, v));
      var t = Math.round(x + v * 0.35), time = 0.14;
      if (Math.abs(v) > 0.4 && (t - x) * v > 0) time = Math.max(0.14, Math.min(0.6, (t - x) / v));
      glideTo(t, time);
    };
    var stop = function () { touched = true; clearInterval(timer); };
    var play = function () {
      clearInterval(timer);
      if (!still && !touched) timer = setInterval(function () { turn(1); }, 3800);
    };
    // clicking through to a tour: the wheel's photo opens out to fill the screen with the chosen word, then
    // the tour page opens on that same picture and fades it away (see "arriving from the home page" above)
    var leave = function (e, href) {
      if (still || leaving || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
      var img = photos[cur()], src = img && (img.currentSrc || img.src);
      if (!src || !href) return;
      e.preventDefault();
      var lead = sec.querySelector(".tw-lead");
      photoOut(href, sec.querySelector(".tw-photos").getBoundingClientRect(), src, words[cur()].textContent,
        lead ? lead.textContent : "");
    };
    // coming back with the browser's Back button: take the full-screen picture down again
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) d.querySelectorAll(".pt-out").forEach(function (o) { o.remove(); });
    });
    go.addEventListener("click", function (e) { commit(); leave(e, go.getAttribute("href")); });
    // "Want it all?": opens the tour finder on /tours/ with the pale growing circle (openMix, above). The word
    // showing on the wheel goes along (?love=beaches), so the finder starts with it picked.
    var mixLink = sec.querySelector(".tw-mix");
    if (mixLink) mixLink.addEventListener("click", function (e) {
      commit();
      var lead = sec.querySelector(".tw-lead"), now = sec.querySelector(".tw-go em");
      var word = now ? (now.swapTo || now.textContent).trim() : "";
      if (word) {
        mixLink.setAttribute("href", mixLink.getAttribute("href").split(/[?#]/)[0] + "?love=" +
          encodeURIComponent(word.toLowerCase()) + "#find");
      }
      openMix(e, mixLink, lead ? lead.textContent : "");
    });
    words.forEach(function (w, k) {
      w.tabIndex = -1;
      w.addEventListener("click", function (e) {
        var r = rel(k);
        if (dragged || r !== 0) { e.preventDefault(); }
        if (!dragged && r !== 0) { stop(); turn(r); }
        else if (!dragged) { commit(); leave(e, w.getAttribute("href")); }   // the chosen word itself opens its tours
      });
    });
    sec.querySelector(".tw-prev").addEventListener("click", function () { stop(); turn(-1); });
    sec.querySelector(".tw-next").addEventListener("click", function () { stop(); turn(1); });
    wheel.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); stop(); turn(-1); }
      else if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); stop(); turn(1); }
      else if (k === "Enter") { go.click(); }
    });
    // the wheel only listens once its whole section is on screen ("ready"); until then scrolling or swiping
    // over it moves the page as normal. While ready, the smooth-scroll library is told to keep out of the
    // wheel's area, and touch screens stop treating a swipe there as a page scroll. On phones it also waits
    // until the page has stopped moving, so a swipe that is still scrolling the page down never gets caught.
    var turnBox = sec.querySelector(".tw-turn"), hdr = d.querySelector(".site-header"), ready = false, pageMoved = 0, restTimer = null;
    var check = function () {
      var r = sec.getBoundingClientRect(), h = hdr ? hdr.getBoundingClientRect().bottom : 0, vh = window.innerHeight;
      var seen = Math.min(r.bottom, vh) - Math.max(r.top, Math.max(h, 0));
      var now = seen >= Math.min(r.height, vh - Math.max(h, 0)) * 0.95;   // (all but a sliver of it)
      if (sec.closest(".pin-stack") && !sec.classList.contains("pin-done")) now = false;   // still playing its scroll effect
      if (!wide.matches && Date.now() - pageMoved < 200) now = false;
      if (now === ready) return;
      ready = now;
      sec.classList.toggle("tw-ready", ready);
      [wheel, turnBox].forEach(function (el) { if (ready) el.setAttribute("data-lenis-prevent", ""); else el.removeAttribute("data-lenis-prevent"); });
    };
    window.addEventListener("scroll", function () {
      if (!wide.matches) { pageMoved = Date.now(); clearTimeout(restTimer); restTimer = setTimeout(check, 220); }
      check();
    }, { passive: true });
    window.addEventListener("resize", function () { check(); draw(); });
    check();
    // a mouse wheel or trackpad over the wheel (or its arrows) turns it instead of the page, by the same
    // distance the page would have scrolled: a gentle scroll moves it a little, a fast flick spins it through
    // several words. When the scrolling stops it settles on the nearest word (always at least one word on).
    // (browsers count one notch of a mouse wheel as about 100px, so that is one word; a trackpad's scroll then
    // moves the words about as far as the fingers go)
    var wheelTimer = null, wheelFrom = 0, wheelPx = 100;
    var onWheel = function (e) {
      check();
      if (!ready) return;
      e.preventDefault();
      stop();
      if (mode !== "wheel") {
        wheelFrom = mode === "glide" ? target : Math.round(x);
        if (mode !== "glide") target = x;
        mode = "wheel";
        run();
      }
      target += e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1) / wheelPx;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () {
        if (mode !== "wheel") return;
        var t = Math.round(target);
        if (t === wheelFrom && Math.abs(target - wheelFrom) > 0.04) t = wheelFrom + (target > wheelFrom ? 1 : -1);
        glideTo(t, 0.16);
      }, 140);
    };
    [wheel, turnBox].forEach(function (el) { el.addEventListener("wheel", onWheel, { passive: false }); });
    // swipe or drag up and down to turn it (only once the section is fully on screen). The words follow the
    // finger; the speed of the last tenth of a second before letting go is how hard it was thrown.
    var held = null;
    wheel.addEventListener("dragstart", function (e) { e.preventDefault(); });
    wheel.addEventListener("pointerdown", function (e) {
      check();
      if (!ready || e.button > 0) return;
      // catching it while it spins stops it where it is, and that touch doesn't count as a tap on a word
      var spinning = mode === "glide" && Math.abs(target - x) > 0.3;
      held = { id: e.pointerId, y: e.clientY, from: x, px: step(), moved: spinning, track: [[performance.now(), x]] };
      dragged = spinning;
      stop();
      clearTimeout(wheelTimer);
      mode = "drag";
      run();
    });
    var letGo = function (e) {
      if (!held || e.pointerId !== held.id) return;
      var h = held, now = performance.now(), v = 0, a = h.track[0], b = h.track[h.track.length - 1];
      held = null;
      // a finger that stopped before letting go throws nothing
      if (h.moved && now - b[0] < 80 && b[0] - a[0] > 10) v = (b[1] - a[1]) / ((b[0] - a[0]) / 1000);
      fling(v);
      setTimeout(function () { dragged = false; }, 0);
    };
    window.addEventListener("pointermove", function (e) {
      if (!held || e.pointerId !== held.id) return;
      if (e.pointerType === "mouse" && !e.buttons) { letGo(e); return; }   // let go outside the window
      var dy = e.clientY - held.y;
      if (!held.moved && Math.abs(dy) < 6) return;   // not moved yet: still a tap
      held.moved = true;
      dragged = true;
      x = held.from - dy / held.px;
      var now = performance.now();
      held.track.push([now, x]);
      while (held.track.length > 2 && now - held.track[0][0] > 100) held.track.shift();
    });
    window.addEventListener("pointerup", letGo);
    window.addEventListener("pointercancel", letGo);
    // turns by itself while on screen, until someone touches it
    sec.addEventListener("mouseenter", function () { clearInterval(timer); });
    sec.addEventListener("mouseleave", play);
    sec.addEventListener("focusin", function () { clearInterval(timer); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting && !near) { near = true; load(cur() + 1); load(cur() - 1); }
          if (en.intersectionRatio >= 0.5) play(); else clearInterval(timer);
        });
      }, { threshold: [0, 0.5] }).observe(sec);
    } else { near = true; }
    sec.classList.add("tw-js");   // the script places the words from here on (no CSS transitions on them)
    draw();
    commit();
  });

  // ---- weather: "When are you travelling?" on tour category pages, and the monsoon dial (best time to visit).
  // The facts come with the page (the #sb-weather JSON, written by build.py from best-time-to-visit.md and each
  // tour's best_months / mixed_months). The month a visitor picks is remembered for the rest of the visit
  // (-1 means "not sure yet"), so they are asked only once.
  var wx = null, wxEl = d.getElementById("sb-weather");
  try { wx = wxEl ? JSON.parse(wxEl.textContent) : null; } catch (err) { wx = null; }
  var getMonth = function () {
    try { var v = sessionStorage.getItem("sbMonth"); return v === null ? null : +v; } catch (err) { return null; }
  };
  var setMonth = function (m) { try { sessionStorage.setItem("sbMonth", String(m)); } catch (err) { /* not remembered */ } };
  // a month chosen on the dial is passed on to the year planner further down the same page
  var tellMonth = function (m) { try { d.dispatchEvent(new CustomEvent("sb-month", { detail: m })); } catch (err) { /* old browser */ } };
  var escHtml = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var sunniest = function (m) {
    return wx.regions.filter(function (r) { return r[2][m] === "G"; }).map(function (r) { return r[0]; });
  };

  // category pages: the season strip (build.py month_bar) sorts the tours (best months first), tags each card, and
  // sends the yellow sun gliding to the month picked
  var bar = d.querySelector(".month-bar"), grid = bar && d.querySelector(bar.getAttribute("data-grid"));
  if (bar && grid && wx) {
    var cards = [].slice.call(grid.children), mbBtns = [].slice.call(bar.querySelectorAll(".mb-m, .mb-any"));
    var note = bar.querySelector(".mb-note"), noteDefault = note.textContent, strip = bar.querySelector(".mb-strip");
    var nTours = +bar.getAttribute("data-n") || 0;
    var RANK = { G: 0, M: 1, R: 2 }, TAG = { G: "Great in ", M: "Mixed in ", R: "Off-season in " };
    // how many of these tours are at their best in month m, in words
    var bestLine = function (m) {
      var cell = strip && strip.querySelector('.mb-m[data-m="' + m + '"]'), g = cell ? +cell.getAttribute("data-g") : 0;
      if (!nTours) return "Tours that suit " + wx.months[m] + " come first.";
      if (!g) return "None of these tours is at its best then, so the ones with mixed weather come first.";
      if (g === nTours) return nTours === 1 ? "This tour is at its best then." : "All " + nTours + " of these tours are at their best then.";
      return g + " of these " + nTours + " tours " + (g === 1 ? "is at its best then, and it comes" : "are at their best then, and they come") + " first.";
    };
    var apply = function (m) {
      mbBtns.forEach(function (b) { b.setAttribute("aria-pressed", +b.getAttribute("data-m") === m ? "true" : "false"); });
      if (strip) {
        if (m >= 0) strip.style.setProperty("--m", m);
        strip.classList.toggle("has-m", m >= 0);
      }
      var order = cards.slice(), rank = function (c) { return RANK[(c.getAttribute("data-season") || "MMMMMMMMMMMM")[m]]; };
      if (m >= 0) order.sort(function (a, b) { return rank(a) - rank(b) || cards.indexOf(a) - cards.indexOf(b); });
      order.forEach(function (c) {
        grid.appendChild(c);
        var s = c.getAttribute("data-season"), tag = c.querySelector(".season-chip"), img = c.querySelector(".card-img");
        if (m < 0 || !s || !img) {
          if (tag) tag.remove();
          c.classList.remove("is-off");
          return;
        }
        if (!tag) { tag = d.createElement("span"); img.appendChild(tag); }
        tag.className = "season-chip " + s[m];
        tag.textContent = TAG[s[m]] + wx.months[m].slice(0, 3);
        c.classList.toggle("is-off", s[m] === "R");
      });
      if (m < 0) { note.textContent = noteDefault; return; }
      var sun = sunniest(m), month = wx.months[m];
      note.textContent = (sun.length ? "Sunniest in " + month + ": " + sun.join(" and ") + "." : "In " + month + ", showers are likely almost everywhere.") +
        " " + bestLine(m);
    };
    mbBtns.forEach(function (b) {
      b.addEventListener("click", function () { var m = +b.getAttribute("data-m"); setMonth(m); apply(m); });
    });
    var known = getMonth();
    if (known !== null) apply(known);

    // the full-screen question, on the category's own photo: only for visitors who have just clicked here from
    // another page of this site (the home wheel, the tours page...) and haven't answered yet - never for someone
    // arriving straight from a search engine. When they come from the wheel, its photo fades straight into this.
    var ask = d.querySelector(".month-ask"), fromSite = false;
    try {
      var ref = d.referrer ? new URL(d.referrer) : null;
      fromSite = !!ref && ref.origin === location.origin && ref.pathname !== location.pathname;
    } catch (err) { fromSite = false; }
    if (ask) {
      var onKey = function (e) {
        if (e.key === "Escape") { setMonth(-1); closeAsk(); return; }
        if (e.key !== "Tab") return;   // keep the keyboard inside the question while it is open
        var f = [].slice.call(ask.querySelectorAll("button")), i = f.indexOf(d.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      };
      var closeAsk = function () {
        ask.classList.remove("show");
        d.documentElement.classList.remove("ma-open");
        d.removeEventListener("keydown", onKey);
        setTimeout(function () { ask.hidden = true; }, 600);
      };
      // pointing at a month fills in the line under the row: how many of these tours are at their best then, and
      // where on the island is sunniest. Picking one lights it up white for a moment before the question lifts away.
      var say = ask.querySelector(".ma-say"), sayDefault = say ? say.innerHTML : "", nAsk = +ask.getAttribute("data-n") || 0;
      var sayFor = function (b) {
        var m = +b.getAttribute("data-m"), g = +b.getAttribute("data-g"), sun = sunniest(m), dot = "<i>·</i>";
        var best = !nAsk ? "" : g === nAsk ? (nAsk === 1 ? "This tour is at its best" : "All " + nAsk + " tours at their best")
          : g ? g + " of " + nAsk + " tours at their best" : "None of these tours at its best";
        return "<b>" + escHtml(wx.months[m]) + "</b>" + (best ? dot + best : "") +
          (sun.length ? dot + "Sunniest: " + sun.map(escHtml).join(", ") : dot + "Showers almost everywhere");
      };
      var picked = false;
      [].forEach.call(ask.querySelectorAll(".ma-m"), function (b) {
        var show = function () { if (say && !picked) say.innerHTML = sayFor(b); };
        b.addEventListener("mouseenter", show);
        b.addEventListener("focus", show);
        b.addEventListener("click", function () {
          if (picked) return;
          picked = true;
          var m = +b.getAttribute("data-m");
          if (say) say.innerHTML = sayFor(b);
          b.classList.add("picked");
          setMonth(m); apply(m);
          setTimeout(closeAsk, 420);
        });
      });
      var row = ask.querySelector(".ma-months");
      if (row && say) row.addEventListener("mouseleave", function () { if (!picked) say.innerHTML = sayDefault; });
      ask.querySelector(".ma-skip").addEventListener("click", function () { setMonth(-1); closeAsk(); });
      if (known === null && fromSite) {
        ask.hidden = false;
        ask.setAttribute("tabindex", "-1");
        d.documentElement.classList.add("ma-open");
        void ask.offsetWidth;
        ask.classList.add("show");
        ask.focus({ preventScroll: true });
        d.addEventListener("keydown", onKey);
      }
    }
  }

  // the monsoon map: Sri Lanka's districts inside a ring of the twelve months. Choosing a month sends the small sun
  // round the ring, colours every district sunny / mixed / rainy, lets rain fall over the rainy ones only, and
  // updates the panel beside it. It opens on the month the visitor picked (if any), otherwise on this month.
  // On the home page, scrolling over the map turns the months (see below).
  var dial = d.querySelector("[data-dial]");
  if (dial && wx) {
    var dBtns = [].slice.call(dial.querySelectorAll(".dial-m")), sunEl = dial.querySelector(".dial-sun");
    var dName = dial.querySelector(".dial-name"), dSum = dial.querySelector(".dial-sum"), detail = dial.querySelector(".dial-detail");
    var dists = [].slice.call(dial.querySelectorAll(".dm-d")), rainClip = dial.querySelector("#dm-rain-clip");
    var ring = dial.querySelector(".dial"), tip = dial.querySelector(".dial-tip");
    // the raindrops move inside the map's drawing, so the page itself redraws them every frame, wherever the
    // visitor is on the page: they rest while the map is off screen (.dial-rest, site.css)
    if ("IntersectionObserver" in window) {
      dial.classList.add("dial-rest");
      new IntersectionObserver(function (es) { dial.classList.toggle("dial-rest", !es[0].isIntersecting); }).observe(dial);
    }
    var moreA = detail.querySelector(".dial-more"), arrow = moreA && moreA.querySelector("svg") ? moreA.querySelector("svg").outerHTML : "";
    var guideBase = moreA ? moreA.getAttribute("href").split("#")[0] : "";
    var LBL = { G: "Sunny", M: "Mixed", R: "Rainy" }, LONG = { G: "Sunny", M: "Mixed weather", R: "Rainy" }, now = 0, angle = 0;
    var statusOf = function (p, m) { var r = p.getAttribute("data-r"); return r === "" ? "M" : wx.regions[+r][2][m]; };
    var turnTo = function (m) {
      angle += (((m - now) % 12 + 18) % 12 - 6) * 30;   // the sun takes the short way round
      now = m;
      if (sunEl) sunEl.style.transform = "rotate(" + angle + "deg)";
      dBtns.forEach(function (b, i) { b.classList.toggle("on", i === m); b.setAttribute("aria-pressed", i === m ? "true" : "false"); });
      var rainy = [];
      dists.forEach(function (p) {
        var s = statusOf(p, m);
        p.setAttribute("class", "dm-d " + s);
        if (s === "R") rainy.push('<use href="#' + p.id + '"/>');
      });
      if (rainClip) rainClip.innerHTML = rainy.join("");
      var sun = sunniest(m), month = wx.months[m];
      dName.textContent = month;
      dSum.textContent = sun.length ? "Sunniest: " + sun.join(", ") : "Showers almost everywhere";
      var tours = wx.tours.filter(function (t) { return t[2][m] === "G"; }).slice(0, 6);
      detail.innerHTML =
        '<ul class="dial-regions">' + wx.regions.map(function (r) {
          return '<li><span class="dr-name">' + escHtml(r[0]) + "<small>" + escHtml(r[1]) + '</small></span><span class="dr-st ' +
            r[2][m] + '">' + LBL[r[2][m]] + "</span></li>";
        }).join("") + "</ul>" +
        '<p class="dial-k">What’s on</p><p class="dial-on">' + escHtml(wx.events[m]) + "</p>" +
        '<p class="dial-k">Tours at their best</p><p class="dial-tours">' + (tours.length ? tours.map(function (t) {
          return '<a href="' + escHtml(t[1]) + '">' + escHtml(t[0]) + "</a>";
        }).join(" · ") : "Ask us: we will plan around the weather.") + "</p>" +
        '<a class="dial-more" href="' + guideBase + "#" + month.toLowerCase() + '">Read the ' + month + " guide" + arrow + "</a>";
      if (tip) tip.hidden = true;
    };
    // point at (or tap) a district: its name, province and weather this month
    if (tip && ring) {
      var showTip = function (p, e) {
        var s = statusOf(p, now), box = ring.getBoundingClientRect();
        tip.innerHTML = "<strong>" + escHtml(p.getAttribute("data-name")) + "</strong> · " + escHtml(p.getAttribute("data-prov")) +
          ' Province<br><span class="' + s + '">' + LONG[s] + " in " + wx.months[now] + "</span>";
        tip.style.left = (e.clientX - box.left) + "px";
        tip.style.top = (e.clientY - box.top) + "px";
        tip.hidden = false;
      };
      dists.forEach(function (p) {
        p.addEventListener("pointermove", function (e) { showTip(p, e); });
        p.addEventListener("click", function (e) { showTip(p, e); });
        p.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") tip.hidden = true; });
      });
    }
    dBtns.forEach(function (b, i) {
      b.addEventListener("click", function () { setMonth(i); turnTo(i); tellMonth(i); });
      b.addEventListener("keydown", function (e) {   // arrow keys go round the ring
        var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var n = (i + step + 12) % 12;
        dBtns[n].focus();
        setMonth(n);
        turnTo(n);
        tellMonth(n);
      });
    });
    // home page: scrolling with a mouse wheel or trackpad over the map (the ring of months) turns the year, a
    // month per notch; everywhere else the page scrolls as normal. It only listens once the whole ring is on
    // screen, so scrolling down the page past it never gets caught half-way, and there is a short pause between
    // steps so a trackpad flick doesn't race round the whole year. (Phones tap the months instead.)
    var hitBox = dial.closest(".island-dial") ? ring : null;
    if (hitBox) {
      var dHdr = d.querySelector(".site-header"), dReady = false, wSum = 0, wLast = 0, wStep = 0;
      var dCheck = function () {
        var r = hitBox.getBoundingClientRect(), top = dHdr ? Math.max(0, dHdr.getBoundingClientRect().bottom) : 0;
        var on = r.top >= top - 8 && r.bottom <= window.innerHeight + 8;
        if (on === dReady) return;
        dReady = on;
        // while listening, the smooth-scroll library is told to keep out of the ring
        if (on) hitBox.setAttribute("data-lenis-prevent", ""); else hitBox.removeAttribute("data-lenis-prevent");
      };
      window.addEventListener("scroll", dCheck, { passive: true });
      window.addEventListener("resize", dCheck);
      dCheck();
      hitBox.addEventListener("wheel", function (e) {
        dCheck();
        if (!dReady || e.ctrlKey) return;
        e.preventDefault();
        var dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX, t = Date.now();
        dy *= e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
        if (t - wLast > 300) wSum = 0;
        wLast = t;
        wSum += dy;
        if (Math.abs(wSum) >= 50 && t - wStep > 220) {
          turnTo((now + (wSum > 0 ? 1 : -1) + 12) % 12);
          wSum = 0;
          wStep = t;
        }
      }, { passive: false });
    }
    var picked = getMonth();
    turnTo(picked !== null && picked >= 0 ? picked : new Date().getMonth());
  }

  // ---- home: the train window onto the line to Ella (build.py ella_ride). Its pictures load once the section is
  // close (they are the ride's own, so they are not small), and the view drifts past only while it is on screen.
  d.querySelectorAll(".ella-ride").forEach(function (sec) {
    var loaded = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      sec.querySelectorAll("img[data-src]").forEach(function (im) { im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); });
    };
    if (!("IntersectionObserver" in window)) { load(); sec.classList.add("er-on"); return; }
    var soon = new IntersectionObserver(function (es) {
      if (es.some(function (en) { return en.isIntersecting; })) { load(); soon.disconnect(); }
    }, { rootMargin: "900px 0px" });
    soon.observe(sec);
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { sec.classList.toggle("er-on", en.isIntersecting); });
    }).observe(sec);
  });

  // ---- best time to visit: the year planner (build.py month_guide). Choosing a month (its name, any square in
  // its column, the arrows, or the dial above) slides the frame to that column, dims the other months a little
  // and shows that month's details. It opens on the month in the address (#march), else the month picked
  // earlier on the site, else this month.
  d.querySelectorAll("[data-yp]").forEach(function (yp) {
    var grid = yp.querySelector(".yp-grid"), frame = yp.querySelector(".yp-frame");
    var btns = [].slice.call(yp.querySelectorAll(".yp-m")), cells = [].slice.call(yp.querySelectorAll(".yp-c"));
    var arts = [].slice.call(yp.querySelectorAll(".yp-month")), cur = -1;
    if (!grid || !frame || btns.length !== 12 || arts.length !== 12) return;
    yp.classList.add("js");
    var placed = false;
    var place = function () {
      var b = btns[cur];
      if (!b) return;
      if (!placed) frame.style.transition = "none";   // the first time it appears in place, without sliding in
      frame.style.left = (b.offsetLeft - 5) + "px";
      frame.style.width = (b.offsetWidth + 10) + "px";
      frame.style.top = "-6px";
      frame.style.height = (grid.offsetHeight + 12) + "px";
      if (!placed) { void frame.offsetWidth; frame.style.transition = ""; placed = true; }
    };
    var show = function (m, remember) {
      m = (m + 12) % 12;
      if (remember) setMonth(m);
      if (m === cur) return;
      cur = m;
      grid.classList.add("picked");
      btns.forEach(function (b, i) { b.setAttribute("aria-pressed", i === m ? "true" : "false"); });
      cells.forEach(function (c) { c.classList.toggle("on", +c.getAttribute("data-m") === m); });
      arts.forEach(function (a, i) { a.classList.toggle("on", i === m); a.setAttribute("aria-hidden", i === m ? "false" : "true"); });
      place();
    };
    grid.addEventListener("click", function (e) {
      var t = e.target.closest("[data-m]");
      if (t) show(+t.getAttribute("data-m"), true);
    });
    btns.forEach(function (b, i) {
      b.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        show(i + step, true);
        btns[cur].focus();
      });
    });
    var prev = yp.querySelector(".ypm-prev"), next = yp.querySelector(".ypm-next");
    if (prev) prev.addEventListener("click", function () { show(cur - 1, true); });
    if (next) next.addEventListener("click", function () { show(cur + 1, true); });
    window.addEventListener("resize", place);
    d.addEventListener("sb-month", function (e) { show(e.detail, false); });
    var fromHash = function () {
      var h = location.hash.slice(1).toLowerCase();
      for (var i = 0; i < 12; i++) if (arts[i].id === h) return i;
      return -1;
    };
    window.addEventListener("hashchange", function () { var i = fromHash(); if (i >= 0) show(i, true); });
    var first = fromHash(), had = getMonth();
    show(first >= 0 ? first : had !== null && had >= 0 ? had : new Date().getMonth(), false);
  });

  // ---- /tours/: everything in one place (build.py tour_finder). The sentence "We're ___, travelling in ___ for ___,
  // and we'd love ___." is filled in one quick question at a time (or by tapping any blank). After every answer the
  // whole list is sorted again: matching trip words, good weather in the month, the right length and who is coming
  // all count. Tours that fit rise to the top with ticks saying why; the rest fade under "Possible with a few
  // changes". The rows glide to their new places. The big photo shows the tour you point at (the best match after
  // each answer). "Plan this trip" carries the sentence to the contact form.
  // The first time on the page in a visit, the sentence fills the screen by itself over blurred trip photos (the
  // little script in the page adds "tf-intro tf-dark" to <html> before anything is drawn). "Show my tours" fades the
  // photos to white, then the sentence glides up into its usual place and the tours rise in under it.
  // Answers are kept for the rest of the visit, until the page is reloaded (that starts again, sentence and all);
  // a month picked elsewhere on the site is filled in already;
  // /tours/#wildlife (the old "Day tours" link) starts on "a single day".
  d.querySelectorAll("[data-tf]").forEach(function (tf) {
    var data;
    try { data = JSON.parse(tf.querySelector(".tf-data").textContent); } catch (err) { return; }
    var html = d.documentElement;
    var me = tf.querySelector(".tf-me"), we = tf.querySelector(".tf-we"), blanks = [].slice.call(tf.querySelectorAll(".tf-b"));
    var chipsBox = tf.querySelector(".tf-chips"), qEl = tf.querySelector(".tf-q"), stepEl = tf.querySelector(".tf-step");
    var skip = tf.querySelector(".tf-skip"), reset = tf.querySelector(".tf-reset"), gos = [].slice.call(tf.querySelectorAll(".tf-go"));
    var showBtn = tf.querySelector(".tf-show"), topBox = tf.querySelector(".tf-top"), listBox = tf.querySelector(".tl");
    var list = tf.querySelector(".tl-list"), sep = tf.querySelector(".tl-sep"), count = tf.querySelector(".tf-count");
    var rows = [].slice.call(tf.querySelectorAll(".tl-row")), pics = [].slice.call(tf.querySelectorAll(".tl-frame img"));
    var cap = tf.querySelector(".tl-photo figcaption"), capT = tf.querySelector(".tl-cap-t"), capS = tf.querySelector(".tl-cap-s");
    if (!me || !we || blanks.length !== 4 || !chipsBox || !list || !sep || !gos.length || !topBox || !listBox ||
        rows.length !== data.tours.length) { html.classList.remove("tf-intro", "tf-dark"); return; }
    window.sbTfReady = true;
    // the site may live in a sub-folder (build.py apply_base_path): links and photos made here get the same start
    var planHref = gos[0].getAttribute("href"), base = planHref.replace(/\/contact-us\/#plan$/, "");
    var why0 = rows.map(function (r) { return r.querySelector(".tl-why").innerHTML; });
    var rowOf = {};
    rows.forEach(function (r) { rowOf[r.getAttribute("data-i")] = r; });
    var WHO = ["on my own", "a couple", "a family with kids", "a group of friends"];
    var LEN = [["a single day", 1, 1], ["about a week", 2, 8], ["10 to 12 days", 9, 13], ["two weeks or more", 14, 99]];
    var Q = ["Who’s coming?", "When are you travelling?", "How long have you got?", "What would you love? Pick as many as you like"];
    var PH = ["who?", "when?", "how long?", "what?"];
    var s = { who: -1, month: -1, len: -1, love: [] }, step = 0, shown = 0, capTimer = 0, drawn = false;
    // answers from earlier in this visit (a reload wipes them first: the little script in the page, build.py)
    try {
      var kept = JSON.parse(sessionStorage.getItem("sbTfS") || "null");
      if (kept) {
        if (kept.who >= 0 && kept.who < WHO.length) s.who = kept.who;
        if (kept.len >= 0 && kept.len < LEN.length) s.len = kept.len;
        if (kept.love && kept.love.filter) s.love = kept.love.filter(function (w) { return data.words.indexOf(w) >= 0; });
      }
    } catch (err) { /* start empty */ }
    var had = getMonth();
    if (had !== null && had >= 0 && had < 12) s.month = had;
    // from the home page's "Want it all?" (/tours/?love=beaches#find): that word is picked, and the question
    // shown is "What would you love?", ready for more
    var given = window.URLSearchParams ? new URLSearchParams(location.search).get("love") : null;
    if (given) given.split(",").forEach(function (w) {
      w = w.trim().toLowerCase();
      if (data.words.indexOf(w) >= 0 && s.love.indexOf(w) < 0) s.love.push(w);
    });
    step = s.who < 0 ? 0 : s.month < 0 ? 1 : s.len < 0 ? 2 : 3;
    if (location.hash === "#find" && given) step = 3;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var andList = function (a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; };
    var cap1 = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
    // in the big sentence a long list of trip words is cut short ("beaches, safaris, history and 3 more"), and all
    // of them is "a bit of everything"; the sentence sent with an enquiry always names every one (full)
    var loves = function (full) {
      var n = s.love.length;
      if (full || n <= 3) return andList(s.love);
      if (n === data.words.length) return "a bit of everything";
      return s.love.slice(0, 3).join(", ") + " and " + (n - 3) + " more";
    };
    var value = function (q, full) {
      return q === 0 ? (s.who >= 0 ? WHO[s.who] : "") : q === 1 ? (s.month >= 0 ? data.months[s.month] : "")
        : q === 2 ? (s.len >= 0 ? LEN[s.len][0] : "") : loves(full);
    };
    var options = function (q) {
      return q === 0 ? WHO : q === 1 ? data.months.map(function (m) { return m.slice(0, 3); })
        : q === 2 ? LEN.map(function (l) { return l[0]; }) : data.words.map(cap1);
    };
    var chosen = function (q, i) { return q === 3 ? s.love.indexOf(data.words[i]) >= 0 : [s.who, s.month, s.len][q] === i; };
    var anything = function () { return s.who >= 0 || s.month >= 0 || s.len >= 0 || s.love.length > 0; };
    var sentence = function () {
      var solo = s.who === 0, v = [0, 1, 2, 3].map(function (q) { return value(q, true); });
      return (solo ? "I’m " : "We’re ") + (v[0] || "travelling") + (v[1] ? ", travelling in " + v[1] : "") +
        (v[2] ? " for " + v[2] : "") + (v[3] ? ", and " + (solo ? "I’d" : "we’d") + " love " + v[3] : "") + ".";
    };

    // the photos behind the full-screen sentence: the trip-word photos, one after another, slowly drifting; pointing
    // at a trip word (or picking one) brings up its photo, and after that only the picked ones take turns
    var bg = tf.querySelector(".tf-bg"), bgImgs = {}, bgOn = null, bgK = 0, bgTimer = 0;
    var intro = function () { return html.classList.contains("tf-intro"); };
    var bgShow = function (w) {
      var p = data.photos && data.photos[w];
      if (!bg || !p || !p[0]) return;
      var im = bgImgs[w];
      if (!im) {
        im = new Image();
        im.alt = "";
        im.decoding = "async";
        if (p[1]) im.style.objectPosition = p[1];
        im.src = base + p[0];
        bg.appendChild(im);
        bgImgs[w] = im;
      }
      if (bgOn === im) return;
      bgOn = im;
      var on = function () {   // once it has loaded (and is still the one wanted), it alone shows
        if (bgOn !== im) return;
        for (var k in bgImgs) bgImgs[k].classList.toggle("on", bgImgs[k] === im);
      };
      if (im.complete && im.naturalWidth) on(); else im.onload = on;
    };
    var cycle = function () {
      clearTimeout(bgTimer);
      if (!intro() || calmDest) return;
      bgTimer = setTimeout(function () {
        var pool = s.love.length ? s.love : data.words;
        bgK = (bgK + 1) % pool.length;
        bgShow(pool[bgK]);
        cycle();
      }, 5200);
    };

    var drawSentence = function (changed) {
      var solo = s.who === 0;
      me.textContent = solo ? "I’m" : "We’re";
      we.textContent = solo ? "I’d" : "we’d";
      blanks.forEach(function (b, q) {
        var v = value(q);
        b.textContent = v || PH[q];
        b.classList.toggle("empty", !v);
        b.classList.toggle("on", q === step);
        if (q === changed) { b.classList.remove("new"); void b.offsetWidth; b.classList.add("new"); }
      });
    };
    var drawAsk = function () {
      qEl.textContent = Q[step];
      stepEl.textContent = (step + 1) + " of 4";
      chipsBox.className = "tf-chips at-" + step;
      chipsBox.innerHTML = options(step).map(function (o, i) {
        var p = step === 3 && data.photos ? data.photos[data.words[i]] : null;
        return '<button type="button" class="tf-c' + (p && p[0] ? " has-av" : "") + '" data-i="' + i + '" aria-pressed="' + chosen(step, i) +
          '" style="animation-delay:' + (i * 0.03).toFixed(2) + 's">' +
          (p && p[0] ? '<span class="tf-av"><img src="' + escHtml(base + p[0]) + '" alt=""' +
            (p[1] ? ' style="object-position:' + escHtml(p[1]) + '"' : "") + "></span>" : "") +
          '<span class="tf-cl">' + escHtml(o) + "</span></button>";
      }).join("");
      void chipsBox.offsetWidth;
      chipsBox.classList.add("in");
      skip.hidden = step === 3;
      reset.hidden = !anything();
    };
    // the big photo beside the list and its caption: the tour you point at
    var show = function (i) {
      rows.forEach(function (r) { r.classList.toggle("on", +r.getAttribute("data-i") === i); });
      if (i === shown || pics.length < 2) return;
      shown = i;
      // each tour has its own photo in the frame (build.py), with its WebP copies in srcset: the photo is loaded
      // the first time its tour is pointed at, and fades in once it has arrived (unless another tour has been
      // pointed at meanwhile)
      var t = data.tours[i], pic = null;
      pics.forEach(function (p) { if (+p.getAttribute("data-i") === i) pic = p; });
      if (!pic) return;
      var swap = function () {
        if (shown !== i) return;
        pics.forEach(function (p) { p.classList.toggle("on", p === pic); });
      };
      if (pic.hasAttribute("data-src")) {
        if (pic.hasAttribute("data-srcset")) pic.setAttribute("srcset", pic.getAttribute("data-srcset"));
        pic.setAttribute("src", pic.getAttribute("data-src"));
        pic.removeAttribute("data-src");
        pic.removeAttribute("data-srcset");
      }
      if (pic.complete && pic.naturalWidth) swap();
      else { pic.onload = swap; pic.onerror = swap; }
      if (cap) {
        clearTimeout(capTimer);
        cap.classList.add("swap");
        capTimer = setTimeout(function () { capT.textContent = t[0]; capS.textContent = t[7] || ""; cap.classList.remove("swap"); }, 230);
      }
    };
    rows.forEach(function (r) {
      var i = +r.getAttribute("data-i"), link = r.querySelector(".tl-link");
      r.addEventListener("mouseenter", function () { show(i); });
      r.addEventListener("focusin", function () { show(i); });
      // clicking a tour: the pale circle of every other page link takes it (with the tour's name, and its length
      // above, data-pt-lead). The user found the photo opening out of the frame jumpy here (2026-11-24). The tour
      // page's own big photo starts loading at once, so it is ready when the page opens.
      if (link) link.addEventListener("click", function (e) {
        if (leaving || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
        var t = data.tours[i];
        if (t[8]) { var pre = new Image(); pre.src = base + t[8]; }
      });
    });
    var rank = function () {
      var M = data.months, any = anything();
      return data.tours.map(function (t, i) {
        var days = t[3], dur = days === 1 ? "Day trip" : t[4], words = t[5], sea = t[6], sc = 0, why = [];
        var lenMark = 2;
        if (s.len >= 0) {
          var lo = LEN[s.len][1], hi = LEN[s.len][2];
          if (days >= lo && days <= hi) { sc += 3; lenMark = 1; }
          else { sc -= Math.min(Math.abs(days - lo), Math.abs(days - hi)) > 3 ? 5 : 1; lenMark = 0; dur += ", can be changed"; }
        } else if (days === 1) sc -= 2;   // day trips are add-ons, unless a single day is what they want
        why.push([lenMark, dur]);
        words.forEach(function (w) { var hit = s.love.indexOf(w) >= 0; if (hit) sc += 3; why.push([hit ? 1 : 2, cap1(w)]); });
        if (s.love.length && !s.love.some(function (l) { return words.indexOf(l) >= 0; })) sc -= 6;
        if (s.month >= 0 && sea) {
          var c = sea.charAt(s.month);
          if (c === "G") { sc += 3; why.push([1, "Best weather in " + M[s.month]]); }
          else if (c === "M") { sc += 1; why.push([1, "Good in " + M[s.month]]); }
          else { sc -= 4; why.push([0, "Rainy season in " + M[s.month]]); }
        }
        if (s.who === 2 && words.indexOf("family fun") >= 0) { sc += 3; why.push([1, "Good with children"]); }
        if (s.who === 1 && words.indexOf("romance") >= 0) { sc += 2; why.push([1, "Made for two"]); }
        if (s.who === 3 && words.indexOf("adventure") >= 0) { sc += 1; why.push([1, "Great with friends"]); }
        return { i: i, sc: any ? sc : 0, why: why };
      }).sort(function (a, b) { return b.sc - a.sc || a.i - b.i; });
    };
    var whyHtml = function (x, best) {
      return (best ? '<span class="tl-best">Best match</span>' : "") + x.why.map(function (w) {
        return "<span" + (w[0] === 1 ? ' class="ok"' : w[0] === 0 ? ' class="no"' : "") + ">" + escHtml(w[1]) + "</span>";
      }).join("");
    };
    var drawList = function () {
      var any = anything(), res = rank(), fits = any ? res.filter(function (x) { return x.sc > 0; }).length : res.length;
      var glide = drawn && !calmDest && !intro();
      var before = glide ? rows.map(function (r) { return r.getBoundingClientRect().top; }) : null;
      res.forEach(function (x, k) {
        var r = rowOf[x.i];
        if (any && k === fits) list.appendChild(sep);
        list.appendChild(r);
        r.querySelector(".tl-n").textContent = pad(k + 1);
        r.classList.toggle("dim", any && x.sc <= 0);
        r.querySelector(".tl-why").innerHTML = any ? whyHtml(x, k === 0 && x.sc > 0) : why0[x.i];
        [].forEach.call(r.querySelectorAll(".tl-ms i"), function (c, m) { c.classList.toggle("x", m === s.month); });
      });
      sep.hidden = !(any && fits < res.length);
      if (sep.hidden) list.appendChild(sep);
      count.textContent = !any ? "All " + res.length + " tours" : fits === 0 ? "None fits exactly, and every tour can be changed"
        : fits === 1 ? "1 tour fits you" : fits + " tours fit you, best first";
      if (showBtn) showBtn.firstChild.textContent = !any || !fits ? "Show all " + res.length + " tours"
        : fits === 1 ? "Show my tour" : "Show my " + fits + " tours";
      if (glide) {   // each row glides from where it was to its new place
        rows.forEach(function (r, j) {
          var dy = before[j] - r.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) return;
          r.style.transition = "none";
          r.style.transform = "translateY(" + dy.toFixed(1) + "px)";
        });
        void list.offsetHeight;
        rows.forEach(function (r) {
          if (!r.style.transform) return;
          r.style.transition = "transform .7s cubic-bezier(.2, .7, .2, 1), opacity .4s";
          r.style.transform = "";
        });
      }
      show(res[0].i);
      var top = fits ? data.tours[res[0].i][0] : "";
      gos.forEach(function (g) {
        g.setAttribute("href", any ? planHref.split("#")[0] + "?trip=" + encodeURIComponent(sentence()) +
          (top ? "&tour=" + encodeURIComponent(top) : "") + "#plan" : planHref);
      });
      drawn = true;
    };
    var draw = function (changed) {
      drawSentence(changed);
      drawAsk();
      drawList();
      try { sessionStorage.setItem("sbTfS", JSON.stringify({ who: s.who, len: s.len, love: s.love })); } catch (err) { /* not kept */ }
    };
    chipsBox.addEventListener("click", function (e) {
      var c = e.target.closest(".tf-c");
      if (!c) return;
      var i = +c.getAttribute("data-i"), q = step;
      if (q === 3) {
        var w = data.words[i];
        s.love = s.love.indexOf(w) >= 0 ? s.love.filter(function (x) { return x !== w; }) : s.love.concat([w]);
        if (s.love.indexOf(w) >= 0) { bgShow(w); cycle(); }
      } else {
        s[["who", "month", "len"][q]] = i;
        if (q === 1) setMonth(i);
        step = q + 1;
      }
      draw(q);
    });
    // pointing at a trip word brings up its photo behind the sentence
    chipsBox.addEventListener("mouseover", function (e) {
      var c = e.target.closest(".tf-c.has-av");
      if (!c || !intro()) return;
      bgShow(data.words[+c.getAttribute("data-i")]);
      cycle();
    });
    blanks.forEach(function (b, q) {
      b.addEventListener("click", function () { step = q; draw(-1); });
      b.addEventListener("keydown", function (e) {   // the blanks are spans acting as buttons: Enter and Space work
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step = q; draw(-1); }
      });
    });
    skip.addEventListener("click", function () { step = Math.min(3, step + 1); draw(-1); });
    reset.addEventListener("click", function () { s = { who: -1, month: -1, len: -1, love: [] }; step = 0; draw(-1); });

    // "Show my tours": the photos fade to white, then the sentence glides up into its usual place and the tours
    // rise in under it. It happens once a visit.
    var reveal = function () {
      if (!intro()) return;
      try { sessionStorage.setItem("sbTf", "1"); } catch (err) { /* asks again next time */ }
      // from here the page scrolls normally, and Back from a tour returns to the same spot in the list
      if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      clearTimeout(bgTimer);
      html.classList.remove("tf-dark");
      // the page's full-screen photo stays hidden from here on (the sentence takes the top), so the header fades
      // to its look on white, not the see-through one it has over a photo
      body.classList.remove("over-photo");
      var settle = function () {
        var y0 = topBox.getBoundingClientRect().top;
        html.classList.remove("tf-intro");
        html.classList.add("tf-after");
        window.scrollTo({ top: 0, behavior: "instant" });
        var y1 = topBox.getBoundingClientRect().top;
        if (!calmDest && Math.abs(y0 - y1) > 1) {
          topBox.style.transition = "none";
          topBox.style.transform = "translateY(" + (y0 - y1).toFixed(1) + "px)";
          void topBox.offsetWidth;
          topBox.style.transition = "transform .9s cubic-bezier(.2, .7, .2, 1)";
          topBox.style.transform = "";
        }
        listBox.classList.add("tl-in");
        drawn = true;
      };
      if (calmDest) settle(); else setTimeout(settle, 520);
    };
    if (showBtn) showBtn.addEventListener("click", reveal);

    // the old "Day tours" link: start on a single day
    var dayTrips = function () {
      if (location.hash !== "#wildlife") return false;
      s.len = 0;
      if (step === 2) step = 3;
      return true;
    };
    var jump = dayTrips();
    draw(-1);
    if (intro()) {
      window.scrollTo({ top: 0, behavior: "instant" });
      bgShow(s.love[0] || data.words[0]);
      cycle();
    }
    // arriving on #wildlife or #find (from "Want it all?" or the retired mix page): open right there, past the
    // photo at the top (a jump, not the smooth scroll, as with any link to a spot on a page). The full-screen
    // sentence is already at the top, so it needs no jump.
    var land = jump ? listBox : location.hash === "#find" && !intro() ? topBox : null;
    if (land) land.scrollIntoView({ block: "start", behavior: "instant" });
    window.addEventListener("hashchange", function () { if (dayTrips()) { reveal(); draw(-1); listBox.scrollIntoView(); } });
  });

  // ---- contact form: a sentence from the tour finder (?trip=…&tour=…), or ?mix=… from old links to the retired mix page, is
  // written into the message, and the tour picked in the list, so nobody has to type it again
  (function () {
    var form = d.querySelector(".plan-form");
    if (!form || !location.search || !window.URLSearchParams) return;
    var q = new URLSearchParams(location.search), msg = form.querySelector("textarea[name=message]"), sel = form.querySelector("select[name=tour]");
    var trip = q.get("trip"), mix = q.get("mix"), tour = q.get("tour");
    if (msg && !msg.value) {
      if (trip) msg.value = trip + "\n\n";
      else if (mix) msg.value = "I want a trip full of " + mix.split(",").join(", ") + ".\n\n";
    }
    if (sel && tour) [].forEach.call(sel.options, function (o) { if (o.text === tour) sel.value = o.value; });
  })();

  // ---- About us (layout "about"; build.py about_open, about_since, about_chapters): the page as a journey in chapters.
  // Photos move at different depths as you scroll (parallax), things rise in as they come into view, the numbers
  // count up. (Guests' words, one at a time, are further down: the home page has them too.)
  if (body.classList.contains("layout-about")) (function () {
    var calm = calmMotion(), vh = window.innerHeight, busy = false;

    // parallax: [element, depth, how far it may move as a share of its frame (0 = no limit)]. Each moves by its
    // distance from the middle of the screen times its depth, measured on its still frame (never on itself).
    var par = [];
    var add = function (sel, depth, limit) { d.querySelectorAll(sel).forEach(function (el) { par.push([el, depth, limit]); }); };
    add(".layout-about .who .gallery figure:nth-child(1)", .06, 0);
    add(".layout-about .who .gallery figure:nth-child(2)", .18, 0);
    add(".layout-about .who .gallery figure:nth-child(3)", .32, 0);
    add(".layout-about :is(.window, .end) .gallery.n1 img", .3, .115);
    add(".ab-year", .3, 0);
    add(".layout-about .letter .gallery img", .1, .065);
    add(".layout-about .footprints .gallery.n1 img", .22, .11);
    add(".layout-about .footprints .gallery.n3 figure:nth-child(1)", .04, 0);
    add(".layout-about .footprints .gallery.n3 figure:nth-child(2)", .13, 0);
    add(".layout-about .footprints .gallery.n3 figure:nth-child(3)", .08, 0);
    var openImg = d.querySelector(".ab-open-bg img"), openBox = d.querySelector(".ab-open");
    // the full-width photo windows (and the finale): the photo settles from a slight zoom as it passes through the
    // screen, and the words rise a little faster than the page
    var windows = [].slice.call(d.querySelectorAll(".layout-about .window, .layout-about .end"));
    var drift = function () {
      if (openImg && openBox) openImg.style.setProperty("--py", (Math.min(window.scrollY, openBox.offsetHeight) * .32).toFixed(1) + "px");
      windows.forEach(function (w) {
        var r = w.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var k = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        w.style.setProperty("--ps", (1.16 - .16 * k).toFixed(4));
        w.style.setProperty("--ty", ((.5 - k) * 90).toFixed(1) + "px");
      });
      par.forEach(function (p) {
        var el = p[0], ref = el.closest(".gallery") || el.closest(".chapter") || el.parentNode, r = ref.getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) return;
        // on small screens everything moves about a third as far, so photos never drift over the words
        var v = -((r.top + r.height / 2) - vh / 2) * p[1] * (window.innerWidth < 980 ? .35 : 1);
        if (p[2]) { var lim = el.parentNode.offsetHeight * p[2]; v = Math.max(-lim, Math.min(lim, v)); }
        el.style.setProperty("--py", v.toFixed(1) + "px");
      });
    };

    // rise in as they come into view
    if (!calm && "IntersectionObserver" in window) {
      var seen = new IntersectionObserver(function (list) {
        list.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); seen.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
      d.querySelectorAll(".layout-about .chapter .wrap > :not(ul):not(.ab-since), .layout-about .chapter .wrap > ul > li, .layout-about .ab-stats li")
        .forEach(function (el) {
          var k = [].indexOf.call(el.parentNode.children, el);
          if (el.tagName === "LI") el.style.transitionDelay = ((k % 6) * .07).toFixed(2) + "s";
          el.classList.add("rv");
          seen.observe(el);
        });
    }

    // the numbers count up the first time they come into view
    var stats = [].slice.call(d.querySelectorAll(".ab-stats strong[data-to]"));
    var fmt = function (el, n) {
      var s = String(n), pad = +el.getAttribute("data-pad") || 0;
      while (s.length < pad) s = "0" + s;
      return (el.getAttribute("data-pre") || "") + s + (el.getAttribute("data-suf") || "");
    };
    if (stats.length && !calm && "IntersectionObserver" in window) {
      stats.forEach(function (el) { el.textContent = fmt(el, 0); });
      var counted = new IntersectionObserver(function (list) {
        if (!list.some(function (e) { return e.isIntersecting; })) return;
        counted.disconnect();
        var t0 = 0;
        var tick = function (t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 1700), ease = 1 - Math.pow(1 - k, 3);
          stats.forEach(function (el) { el.textContent = fmt(el, Math.round(+el.getAttribute("data-to") * ease)); });
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { threshold: .4 });
      counted.observe(stats[0].closest(".ab-stats"));
    }

    var frame = function () { busy = false; vh = window.innerHeight; if (!calm) drift(); };
    window.addEventListener("scroll", function () { if (!busy) { busy = true; requestAnimationFrame(frame); } }, { passive: true });
    window.addEventListener("resize", frame);
    window.addEventListener("load", frame);
    frame();
  })();

  // ---- "Places our guests love" on the home page (build.py place_show): the main places one at a time, full
  // screen, as a 3D scene seen through a camera (site.css .place-show). The names along the bottom, the arrows, a
  // swipe or the arrow keys change place: the camera flies forward through the scene (back for "previous"). While
  // the section is on screen it moves on by itself: the line over the current name fills (CSS), and when it is
  // full the next place comes. It waits while you point at the prints, use the bar or the keyboard.
  // The camera: it turns a little towards the pointer, drifts slowly on its own when nothing moves it, follows a
  // finger dragging sideways on phones, and comes closer as the section scrolls up the screen. It only runs while
  // the section is on screen, and never for people who asked for less motion. The other places' photos load once
  // the section is near.
  d.querySelectorAll("[data-sx]").forEach(function (sec) {
    var slides = [].slice.call(sec.querySelectorAll(".sx-slide")), tabs = [].slice.call(sec.querySelectorAll(".sx-tab"));
    var bgs = [].slice.call(sec.querySelectorAll(".sx-bgs img")), count = sec.querySelector(".sx-count b");
    var cam = sec.querySelector(".sx-cam"), stage = sec.querySelector(".sx-stage");
    var n = slides.length, i = 0, calm = calmMotion(), setT = 0, seen = false, near = false, over = false, inside = false;
    var offT = [];
    if (!n || !cam) return;
    var pad2 = function (k) { return (k < 10 ? "0" : "") + k; };
    var loadAll = function () {
      sec.querySelectorAll("img[data-src]").forEach(function (img) {
        if (img.hasAttribute("data-srcset")) { img.srcset = img.getAttribute("data-srcset"); img.removeAttribute("data-srcset"); }
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
      });
    };
    var land = function () { clearTimeout(setT); setT = setTimeout(function () { slides[i].classList.add("set"); }, calm ? 0 : 1700); };
    // dir: 1 = fly forward (the next place), -1 = back
    var show = function (k, dir) {
      k = (k + n) % n;
      if (k === i && slides[i].classList.contains("on")) return;
      sec.classList.toggle("sx-back", dir < 0);
      sec.classList.remove("sx-focus");
      // the new place has to be waiting at the right end of the flight before it sets off
      void slides[k].offsetWidth;
      var old = slides[i];
      if (old !== slides[k] && old.classList.contains("on")) {
        old.classList.remove("on", "set");
        old.classList.add("off");
        clearTimeout(offT[i]);
        offT[i] = setTimeout(function () { old.classList.remove("off"); }, 1150);
        old.setAttribute("aria-hidden", "true");
        old.setAttribute("tabindex", "-1");
      }
      i = k;
      clearTimeout(offT[i]);
      slides[i].classList.remove("off");
      slides[i].classList.add("on");
      slides[i].removeAttribute("aria-hidden");
      slides[i].removeAttribute("tabindex");
      tabs.forEach(function (t, j) { t.classList.toggle("on", j === i); if (j === i) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
      bgs.forEach(function (b, j) { b.classList.toggle("on", j === i); });
      if (count) count.textContent = pad2(i + 1);
      land();
    };
    var run = function () { sec.classList.toggle("sx-run", seen && !over && !inside && !d.hidden); };
    tabs.forEach(function (t, j) {
      t.addEventListener("click", function () { show(j, j < i ? -1 : 1); });
      // the line over the current name has filled up: on to the next place
      t.addEventListener("animationend", function () { if (j === i && sec.classList.contains("sx-run")) show(i + 1, 1); });
    });
    sec.querySelector(".sx-prev").addEventListener("click", function () { show(i - 1, -1); });
    sec.querySelector(".sx-next").addEventListener("click", function () { show(i + 1, 1); });
    sec.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { show(i + 1, 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { show(i - 1, -1); e.preventDefault(); }
    });
    // pointing at the prints pulls focus to them (and holds the place still); so does the bar or the keyboard
    slides.forEach(function (s) {
      s.addEventListener("mouseenter", function () { over = true; run(); if (s.classList.contains("on")) sec.classList.add("sx-focus"); });
      s.addEventListener("mouseleave", function () { over = false; run(); sec.classList.remove("sx-focus"); });
    });
    var bar = sec.querySelector(".sx-bar");
    bar.addEventListener("mouseenter", function () { over = true; run(); });
    bar.addEventListener("mouseleave", function () { over = false; run(); });
    sec.addEventListener("focusin", function () { inside = true; run(); });
    sec.addEventListener("focusout", function (e) { if (!sec.contains(e.relatedTarget)) { inside = false; run(); } });
    d.addEventListener("visibilitychange", run);

    // the camera
    var cur = { x: 0, y: 0 }, aim = { x: 0, y: 0 }, led = false, raf = 0, t0 = 0;
    var frame = function (t) {
      raf = 0;
      if (!near) return;
      if (!t0) t0 = t;
      if (!led) {   // nothing is moving it: a slow drift, never quite repeating
        var s = (t - t0) / 1000;
        aim.x = Math.sin(s * .23) * .32 + Math.sin(s * .071) * .14;
        aim.y = Math.cos(s * .17) * .2;
      }
      cur.x += (aim.x - cur.x) * .055;
      cur.y += (aim.y - cur.y) * .055;
      var r = sec.getBoundingClientRect(), vh = window.innerHeight;
      // 0 while the section's top is at the bottom of the screen, .5 when it fills the screen, 1 when it has gone
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      var dolly = (p - .5) * 340, tilt = (p - .5) * -7;
      cam.style.transform = "translate3d(" + (cur.x * -16).toFixed(2) + "px," + (cur.y * -10).toFixed(2) + "px," + dolly.toFixed(1) + "px) " +
        "rotateX(" + (cur.y * -4.5 + tilt).toFixed(3) + "deg) rotateY(" + (cur.x * 7).toFixed(3) + "deg)";
      sec.style.setProperty("--px", cur.x.toFixed(4));
      sec.style.setProperty("--py", cur.y.toFixed(4));
      raf = requestAnimationFrame(frame);
    };
    var wake = function () { if (!raf && near && !calm) raf = requestAnimationFrame(frame); };
    sec.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = sec.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));
      led = true;
    });
    sec.addEventListener("pointerleave", function () { led = false; });

    // swipe sideways (phones): the camera follows the finger, and far enough is the next or previous place;
    // the tap that ends a swipe doesn't open the place
    var sx = 0, sy = 0, swiped = false;
    stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiped = false; }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy)) { led = true; aim.x = Math.max(-1, Math.min(1, -dx / 140)); aim.y = 0; }
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      led = false;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = true; show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
    }, { passive: true });
    stage.addEventListener("click", function (e) { if (swiped) { e.preventDefault(); swiped = false; } }, true);

    if (!calm) sec.classList.add("sx-auto");
    if ("IntersectionObserver" in window) {
      // the first place flies in when the section first comes into view
      if (!calm) slides[0].classList.remove("on");
      new IntersectionObserver(function (es, io) {
        if (es[0].isIntersecting) { loadAll(); io.disconnect(); }
      }, { rootMargin: "100% 0px" }).observe(sec);
      new IntersectionObserver(function (es) { near = es[0].isIntersecting; wake(); }).observe(sec);
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        if (seen && !slides[i].classList.contains("on")) show(i, 1);
        run();
      }, { threshold: .45 }).observe(sec);
    } else {
      loadAll();
      land();
    }
  });

  // ---- guests' words ("::: band guests" around {{testimonials}}, on the home and About pages): one review at a
  // time, large, with arrows and "01 / 05". It moves on by itself every few seconds, but only while it is on
  // screen and the pointer isn't resting on it (and never for people who asked for less motion).
  d.querySelectorAll(".guests .quotes").forEach(function (box) {
    var qs = [].slice.call(box.querySelectorAll(".quote")), n = qs.length, i = 0, timer = 0, seen = true, calm = calmMotion();
    if (n < 2) return;
    var arrowSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var pad2 = function (k) { return (k < 10 ? "0" : "") + k; };
    box.classList.add("ab-q");
    var nav = d.createElement("div");
    nav.className = "ab-qnav";
    nav.innerHTML = '<button type="button" class="ab-qprev" aria-label="Previous review">' + arrowSvg + '</button>' +
      '<span class="ab-qn" aria-live="polite"></span><button type="button" class="ab-qnext" aria-label="Next review">' + arrowSvg + "</button>";
    box.parentNode.insertBefore(nav, box.nextSibling);
    var num = nav.querySelector(".ab-qn");
    var show = function (k) {
      i = (k + n) % n;
      qs.forEach(function (q, j) { q.classList.toggle("on", j === i); q.setAttribute("aria-hidden", j === i ? "false" : "true"); });
      num.textContent = pad2(i + 1) + " / " + pad2(n);
    };
    var auto = function () { clearTimeout(timer); if (!calm && seen) timer = setTimeout(function () { show(i + 1); auto(); }, 8000); };
    nav.querySelector(".ab-qprev").addEventListener("click", function () { show(i - 1); auto(); });
    nav.querySelector(".ab-qnext").addEventListener("click", function () { show(i + 1); auto(); });
    box.addEventListener("mouseenter", function () { clearTimeout(timer); });
    box.addEventListener("mouseleave", auto);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) auto(); else clearTimeout(timer); }).observe(box);
    }
    show(0);
    auto();
  });

  // ---- home page motion: smooth scrolling, "pin and play" sections and fade-up reveals.
  // On big screens the hero, "Who we are" and the tour wheel are stacked like cards: each one holds still
  // while your scrolling plays its effect, then the next one slides up over it. Phones (where these
  // sections are taller than the screen) just get gentle fade-up reveals. Nothing moves for people who
  // have asked their device for reduced motion.
  if (body.classList.contains("layout-home") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var hero = d.querySelector(".hero-home"), intro = d.querySelector(".band.intro"), tw = d.querySelector(".trip-wheel");
    var stacked = !!(hero && intro && tw) && window.matchMedia("(min-width: 980px)").matches;

    // reveal: things fade up into place the first time they scroll into view (the stacked sections run
    // their own effects instead)
    if ("IntersectionObserver" in window) {
      var rv = [];
      var skip = function (el) { return stacked && el.closest(".band.intro, .trip-wheel"); };
      d.querySelectorAll(".band .wrap > .kicker, .band .wrap > h2, .band .wrap > p, .intro-text > *, .ia-photo, .tg-intro > *, .tw-inner > *, .partners")
        .forEach(function (el) { if (!skip(el)) rv.push(el); });
      // (the reviews shown one at a time rise in as one block: their hidden ones must stay hidden)
      d.querySelectorAll(".quotes.ab-q, .ab-qnav").forEach(function (el) { rv.push(el); });
      d.querySelectorAll(".band .grid, .stats .wrap, .quotes:not(.ab-q)").forEach(function (g) {
        if (skip(g)) return;
        [].forEach.call(g.children, function (el, n) { el.style.setProperty("--rv-delay", Math.min(n, 5) * 0.08 + "s"); rv.push(el); });
      });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          io.unobserve(el);
          el.classList.add("in");
          // once it has arrived, hand the element back to its normal styles (hover effects and so on)
          setTimeout(function () { el.classList.remove("rv", "in"); el.style.removeProperty("--rv-delay"); }, 1700);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      rv.forEach(function (el) { el.classList.add("rv"); io.observe(el); });
    }

    // smooth scrolling: computers with a mouse
    var lenis = (window.Lenis && window.matchMedia("(hover: hover) and (pointer: fine)").matches) ? new window.Lenis({ lerp: 0.09 }) : null;
    if (lenis) {
      d.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]'), to = a && a.getAttribute("href").length > 1 && d.querySelector(a.getAttribute("href"));
        if (!to) return;
        e.preventDefault();
        var hdr = d.querySelector(".site-header");
        lenis.scrollTo(to, { offset: -(hdr ? hdr.offsetHeight : 0), duration: 1.4 });
      });
    }

    if (stacked) {
      // put the three sections in one stack, each followed by an empty stretch of page: while that stretch
      // scrolls past, its section stays pinned and plays its effect (the stretch lengths are in site.css)
      var stack = d.createElement("div");
      stack.className = "pin-stack";
      hero.parentNode.insertBefore(stack, hero);
      var spaces = [];
      [hero, intro, tw].forEach(function (sec, k) {
        var sp = d.createElement("div");
        sp.className = "pin-space pin-space-" + k;
        sp.setAttribute("aria-hidden", "true");
        stack.appendChild(sec);
        stack.appendChild(sp);
        spaces.push(sp);
      });
      d.documentElement.classList.add("pinned");

      var heroInner = hero.querySelector(".hh-inner"), heroPic = hero.querySelector(".hh-media") || hero.querySelector("picture");
      // "Who we are": wrap each word of the big statement so it can light up as you scroll
      var introWords = [], introBtn = intro.querySelector(".intro-text > p:last-child");
      var statement = intro.querySelector(".intro-text > p:not(.kicker):not(:last-child)");
      if (statement) {
        var wrapWords = function (node) {
          [].slice.call(node.childNodes).forEach(function (n) {
            if (n.nodeType === 3) {
              var frag = d.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(part)); return; }
                var w = d.createElement("span");
                w.className = "w";
                w.textContent = part;
                frag.appendChild(w);
                introWords.push(w);
              });
              n.parentNode.replaceChild(frag, n);
            } else if (n.nodeType === 1) { wrapWords(n); }
          });
        };
        wrapWords(statement);
      }
      var iaPhoto = intro.querySelector(".ia-photo img"), iaBadge = intro.querySelector(".ia-badge");
      // the label and the two lines of the motto, which rise into place in turn; then the three promises
      var mottoSteps = [intro.querySelector(".intro-text > .kicker")].concat([].slice.call(intro.querySelectorAll(".ia-words > span"))).filter(Boolean);
      var promises = intro.querySelector(".intro-text > ol");
      var twPhotos = tw.querySelector(".tw-photos"), twRot = tw.querySelector(".tw-rot"), twRing = tw.querySelector(".tw-ring");
      var twLate = [tw.querySelector(".tw-turn"), tw.querySelector(".tw-line"), tw.querySelector(".tw-btns")].filter(Boolean);

      var vh = window.innerHeight, lastY = -1;
      var mix = function (a, b, t) { return a + (b - a) * t; };
      // a dark layer that fades in to dim a section as the next one slides over it (much lighter for the
      // browser than a brightness filter, which would redraw the hero's film on every frame)
      var dimLayer = function (sec) { var el = d.createElement("div"); el.className = "sb-dim"; el.setAttribute("aria-hidden", "true"); sec.appendChild(el); return el; };
      var heroDim = dimLayer(hero), introDim = dimLayer(intro);
      var render = function () {
        // p[k]: how far through section k's own effect we are (0 to 1);
        // c[k]: how far the next section has slid up over it (0 to 1)
        var p = spaces.map(function (sp) { var r = sp.getBoundingClientRect(); return clamp((vh - r.top) / r.height); });
        var c = [intro, tw, null].map(function (next) {
          if (!next) return 0;
          var r = next.getBoundingClientRect(), top = parseFloat(getComputedStyle(next).top) || 0;
          return clamp((vh - r.top) / (vh - top));
        });

        // 1. hero: the words lift away and the photo slowly zooms; it stays full size the whole time and
        // only dims a little as "Who we are" slides up over it
        var t = clamp(p[0] / 0.5);
        heroInner.style.transform = "translate3d(0," + (-110 * t).toFixed(1) + "px,0)";
        heroInner.style.opacity = (1 - t).toFixed(3);
        heroPic.style.transform = "scale(" + mix(1, 1.14, p[0]).toFixed(4) + ")";
        heroDim.style.opacity = (0.4 * c[0]).toFixed(3);
        // the film rests once "Who we are" covers the hero completely
        var covered = c[0] > 0.99;
        if (covered !== hvState.covered) { hvState.covered = covered; hvSync(); }

        // 2. "Who we are": while it slides up over the hero, its photo settles (it moves slower than its
        // frame and zooms out a little) and the motto rises in line by line; scrolling on, the statement
        // lights up word by word, then the promises and the button appear and the seal turns in
        if (iaPhoto) {
          iaPhoto.style.transform = "translate3d(0," + ((1 - c[0]) * -7 + p[1] * 5).toFixed(2) + "%,0) scale(" +
            (1.12 - 0.08 * c[0] - 0.04 * p[1]).toFixed(4) + ")";
        }
        mottoSteps.forEach(function (el, i) {
          var m = clamp((c[0] - 0.35 - i * 0.12) / 0.4);
          el.style.opacity = m.toFixed(3);
          el.style.transform = "translate3d(0," + (48 * (1 - m)).toFixed(1) + "px,0)";
        });
        var lit = clamp((p[1] - 0.02) / 0.5) * introWords.length;
        introWords.forEach(function (w, i) { w.style.opacity = (0.16 + 0.84 * clamp(lit - i)).toFixed(3); });
        [promises, introBtn].forEach(function (el, i) {
          if (!el) return;
          var b = clamp((p[1] - 0.48 - i * 0.1) / 0.18);
          el.style.opacity = b.toFixed(3);
          el.style.transform = "translate3d(0," + (20 * (1 - b)).toFixed(1) + "px,0)";
        });
        if (iaBadge) {
          var e = clamp((p[1] - 0.3) / 0.25);
          iaBadge.style.opacity = e.toFixed(3);
          iaBadge.style.transform = "rotate(" + mix(-70, -8, e).toFixed(1) + "deg) scale(" + mix(0.6, 1, e).toFixed(3) + ")";
        }
        introDim.style.opacity = (0.3 * c[1]).toFixed(3);

        // 3. tour wheel: the photo opens from a framed window to full size, the ring of words swings in,
        // then the rest fades in and the wheel is ready to turn
        var g = 1 - clamp(p[2] / 0.45);
        twPhotos.style.clipPath = "inset(" + (g * 14).toFixed(2) + "% " + (g * 9).toFixed(2) + "% round " + (g * 32).toFixed(1) + "px)";
        twPhotos.style.transform = "translate3d(0," + mix(-6, 6, p[2]).toFixed(2) + "%,0) scale(1.14)";
        var w = clamp((p[2] - 0.08) / 0.4);
        twRot.style.opacity = w.toFixed(3);
        twRot.style.transform = "rotate(" + (-28 * (1 - w)).toFixed(2) + "deg)";
        if (twRing) twRing.style.opacity = w.toFixed(3);
        var l = clamp((p[2] - 0.38) / 0.22);
        twLate.forEach(function (el) { el.style.opacity = l.toFixed(3); });
        var done = p[2] >= 0.6;
        if (tw.classList.contains("pin-done") !== done) {
          tw.classList.toggle("pin-done", done);
          window.dispatchEvent(new Event("scroll"));   // let the wheel re-check whether it may turn
        }
      };
      var frame = function (time) {
        if (lenis) lenis.raf(time);
        if (window.scrollY !== lastY) { lastY = window.scrollY; render(); }
        window.requestAnimationFrame(frame);
      };
      window.addEventListener("resize", function () { vh = window.innerHeight; lastY = -1; });
      window.requestAnimationFrame(frame);
    } else if (lenis) {
      var tick = function (time) { lenis.raf(time); window.requestAnimationFrame(tick); };
      window.requestAnimationFrame(tick);
    }
  }

  // ---- enquiry forms and the trip letter go two ways at once: into the inquiry box that the admin
  // panel reads (cfg.api, functions/api/inquiries.js, only on Cloudflare) and by email through
  // Web3Forms (cfg.key). Either one arriving is enough.
  var cfg = window.SB || {};
  var contactHtml = function () {
    return 'Please email us at <a href="mailto:' + cfg.email + '">' + cfg.email + '</a> or <a href="https://wa.me/' +
      cfg.whatsapp + '" target="_blank" rel="noopener">message us on WhatsApp</a>.';
  };
  var hasMailKey = function () { return !!cfg.key && cfg.key.indexOf("PASTE") !== 0; };
  var canSend = function () { return hasMailKey() || !!cfg.api; };
  var postJson = function (url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.success) throw new Error("failed");
      return true;
    });
  };
  var sendInquiry = function (data) {
    var ways = [];
    if (cfg.api) ways.push(postJson(cfg.api, data));
    if (hasMailKey()) {
      var mail = {};
      Object.keys(data).forEach(function (k) { mail[k] = data[k]; });
      mail.access_key = cfg.key;
      ways.push(postJson("https://api.web3forms.com/submit", mail));
    }
    if (!ways.length) return Promise.reject(new Error("off"));
    return new Promise(function (ok, no) {
      var left = ways.length;
      ways.forEach(function (p) { p.then(function () { ok(true); }, function () { if (--left === 0) no(new Error("failed")); }); });
    });
  };
  d.querySelectorAll("form.plan-form").forEach(function (form) {
    var status = form.querySelector(".form-status"), button = form.querySelector("[type=submit]");
    var say = function (cls, htmlText) { status.className = "form-status " + cls; status.innerHTML = htmlText; };
    form.addEventListener("input", function (e) { e.target.classList.remove("invalid"); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      form.querySelectorAll("[required]").forEach(function (el) {
        var v = el.value.trim();
        var ok = v !== "" && (el.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        el.classList.toggle("invalid", !ok);
        if (!ok && !firstBad) firstBad = el;
      });
      if (firstBad) { say("err", "Please fill in the highlighted fields."); firstBad.focus(); return; }
      if (form.elements.botcheck && form.elements.botcheck.checked) { say("ok", "Thank you! Your message has been sent."); return; }
      if (!canSend()) { say("err", "Sorry, this form isn’t connected yet. " + contactHtml()); return; }

      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== "botcheck" && v !== "") data[k] = v; });
      data.subject = (form.getAttribute("data-subject") || "Website enquiry") + (data.name ? " – " + data.name : "");
      data.from_name = "Sunbird website";
      data.page = location.href;
      data.form = "Form";
      button.disabled = true;
      say("", "Sending…");
      sendInquiry(data).then(function () {
        say("ok", "Thank you! We’ve received your request and will reply within 24 hours.");
        form.reset();
      }).catch(function () {
        say("err", "Sorry, something went wrong. " + contactHtml());
      }).then(function () { button.disabled = false; });
    });
  });

  // ---- the trip letter ({{letter}} on /contact-us/, build.py letter): the request written as a letter. On the page
  // it shows as it stands, with "Start my letter"; it is written full screen, so the letter, the step being answered
  // and at the end "Seal and send" are all on one screen. Every blue word is a blank, filled one after another in the
  // order of the letter: who's coming, country (picked from a list), when, the exact days and nights (a slider), what
  // they'd love, email and number, a P.S. and a name. Tapping a blue word goes straight to it. Answers from earlier
  // in the visit (the tour finder, the month question) and a draft of this letter are written in already. "Plan my
  // trip" links (/contact-us/#plan from another page of the site) open it full screen at once.
  (function () {
    var lt = d.querySelector(".lt"), box = lt && lt.closest(".lt-box"), dataEl = lt && lt.querySelector(".lt-data");
    if (!lt || !box || !dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (err) { return; }
    var q$ = function (sel) { return lt.querySelector(sel); };
    var plain = box.querySelector(".lt-plain"), tip = q$(".lt-tip"), bar = q$(".lt-top"), closeBtn = q$(".lt-close");
    var dots = [].slice.call(lt.querySelectorAll(".lt-dots li"));
    var mainEl = q$(".lt-main"), stage = q$(".lt-stage"), paper = q$(".lt-paper"), env = q$(".lt-env");
    var foot = q$(".lt-foot"), startBtn = q$(".lt-start"), sheet = q$(".lt-sheet"), ask = q$(".lt-ask"), ready = q$(".lt-ready");
    var pane = q$(".lt-pane"), errEl = q$(".lt-err"), qEl = q$(".lt-ask .lt-q"), stepEl = q$(".lt-step");
    var nextBtn = q$(".lt-next"), prevBtn = q$(".lt-prev");
    var sendBtn = q$(".lt-send"), wa = q$(".lt-wa"), status = q$(".lt-status");
    var done = q$(".lt-done"), tourLine = q$(".lt-tour-line"), hp = q$("[name=botcheck]");
    var blanks = {};
    lt.querySelectorAll(".lt-b").forEach(function (b) { blanks[b.getAttribute("data-q")] = b; });
    if (!plain || !bar || !closeBtn || !mainEl || !paper || !env || !foot || !startBtn || !sheet || !ask || !ready || !pane ||
        !nextBtn || !prevBtn || !sendBtn || !done || dots.length !== 8 ||
        ["who", "country", "when", "len", "love", "tour", "email", "phone", "ps", "name"].some(function (q) { return !blanks[q]; })) return;
    // the site may live in a sub-folder (build.py apply_base_path): photos named in the data get the same start
    var base = (done.querySelector("a[href$='/tours/']") || { getAttribute: function () { return "/tours/"; } })
      .getAttribute("href").replace(/\/tours\/$/, "");
    var M = data.months, words = data.words;
    var WHO = ["On my own", "A couple", "A family with kids", "A group of friends"];
    // the steps, in the order of the letter; the email and number blanks share one step
    var ORDER = ["who", "country", "when", "len", "love", "contact", "ps", "name"];
    var STEP = { email: "contact", phone: "contact" };
    var stepOf = function (b) { return STEP[b] || b; };
    var Q = { who: "Who’s coming?", country: "Where are you travelling from?", when: "When would you like to come?",
      len: "How many days can you stay?", love: "What would make it perfect? Pick as many as you like",
      contact: "Where can we write back to you?", ps: "Anything else you’d like us to know?", name: "Sign your letter",
      tour: "Which tour caught your eye?" };
    var PH = { who: "who’s coming?", country: "your country", when: "when?", len: "for how long?", love: "what would make it perfect?",
      tour: "which tour?", email: "your email", phone: "your number (optional)", ps: "anything else you’d like us to know", name: "your name" };
    var NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
    var num = function (n) { return n <= 12 ? NUM[n] : String(n); };
    var cap1 = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
    var andList = function (a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; };
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var pad2 = function (n) { return ("0" + n).slice(-2); };
    var iso = function (t) { return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate()); };
    var today = new Date(), todayIso = iso(today);
    var mobile = function () { return window.matchMedia("(max-width: 979px)").matches; };
    var how = function () { return calmMotion() ? "auto" : "smooth"; };
    var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
    var MAXD = 30;

    // the answers. month: -1 not answered, 0-11, 12 "not sure yet"; days: 0 not answered, else 1-30 (nights are one
    // fewer); a and c: adults and children (asked for families and groups); any: "Surprise us"; psSeen: the P.S. step
    // was passed (it may stay empty)
    var fresh = function () {
      return { who: -1, a: 2, c: 0, country: "", month: -1, date: "", days: 0, love: [], any: false, tour: "",
        email: "", phone: "", ps: "", name: "", psSeen: false };
    };
    var s = fresh();
    s.tour = data.tour || "";
    var counts = function () { s.a = s.who === 0 ? 1 : s.who === 3 ? 4 : 2; s.c = s.who === 2 ? 2 : 0; };
    // the tour finder's lengths (a single day, about a week, 10 to 12 days, two weeks or more) as days, and back
    var LEN_DAYS = [1, 7, 11, 14];
    var lenOf = function (n) { return n < 1 ? -1 : n === 1 ? 0 : n <= 8 ? 1 : n <= 13 ? 2 : 3; };
    var KEY = "sbLetter", hadFinder = false;
    try {
      var tf = JSON.parse(sessionStorage.getItem("sbTfS") || "null");
      if (tf) {
        hadFinder = true;
        if (tf.who >= 0 && tf.who < 4) { s.who = tf.who; counts(); }
        if (tf.len >= 0 && tf.len < 4) s.days = LEN_DAYS[tf.len];
        if (tf.love && tf.love.filter) s.love = tf.love.filter(function (w) { return words.indexOf(w) >= 0; });
      }
    } catch (err) { /* start empty */ }
    var m0 = getMonth();
    if (m0 !== null) s.month = m0 >= 0 && m0 < 12 ? m0 : m0 === -1 ? 12 : -1;
    var draft = null;
    try { draft = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (err) { draft = null; }
    if (draft && draft.s) {
      var o = draft.s;
      var whole = function (v, lo, hi) { return typeof v === "number" && v >= lo && v <= hi && v === Math.round(v); };
      var str = function (v, n) { return typeof v === "string" ? v.slice(0, n) : null; };
      if (whole(o.who, -1, 3)) s.who = o.who;
      if (whole(o.a, 1, 40)) s.a = o.a;
      if (whole(o.c, 0, 20)) s.c = o.c;
      if (whole(o.month, -1, 12)) s.month = o.month;
      if (typeof o.date === "string" && /^\d{4}-\d\d-\d\d$/.test(o.date) && o.date >= todayIso) s.date = o.date;
      if (whole(o.days, 0, MAXD)) s.days = o.days;
      if (o.love && o.love.filter) s.love = o.love.filter(function (w) { return words.indexOf(w) >= 0; });
      s.any = o.any === true;
      s.psSeen = o.psSeen === true;
      if (typeof o.tour === "string" && (o.tour === "" || data.tours.indexOf(o.tour) >= 0)) s.tour = o.tour;
      [["country", 80], ["email", 120], ["phone", 40], ["ps", 2000], ["name", 80]].forEach(function (f) {
        var v = str(o[f[0]], f[1]);
        if (v !== null) s[f[0]] = v;
      });
    }
    // from links: the tour finder's best match (?tour=), its sentence (?trip=) when its answers aren't kept, and
    // the trip words of old links to the retired mix page (?mix=)
    if (window.URLSearchParams && location.search) {
      var qs = new URLSearchParams(location.search), qt = qs.get("tour"), mix = qs.get("mix"), trip = qs.get("trip");
      if (qt && data.tours.indexOf(qt) >= 0) s.tour = qt;
      if (mix) mix.split(",").forEach(function (w) {
        w = w.trim().toLowerCase();
        if (words.indexOf(w) >= 0 && s.love.indexOf(w) < 0) s.love.push(w);
      });
      if (trip && !hadFinder && !s.ps) s.ps = trip.slice(0, 400);
    }

    // ---- countries: every country's English name comes from the browser (Intl.DisplayNames); a few are offered
    // first (the visitor's own, going by their browser's language, then the countries most of our guests come from)
    var CODES = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH " +
      "CI CK CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GH GI GL GM GN GQ GR GT " +
      "GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV " +
      "LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS " +
      "PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ " +
      "UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW").split(" ");
    var POPULAR = [["IN", "India"], ["GB", "United Kingdom"], ["DE", "Germany"], ["RU", "Russia"], ["FR", "France"],
      ["AU", "Australia"], ["NL", "Netherlands"], ["US", "United States"]];
    var allCountries = null;
    var countries = function () {
      if (allCountries) return allCountries;
      allCountries = [];
      try {
        var dn = new Intl.DisplayNames(["en"], { type: "region" });
        CODES.forEach(function (c) { var n = dn.of(c); if (n && n !== c) allCountries.push([c, n]); });
      } catch (err) { /* an old browser: the popular ones, or typed */ }
      if (!allCountries.length) allCountries = POPULAR.slice();
      allCountries.sort(function (x, y) { return x[1].localeCompare(y[1]); });
      return allCountries;
    };
    var nameOf = function (code) {
      var hit = countries().filter(function (c) { return c[0] === code; })[0] || POPULAR.filter(function (c) { return c[0] === code; })[0];
      return hit ? hit[1] : "";
    };
    var guess = (function () {
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
      for (var i = 0; i < ls.length; i++) { var m = /-([a-z]{2})$/i.exec(ls[i] || ""); if (m) return m[1].toUpperCase(); }
      return "";
    })();
    var countryOptions = function (query) {
      var q = query.trim().toLowerCase();
      if (!q) {
        var top = POPULAR.map(function (c) { return c[1]; }), g = guess && nameOf(guess);
        if (s.country && top.indexOf(s.country) < 0) top.unshift(s.country);
        if (g && top.indexOf(g) < 0) top.unshift(g);
        else if (g) top = [g].concat(top.filter(function (n) { return n !== g; }));
        return top.slice(0, 10).map(function (n) { return [n, n]; });
      }
      var all = countries(), starts = [], within = [];
      all.forEach(function (c) {
        var at = c[1].toLowerCase().indexOf(q);
        if (at === 0) starts.push(c[1]); else if (at > 0) within.push(c[1]);
      });
      var hits = starts.concat(within).slice(0, 10).map(function (n) { return [n, n]; });
      var typed = query.trim().replace(/\s+/g, " ").slice(0, 60);
      if (!hits.length) hits.push(["Use “" + typed + "”", typed]);   // not in the list: their own words
      return hits;
    };

    // ---- the words written into the blanks
    var solo = function () { return s.who === 0; };
    var year = function (m) { return today.getFullYear() + (m < today.getMonth() ? 1 : 0); };
    var fmtDate = function (v) { var p = v.split("-"); return +p[2] + " " + M[+p[1] - 1] + " " + p[0]; };
    var addDays = function (v, n) { var p = v.split("-"); return iso(new Date(+p[0], +p[1] - 1, +p[2] + n)); };
    var whoText = function () {
      if (s.who === 0) return "travelling on my own";
      if (s.who === 1) return "a couple";
      if (s.who === 2) return "a family of " + num(s.a + s.c) + (s.c ? " (" + num(s.a) + (s.a === 1 ? " adult, " : " adults, ") +
        num(s.c) + (s.c === 1 ? " child)" : " children)") : "");
      if (s.who === 3) return "a group of " + num(s.a) + " friends";
      return "";
    };
    var whenText = function () {
      return s.date ? "arriving on " + fmtDate(s.date) : s.month === 12 ? "sometime soon" : s.month >= 0 ? "in " + M[s.month] + " " + year(s.month) : "";
    };
    var nightsText = function (n) { return n === 1 ? "a single day" : n + " days and " + (n - 1) + (n === 2 ? " night" : " nights"); };
    var lenText = function () { return s.days > 0 ? "for " + nightsText(s.days) : ""; };
    // with an arrival date, the days also give the dates: "12 – 21 March 2027"
    var dates = function (n) {
      if (!s.date || !n) return "";
      if (n === 1) return fmtDate(s.date);
      var a = s.date.split("-"), b = addDays(s.date, n - 1).split("-"), sameY = a[0] === b[0], sameM = sameY && a[1] === b[1];
      return +a[2] + (sameM ? "" : " " + M[+a[1] - 1] + (sameY ? "" : " " + a[0])) + " – " + +b[2] + " " + M[+b[1] - 1] + " " + b[0];
    };
    var loveText = function () {
      var w = s.love.length === words.length ? ["a bit of everything"] : s.love.slice();
      if (s.any) w.push(w.length ? "whatever else you’d suggest" : "whatever you’d suggest");
      return andList(w);
    };
    var text = function (b) {
      return b === "who" ? whoText() : b === "when" ? whenText() : b === "len" ? lenText() : b === "love" ? loveText() : (s[b] || "").trim();
    };
    var answered = function (q) {
      return q === "who" ? s.who >= 0 : q === "country" ? !!s.country.trim() : q === "when" ? s.month >= 0 || !!s.date
        : q === "len" ? s.days > 0 : q === "love" ? s.love.length > 0 || s.any : q === "contact" ? emailOk(s.email.trim())
        : q === "ps" ? s.psSeen || !!s.ps.trim() : q === "name" ? !!s.name.trim() : true;
    };
    // the letter as plain words, for the email and for WhatsApp
    var compose = function (forWa) {
      var who = whoText(), from = s.country.trim(), when = whenText(), len = lenText();
      var p1 = (solo() ? "I’m" : "We’re") + (who ? " " + who : "") + (from ? " from " + from : "") + (who || from ? ", hoping" : " hoping") +
        " to visit Sri Lanka" + (when ? " " + when : "") + (len ? " " + len : "") + ".";
      if (s.love.length || s.any) p1 += " " + (solo() ? "I’d" : "We’d") + " love " + loveText() + ".";
      if (s.tour) p1 += " " + (solo() ? "I" : "We") + " like the look of your " + s.tour + ".";
      var mail = s.email.trim(), tel = s.phone.trim(), out = ["Dear Sunbird team,", p1];
      if (mail) out.push("You can write back to me at " + mail + (tel ? ", or WhatsApp me on " + tel : "") + ".");
      else if (tel && !forWa) out.push("You can WhatsApp me on " + tel + ".");
      if (s.ps.trim()) out.push("P.S. " + s.ps.trim());
      out.push("Warm wishes,\n" + s.name.trim());
      return out.join("\n\n").trim();
    };
    var save = function () {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ s: s }));
        // the tour finder on /tours/ shows the same answers
        sessionStorage.setItem("sbTfS", JSON.stringify({ who: s.who, len: lenOf(s.days), love: s.love }));
      } catch (err) { /* not kept */ }
    };

    // open: the step showing in full screen ("ready" at the end), null on the page
    var full = false, open = null, cur = null, editing = false, from = null, busy = false;
    var nextUp = function () {
      for (var i = 0; i < ORDER.length; i++) if (!answered(ORDER[i])) return ORDER[i];
      return null;
    };
    var draw = function (changed) {
      lt.querySelectorAll("[data-t=me]").forEach(function (el) { el.textContent = solo() ? "I’m" : "We’re"; });
      lt.querySelectorAll("[data-t=we]").forEach(function (el) { el.textContent = solo() ? "I’d" : "We’d"; });
      lt.querySelectorAll("[data-t=i]").forEach(function (el) { el.textContent = solo() ? "I" : "We"; });
      var up = nextUp(), glow = !full && up ? (up === "contact" ? "email" : up) : null;
      Object.keys(blanks).forEach(function (b) {
        var el = blanks[b], v = text(b);
        el.textContent = v || PH[b];
        el.classList.toggle("empty", !v);
        el.classList.toggle("on", full && stepOf(b) === open);
        el.classList.toggle("up", b === glow);   // on the page, the next blank to fill glows softly
        if (b === changed) { el.classList.remove("new"); void el.offsetWidth; el.classList.add("new"); }
      });
      tourLine.hidden = !s.tour;
      dots.forEach(function (dot, i) {
        dot.className = (answered(ORDER[i]) ? "done" : "") + (ORDER[i] === open ? " now" : "");
      });
      var any = ORDER.some(function (q) { return q !== "ps" && answered(q); });
      startBtn.firstChild.textContent = !up ? "Read it and send" : any ? "Carry on with my letter" : "Start my letter";
      if (wa && cfg.whatsapp) wa.href = "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(compose(true));
      save();
    };

    // ---- what each step shows
    var chip = function (label, i, on, photo, v) {
      var p = photo && photo[0];
      return '<button type="button" class="tf-c' + (p ? " has-av" : "") + '" data-i="' + i + '"' + (v !== undefined ? ' data-v="' + escHtml(v) + '"' : "") +
        ' aria-pressed="' + on + '">' + (p ? '<span class="tf-av"><img src="' + escHtml(base + p) + '" alt=""' +
          (photo[1] ? ' style="object-position:' + escHtml(photo[1]) + '"' : "") + "></span>" : "") +
        '<span class="tf-cl">' + escHtml(label) + "</span></button>";
    };
    var chips = function (q, list) {
      return '<div class="lt-chips at-' + q + '" role="group" aria-label="Answers">' + list.map(function (o, i) { return chip(o[0], i, o[1], o[2], o[3]); }).join("") + "</div>";
    };
    var stepper = function (k, label, v, fewer, more) {
      return '<div class="lt-count"><span class="lt-count-l">' + label + '</span><button type="button" class="lt-pm" data-k="' + k +
        '" data-d="-1" aria-label="' + fewer + '">−</button><output aria-live="polite">' + v + '</output><button type="button" class="lt-pm" data-k="' +
        k + '" data-d="1" aria-label="' + more + '">+</button></div>';
    };
    var field = function (name, label, type, attrs, v) {
      return '<label class="lt-field"><span>' + label + "</span>" + (type === "textarea"
        ? '<textarea name="' + name + '" rows="3" ' + attrs + ">" + escHtml(v) + "</textarea>"
        : '<input type="' + type + '" name="' + name + '" value="' + escHtml(v) + '" ' + attrs + ">") + "</label>";
    };
    var countryChips = function (query) {
      return countryOptions(query).map(function (o, i) { return chip(o[0], i, o[1] === s.country, null, o[1]); }).join("");
    };
    var daysView = function (n) {
      return '<span class="lt-days-n">' + n + '</span> ' + (n === 1 ? "day" : "days") +
        (n > 1 ? ' <span class="lt-days-x">·</span> <span class="lt-days-n">' + (n - 1) + "</span> " + (n === 2 ? "night" : "nights") : "");
    };
    var fill = function (q) {
      var k = ORDER.indexOf(q), html = "";
      qEl.textContent = Q[q];
      stepEl.textContent = k >= 0 ? (k + 1) + " of " + ORDER.length : "";
      if (q === "who") {
        html = chips(q, WHO.map(function (o, i) { return [o, s.who === i]; }));
        if (s.who === 2) html += '<div class="lt-extra">' + stepper("a", "Adults", s.a, "One adult fewer", "One more adult") +
          stepper("c", "Children", s.c, "One child fewer", "One more child") + "</div>";
        if (s.who === 3) html += '<div class="lt-extra">' + stepper("a", "How many of you?", s.a, "One fewer", "One more") + "</div>";
      } else if (q === "country") {
        html = '<label class="lt-find"><span class="sr">Search for your country</span><input type="search" autocomplete="off" ' +
          'enterkeyhint="search" placeholder="Search for your country"></label>' +
          '<div class="lt-chips at-country" role="group" aria-label="Countries">' + countryChips("") + "</div>";
      } else if (q === "when") {
        html = chips(q, M.map(function (m, i) { return [m.slice(0, 3), !s.date && s.month === i]; }).concat([["Not sure yet", s.month === 12]])) +
          '<div class="lt-extra"><label class="lt-dt"><span>Know your arrival date?</span><input type="date" min="' + todayIso +
          '" value="' + escHtml(s.date) + '"></label></div>';
      } else if (q === "len") {
        var n = s.days || 10;
        html = '<div class="lt-days"><button type="button" class="lt-pm" data-d="-1" aria-label="One day fewer">−</button>' +
          '<p class="lt-days-v" aria-live="polite">' + daysView(n) + '</p><button type="button" class="lt-pm" data-d="1" aria-label="One more day">+</button></div>' +
          '<p class="lt-days-s">' + escHtml(dates(n)) + "</p>" +
          '<input type="range" class="lt-range" min="1" max="' + MAXD + '" step="1" value="' + n + '" aria-label="Number of days" style="--p:' +
          ((n - 1) / (MAXD - 1) * 100).toFixed(1) + '%">' +
          '<p class="lt-range-k" aria-hidden="true"><span>1 day</span><span>' + MAXD + " days</span></p>";
      } else if (q === "love") {
        html = chips(q, words.map(function (w) { return [cap1(w), s.love.indexOf(w) >= 0, data.photos && data.photos[w]]; })
          .concat([["Surprise us", s.any]]));
      } else if (q === "tour") {
        html = chips(q, data.tours.map(function (t) { return [t, s.tour === t]; }).concat([["Don’t mention a tour", false]]));
      } else if (q === "contact") {
        html = field("email", "Email", "email", 'autocomplete="email" inputmode="email" enterkeyhint="next" autocapitalize="off" spellcheck="false" placeholder="you@example.com"', s.email) +
          field("phone", 'WhatsApp or phone <em>(optional)</em>', "tel", 'autocomplete="tel" enterkeyhint="done" placeholder="With your country code"', s.phone);
      } else if (q === "ps") {
        html = field("ps", '<span class="sr">Anything else</span>', "textarea",
          'maxlength="2000" placeholder="A budget, a birthday, hotels you like, a place you’ve always wanted to see…"', s.ps);
      } else if (q === "name") {
        html = field("name", "Your name", "text", 'autocomplete="name" autocapitalize="words" enterkeyhint="done" maxlength="80" placeholder="First and last name"', s.name);
      }
      pane.className = "lt-pane at-" + q;
      pane.innerHTML = html;
      err("");
      label();
    };
    // the step's buttons: "Skip" while the P.S. is empty, "Done" on the last step; no "Back" on the first
    var label = function () {
      var k = ORDER.indexOf(open);
      nextBtn.textContent = open === "ps" && !s.ps.trim() ? "Skip" : k === ORDER.length - 1 || k < 0 || editing ? "Done" : "Next";
      prevBtn.hidden = k <= 0 || editing;
    };
    var err = function (t) { errEl.textContent = t; };
    // keep the word being answered in sight in the letter
    var reveal = function () {
      var el = blanks[cur];
      if (!full || !el) return;
      requestAnimationFrame(function () {
        var m = mainEl.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (r.top < m.top + 12) mainEl.scrollBy({ top: r.top - m.top - 24, behavior: how() });
        else if (r.bottom > m.bottom - 12) mainEl.scrollBy({ top: r.bottom - m.bottom + 24, behavior: how() });
      });
    };
    // what gets the focus when a step opens: a box to type in (on phones only after a tap, so the keyboard comes up
    // when it is wanted), otherwise the chosen answer or the first one
    var focusIn = function (q, blank, tapped) {
      var el = null;
      if (q === "contact") el = pane.querySelector(blank === "phone" ? "[name=phone]" : "[name=email]");
      else if (q === "ps" || q === "name") el = pane.querySelector("[name=" + q + "]");
      else if (q === "len") el = pane.querySelector(".lt-range");
      else if (q === "country" && !mobile()) el = pane.querySelector(".lt-find input");
      var typing = el && (el.tagName === "TEXTAREA" || el.type !== "range");
      if (el && mobile() && (el.type === "range" || typing && !tapped)) el = null;
      if (!el) el = pane.querySelector('.tf-c[aria-pressed="true"]') || pane.querySelector(".tf-c") || nextBtn;
      el.focus({ preventScroll: true });
    };
    var show = function (q, tapped, blank) {
      open = q;
      cur = q === "ready" ? null : blank || (q === "contact" ? "email" : q);
      ask.hidden = q === "ready";
      ready.hidden = q !== "ready";
      if (q === "ready") {
        editing = false;
        say("", "");
        sendBtn.classList.remove("nudge");
        void sendBtn.offsetWidth;
        sendBtn.classList.add("nudge");
        if (tapped) sendBtn.focus({ preventScroll: true });
      } else {
        fill(q);
        focusIn(q, blank, tapped);
      }
      draw();
      sheet.scrollTop = 0;
      reveal();
    };
    // the next step in the order of the letter; after the last one, or after changing one answer of a finished
    // letter, the letter is ready to send
    var advance = function (tapped) {
      var k = ORDER.indexOf(open);
      show(!editing && k >= 0 && k < ORDER.length - 1 ? ORDER[k + 1] : "ready", tapped);
    };

    // ---- full screen. The letter is lifted out to the end of the page while open (so nothing around it can hold it
    // in), with a stand-in of the same height left in its place, and goes back on closing. The phone's Back button
    // closes it too.
    var holder = null, pushed = false, vv = window.visualViewport;
    // the live chat bubble (Tawk) sits in the bottom corner, over the step's buttons, so it steps aside meanwhile
    var chatHidden = false;
    var chat = function (show2) {
      var t = window.Tawk_API;
      try {
        if (!show2 && t && t.hideWidget && !(t.isChatHidden && t.isChatHidden())) { t.hideWidget(); chatHidden = true; }
        else if (show2 && chatHidden && t && t.showWidget) { t.showWidget(); chatHidden = false; }
      } catch (err) { /* chat not ready */ }
    };
    // on phones the keyboard takes the bottom of the screen: the letter shrinks to the part still showing
    var fit = function () {
      if (!full) return;
      var h = vv && mobile() ? vv.height : window.innerHeight;
      if (vv && mobile()) { lt.style.height = Math.round(vv.height) + "px"; lt.style.top = Math.round(vv.offsetTop) + "px"; }
      else lt.style.height = lt.style.top = "";
      lt.style.setProperty("--h", Math.round(h) + "px");
      reveal();
    };
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    window.addEventListener("resize", fit);
    var openFull = function (q, tapped, blank) {
      if (!full) {
        full = true;
        holder = d.createElement("div");
        holder.style.height = lt.offsetHeight + "px";
        lt.parentNode.insertBefore(holder, lt);
        d.body.appendChild(lt);
        lt.classList.add("full");
        lt.setAttribute("role", "dialog");
        lt.setAttribute("aria-modal", "true");
        lt.setAttribute("aria-label", "Your letter to Sunbird Lanka Tours");
        d.documentElement.classList.add("lt-lock");
        chat(false);
        mainEl.scrollTop = 0;
        fit();
        try { history.pushState({ sbLetter: 1 }, ""); pushed = true; } catch (err) { pushed = false; }
      }
      show(q || nextUp() || "ready", tapped, blank);
    };
    var closeFull = function (byBack) {
      if (!full || busy) return;
      full = false;
      open = cur = null;
      editing = false;
      lt.classList.remove("full");
      ["role", "aria-modal", "aria-label"].forEach(function (a) { lt.removeAttribute(a); });
      lt.style.height = lt.style.top = "";
      if (holder) { holder.parentNode.insertBefore(lt, holder); holder.parentNode.removeChild(holder); holder = null; }
      d.documentElement.classList.remove("lt-lock");
      chat(true);
      if (pushed && !byBack) history.back();
      pushed = false;
      draw();
      if (!foot.hidden) startBtn.focus({ preventScroll: true });
    };
    window.addEventListener("popstate", function () {
      if (!full) return;
      pushed = false;
      if (!busy) return closeFull(true);
      try { history.pushState({ sbLetter: 1 }, ""); pushed = true; } catch (err) { /* stays open anyway */ }   // not while sending
    });
    // the chat may load after the letter has opened: it is kept out of the way then too
    try {
      var tawk = window.Tawk_API = window.Tawk_API || {}, tawkLoaded = tawk.onLoad;
      tawk.onLoad = function () { if (typeof tawkLoaded === "function") tawkLoaded(); if (full) chat(false); };
    } catch (err) { /* no chat */ }
    closeBtn.addEventListener("click", function () { closeFull(); });
    startBtn.addEventListener("click", function () { openFull(null, true); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && full) closeFull(); });
    Object.keys(blanks).forEach(function (b) {
      blanks[b].addEventListener("click", function () {
        if (busy) return;
        var q = stepOf(b);
        if (!full) { editing = !nextUp() && q !== "tour"; return openFull(q, true, b); }
        if (q === "tour") from = open;
        else if (open === "ready") editing = true;   // one change to a finished letter, then back to sending
        show(q, true, b);
      });
      blanks[b].addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); blanks[b].click(); }
      });
    });

    // ---- answering
    var setDays = function (n) {
      n = Math.max(1, Math.min(MAXD, n));
      s.days = n;
      var r = pane.querySelector(".lt-range");
      if (r) { r.value = n; r.style.setProperty("--p", ((n - 1) / (MAXD - 1) * 100).toFixed(1) + "%"); }
      var v = pane.querySelector(".lt-days-v"), sub = pane.querySelector(".lt-days-s");
      if (v) v.innerHTML = daysView(n);
      if (sub) sub.textContent = dates(n);
      draw("len");
    };
    pane.addEventListener("click", function (e) {
      if (!open || open === "ready") return;
      var q = open, pm = e.target.closest(".lt-pm");
      if (pm) {
        var step = +pm.getAttribute("data-d"), k = pm.getAttribute("data-k");
        if (q === "len") return setDays((s.days || 10) + step);
        if (k === "a") s.a = Math.max(s.who === 3 ? 2 : 1, Math.min(40, s.a + step));
        else s.c = Math.max(0, Math.min(20, s.c + step));
        pm.parentNode.querySelector("output").textContent = k === "a" ? s.a : s.c;
        return draw("who");
      }
      var c = e.target.closest(".tf-c");
      if (!c) return;
      var i = +c.getAttribute("data-i"), auto = true;
      if (q === "who") {
        if (s.who !== i) { s.who = i; counts(); }
        auto = i < 2;   // families and groups say how many first
      } else if (q === "country") s.country = c.getAttribute("data-v") || "";
      else if (q === "when") {
        s.month = i;
        s.date = "";
        setMonth(i === 12 ? -1 : i);
      } else if (q === "love") {
        auto = false;
        if (i === words.length) s.any = !s.any;
        else s.love = s.love.indexOf(words[i]) >= 0 ? s.love.filter(function (w) { return w !== words[i]; }) : s.love.concat([words[i]]);
      } else if (q === "tour") s.tour = i < data.tours.length ? data.tours[i] : "";
      if (q === "country") pane.querySelectorAll(".tf-c").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      else {
        fill(q);
        var again = pane.querySelector('[data-i="' + i + '"]');
        if (again) again.focus({ preventScroll: true });
      }
      draw(q);
      if (q === "tour") { show(from || nextUp() || "ready"); return; }
      if (auto) setTimeout(function () { if (open === q) advance(false); }, 340);
    });
    pane.addEventListener("input", function (e) {
      var t = e.target;
      if (t.type === "range") return setDays(+t.value);
      if (t.type === "search") {
        var list = pane.querySelector(".lt-chips");
        if (list) list.innerHTML = countryChips(t.value);
        return;
      }
      if (t.name && s.hasOwnProperty(t.name) && typeof s[t.name] === "string") {
        s[t.name] = t.value.slice(0, t.name === "ps" ? 2000 : 120);
        err("");
        label();
        draw(t.name);
      }
    });
    pane.addEventListener("change", function (e) {
      if (e.target.type !== "date") return;
      var v = e.target.value;
      s.date = /^\d{4}-\d\d-\d\d$/.test(v) && v >= todayIso ? v : "";
      if (s.date) { s.month = +s.date.split("-")[1] - 1; setMonth(s.month); }
      pane.querySelectorAll(".tf-c").forEach(function (c) { c.setAttribute("aria-pressed", !s.date && +c.getAttribute("data-i") === s.month ? "true" : "false"); });
      draw("when");
    });
    pane.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
      var t = e.target;
      if (t.type === "search") { e.preventDefault(); var first = pane.querySelector(".tf-c"); if (first) first.click(); return; }
      if (t.name === "email") { e.preventDefault(); pane.querySelector("[name=phone]").focus(); return; }
      if (t.tagName === "INPUT" && t.type !== "date") { e.preventDefault(); nextBtn.click(); }
    });
    nextBtn.addEventListener("click", function () {
      var q = open;
      if (!q || q === "ready") return;
      if (q === "len" && !s.days) setDays(+(pane.querySelector(".lt-range") || { value: 10 }).value);
      // a country typed in the search but not picked: the first match is taken
      var find = q === "country" && pane.querySelector(".lt-find input");
      if (find && find.value.trim()) {
        var c1 = pane.querySelector(".tf-c");
        if (c1) { s.country = c1.getAttribute("data-v") || ""; draw("country"); }
      }
      if (q === "contact" && !emailOk(s.email.trim())) {
        err(s.email.trim() ? "That email doesn’t look quite right." : "Add your email, so we can write back.");
        pane.querySelector("[name=email]").focus();
        return;
      }
      if (q === "name" && !s.name.trim()) {
        err("Sign with your name, so we know who to write to.");
        pane.querySelector("[name=name]").focus();
        return;
      }
      if (q === "ps") s.psSeen = true;
      if (q === "tour") return show(from || nextUp() || "ready", true);
      advance(true);
    });
    prevBtn.addEventListener("click", function () {
      var k = ORDER.indexOf(open);
      if (k > 0) show(ORDER[k - 1], true);
    });

    // ---- sending
    var say = function (cls, htmlText) { status.className = "lt-status " + cls; status.innerHTML = htmlText; };
    var demo = false;
    var finish = function () {
      busy = false;
      closeBtn.disabled = false;
      var first = s.name.trim().split(/\s+/)[0];
      try { sessionStorage.removeItem(KEY); } catch (err) { /* nothing kept */ }
      done.querySelector(".lt-done-t").textContent = (first ? "Thank you, " + first + ". " : "Thank you. ") + "Your letter is on its way.";
      done.querySelector(".lt-done-s").textContent = "We’ll write back to " + s.email.trim() + " within 24 hours.";
      done.querySelector(".lt-demo").hidden = !demo;
      mainEl.hidden = sheet.hidden = tip.hidden = foot.hidden = true;
      done.hidden = false;
      say("", "");
      open = null;
      dots.forEach(function (dot) { dot.className = "done"; });
      done.focus({ preventScroll: true });
    };
    var seal = function (ok) {
      busy = true;
      closeBtn.disabled = true;
      var failed = function () {
        busy = false;
        closeBtn.disabled = false;
        sendBtn.disabled = false;
        say("err", "Sorry, your letter didn’t go through. " + contactHtml());
      };
      if (calmMotion()) { ok.then(finish, failed); return; }
      // the envelope waits in the middle of the part of the letter on screen; the letter folds to its size above it,
      // slips in, the flap closes, and once the letter has really gone it is stamped and flies off
      var st = stage.getBoundingClientRect(), pr = paper.getBoundingClientRect(), view = mainEl.getBoundingClientRect();
      var ew = Math.min(380, st.width * .86), eh = ew / 1.55, ex = (st.width - ew) / 2;
      var top = Math.max(st.top, view.top), bottom = Math.min(st.bottom, view.bottom);
      var ey = Math.max(eh * .6, Math.min(st.height - eh - 8, top - st.top + Math.max(eh * .6, (bottom - top - eh) / 2 + eh * .3)));
      var px = pr.left - st.left, py = pr.top - st.top, pw = pr.width, ph = pr.height;
      var fw = ew * .86, fh = eh * .9, fx = ex + (ew - fw) / 2;
      var to = function (y) { return "translate(" + (fx - px) + "px," + (y - py) + "px) scale(" + (fw / pw) + "," + (fh / ph) + ")"; };
      env.style.cssText = "left:" + ex + "px;top:" + ey + "px;width:" + ew + "px;height:" + eh + "px";
      var pic = data.photos && (data.photos[s.love[0]] || data.photos.history || data.photos[words[0]]);
      var img = env.querySelector(".lt-stamp img");
      if (pic && pic[0]) { img.src = base + pic[0]; if (pic[1]) img.style.objectPosition = pic[1]; }
      env.querySelector(".lt-env-from").textContent = "From " + s.name.trim() + (s.country.trim() ? ", " + s.country.trim() : "");
      env.querySelector(".lt-mark-d").textContent = today.getDate() + " " + M[today.getMonth()].slice(0, 3).toUpperCase();
      env.querySelector(".lt-mark-y").textContent = today.getFullYear();
      lt.classList.add("sealing");
      void paper.offsetWidth;
      lt.classList.add("fold");
      paper.style.transform = to(ey - fh * .55);
      var back = function () {
        lt.classList.remove("seal");
        wait(450).then(function () { lt.classList.remove("tuck"); paper.style.transform = to(ey - fh * .55); return wait(520); })
          .then(function () { lt.classList.remove("fold"); paper.style.transform = ""; return wait(760); })
          .then(function () { lt.classList.remove("sealing"); env.style.cssText = ""; failed(); });
      };
      wait(760).then(function () { lt.classList.add("tuck"); paper.style.transform = to(ey + eh * .07); return wait(560); })
        .then(function () { lt.classList.add("seal"); return wait(560); })
        .then(function () { return ok; })
        .then(function () {
          say("", "");
          lt.classList.add("stamp");
          return wait(1100).then(function () { lt.classList.add("fly"); return wait(900); }).then(finish);
        }, back);
    };
    sendBtn.addEventListener("click", function () {
      if (busy) return;
      // a letter can't go without an email and a name: the step that still needs one opens
      if (!emailOk(s.email.trim()) || !s.name.trim()) {
        var q = !emailOk(s.email.trim()) ? "contact" : "name";
        editing = true;
        show(q, true);
        err(q === "contact" ? (s.email.trim() ? "That email doesn’t look quite right." : "Add your email, so we can write back.")
          : "Sign with your name, so we know who to write to.");
        return;
      }
      say("", "");
      var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname), noKey = !canSend();
      if (noKey && !local && !(hp && hp.checked)) { say("err", "Sorry, sending letters isn’t switched on yet. " + contactHtml()); return; }
      demo = noKey;
      var party = s.who === 0 ? [1, 0] : s.who === 1 ? [2, 0] : s.who >= 2 ? [s.a, s.c] : null;
      var payload = {
        from_name: "Sunbird website", page: location.href, form: "Letter",
        subject: (s.tour ? "Tour enquiry: " + s.tour : "Trip plan request") + " – " + s.name.trim(),
        name: s.name.trim(), email: s.email.trim(), phone: s.phone.trim(), country: s.country.trim(), travellers: whoText(),
        adults: party ? String(party[0]) : "", children: party ? String(party[1]) : "",
        arrival: s.date ? fmtDate(s.date) : s.month === 12 ? "Not sure yet" : s.month >= 0 ? M[s.month] + " " + year(s.month) : "",
        days: s.days ? nightsText(s.days) : "", dates: dates(s.days),
        interests: loveText(), tour: s.tour, message: compose(false)
      };
      Object.keys(payload).forEach(function (k) { if (payload[k] === "") delete payload[k]; });
      var ok = demo || (hp && hp.checked) ? wait(1400).then(function () { return true; }) : sendInquiry(payload);
      ok.catch(function () { /* handled in seal */ });
      sendBtn.disabled = true;
      say("", "Sealing your letter…");
      seal(ok);
    });
    done.querySelector(".lt-again").addEventListener("click", function () {
      // a new letter from the same person: their name and how to reach them stay
      var keep = { country: s.country, email: s.email, phone: s.phone, name: s.name };
      s = fresh();
      Object.keys(keep).forEach(function (k) { s[k] = keep[k]; });
      ["sealing", "fold", "tuck", "seal", "stamp", "fly"].forEach(function (c) { lt.classList.remove(c); });
      paper.style.transform = env.style.cssText = "";
      mainEl.hidden = sheet.hidden = tip.hidden = foot.hidden = false;
      done.hidden = true;
      sendBtn.disabled = false;
      if (full) { mainEl.scrollTop = 0; show(nextUp() || "ready", true); }
      else draw();
    });

    // ---- the plain form, for anyone who prefers it: it takes over what the letter already says
    var backP = plain.querySelector(".lt-back"), form = plain.querySelector(".plan-form");
    q$(".lt-plain-on").addEventListener("click", function () {
      if (form) {
        var set = function (n, v) { if (form.elements[n] && v !== "" && v !== null && v !== undefined) form.elements[n].value = v; };
        ["name", "email", "phone", "country"].forEach(function (k) { set(k, s[k].trim()); });
        set("arrival_date", s.date);
        if (s.days) set("days", s.days);
        if (s.who >= 0) { set("adults", s.who === 0 ? 1 : s.who === 1 ? 2 : s.a); set("children", s.who === 2 ? s.c : 0); }
        var sel = form.elements.tour;
        if (sel && s.tour) [].forEach.call(sel.options, function (o) { if (o.text === s.tour) sel.value = o.value; });
        if (s.who >= 0 || s.month >= 0 || s.days || s.love.length || s.any || s.ps.trim()) set("message", compose(false));
      }
      lt.hidden = true;
      plain.hidden = false;
      var f = form && form.querySelector("input:not(.hp)");
      if (f) f.focus();
    });
    if (backP) backP.querySelector("button").addEventListener("click", function () {
      plain.hidden = true;
      lt.hidden = false;
      lt.scrollIntoView({ block: "start" });
    });

    lt.hidden = false;
    plain.hidden = true;
    if (backP) backP.hidden = false;
    q$(".lt-date").textContent = today.getDate() + " " + M[today.getMonth()] + " " + today.getFullYear();
    draw();
    // from a "Plan my trip" link on another page of the site, the letter opens full screen straight away
    var inSite = false;
    try { inSite = !!d.referrer && new URL(d.referrer).origin === location.origin; } catch (err) { inSite = false; }
    if (location.hash === "#plan" && inSite) openFull(null, false);
  })();

  // ---- from a tour to a place and back. On a tour page, a click on a link to a destination (a place's name in a
  // day's heading, "About <place>" under the day, any other) remembers the tour, its name and the day the link sits
  // in (sessionStorage "sbFromTour"). That place's page then puts "Back to <tour> · Day N" where its breadcrumbs
  // were, and the same as a small pill in the bottom corner once the top has scrolled away. The way back opens the
  // tour on that same day (#day-N opens it and brings it into view).
  (function () {
    var KEY = "sbFromTour";
    if (body.classList.contains("layout-tour")) {
      d.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest('a[href*="/destinations/"]') : null;
        if (!a || a.target === "_blank" || !a.pathname || a.pathname.replace(/\/+$/, "").split("/").pop() === "destinations") return;
        var day = a.closest("details.day"), h1 = d.querySelector("h1"), n = day && day.querySelector(".day-n");
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ dest: a.pathname, url: location.pathname + (day ? "#" + day.id : ""),
            title: h1 ? h1.textContent.trim() : "", day: n ? n.textContent.trim() : "" }));
        } catch (err) { /* no way back offered */ }
      }, true);
      return;
    }
    var top = d.querySelector(".dest-hero .dh-text"), from = null;
    if (!top) return;
    try { from = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (err) { from = null; }
    if (!from || from.dest !== location.pathname || !from.url || !from.title) return;
    var arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var label = function (a, short) {
      a.href = from.url;
      a.innerHTML = arrow + "<i>Back to</i><b></b>" + (from.day ? "<span></span>" : "");
      a.querySelector("b").textContent = from.title;
      if (from.day) a.querySelector("span").textContent = "· " + from.day.charAt(0) + from.day.slice(1).toLowerCase();
      a.setAttribute("aria-label", "Back to the " + from.title + (from.day ? ", " + from.day.toLowerCase() : ""));
    };
    var back = d.createElement("a");
    back.className = "dh-back";
    label(back, false);
    var crumbs = top.querySelector(".crumbs");
    if (crumbs) crumbs.hidden = true;
    top.insertBefore(back, top.firstChild);
    var pill = d.createElement("a");
    pill.className = "tour-back";
    label(pill, true);
    body.appendChild(pill);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (list) {
        var e = list[0];
        pill.classList.toggle("on", !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(back);
    }
  })();

  // ---- our own chat box (build.py chat_box; settings "chat_box: on"). Only the look and feel is built here: the
  // card opens and closes, the visitor's messages and the starting questions show in the thread, and the thread and
  // whether the card is open carry on from page to page (sessionStorage "sbChat"). Nothing is sent anywhere yet. To
  // connect it later, use window.SunbirdChat:
  //   SunbirdChat.onSend = function (text) { ... }   called with each message the visitor sends
  //   SunbirdChat.reply("text", "Name")              shows a message from the team (a red dot on the pill if shut)
  //   SunbirdChat.typing(true / false)               shows or hides the team's "typing" dots
  //   SunbirdChat.open() / .close()
  // Until onSend is set, a note under the visitor's first message says the chat isn't live yet and offers to send
  // the same words on WhatsApp, so nothing typed is lost.
  (function () {
    var cb = d.querySelector(".cb");
    if (!cb) return;
    var card = cb.querySelector(".cb-card"), openBtn = cb.querySelector(".cb-open"), closeBtn = cb.querySelector(".cb-x"),
      log = cb.querySelector(".cb-log"), form = cb.querySelector(".cb-write"), box = cb.querySelector("textarea"),
      sendBtn = cb.querySelector(".cb-send"), chips = cb.querySelector(".cb-chips"), when = cb.querySelector(".cb-when");
    var phone = window.matchMedia("(max-width: 640px)"), still = window.matchMedia("(prefers-reduced-motion: reduce)");
    var opens = +cb.getAttribute("data-open") || 8, closes = +cb.getAttribute("data-close") || 17, wa = cb.getAttribute("data-wa");
    var api = window.SunbirdChat = window.SunbirdChat || {};
    var KEY = "sbChat", msgs = [], isOpen = false, wasOpen = false, hideT = 0, tick = 0, nudgeT = 0, note = null, typingEl = null;
    try { var st = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (st) { msgs = st.msgs || []; wasOpen = !!st.open; } } catch (err) { /* fresh */ }
    var save = function () { try { sessionStorage.setItem(KEY, JSON.stringify({ open: isOpen, msgs: msgs.slice(-60) })); } catch (err) { /* private mode */ } };

    // the time in Sri Lanka (UTC+5:30 all year, no summer time) and whether the office is open
    var clock = function (h, m) { return ((h + 11) % 12 + 1) + (m == null ? "" : ":" + (m < 10 ? "0" : "") + m) + (h < 12 ? " am" : " pm"); };
    var status = function () {
      var t = new Date(Date.now() + 330 * 60000), h = t.getUTCHours(), m = t.getUTCMinutes(), inNow = h >= opens && h < closes;
      cb.classList.toggle("in", inNow);
      when.textContent = inNow ? "Our team is in · " + clock(h, m) + " in Sri Lanka"
        : "Back at " + clock(opens) + " · it's " + clock(h, m) + " in Sri Lanka";
    };
    var stamp = function () {
      try { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(); } catch (err) { return ""; }
    };

    // ---- the thread
    var down = function (now) {
      var go = function () { log.scrollTop = log.scrollHeight; };
      if (now) go(); else requestAnimationFrame(go);
    };
    var add = function (who, text, name, at, quiet) {
      var el = d.createElement("div"), p = d.createElement("p"), by = d.createElement("span");
      el.className = "cb-msg " + who + (quiet ? "" : " new");
      p.textContent = text;
      by.className = "cb-by";
      by.textContent = (who === "them" ? (name || "Sunbird team") + (at ? " · " : "") : "") + (at || "");
      el.appendChild(p);
      el.appendChild(by);
      log.insertBefore(el, typingEl && typingEl.parentNode === log ? typingEl : null);
      down();
      return el;
    };
    // the note for while the chat isn't connected: it always sits under the latest message, and its WhatsApp link
    // carries everything the visitor wrote
    var showNote = function (quiet) {
      if (typeof api.onSend === "function") return;
      if (!note) {
        note = d.createElement("div");
        note.className = "cb-note";
        note.innerHTML = "<p>Thanks for writing. Our live chat isn't switched on yet, so this hasn't reached us." +
          (wa ? " Send it on WhatsApp and we'll answer you there.</p><a target=\"_blank\" rel=\"noopener\">" +
            (cb.querySelector(".cb-alt svg") || { outerHTML: "" }).outerHTML +   // the same WhatsApp logo as the line under the box

            "Send it on WhatsApp</a>" : "</p>");
      }
      if (quiet) note.style.animation = "none"; else note.style.animation = "";
      var link = note.querySelector("a");
      if (link) link.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent(msgs.filter(function (m) { return m.w === "me"; })
        .map(function (m) { return m.t; }).join("\n\n"));
      log.appendChild(note);
      down();
    };
    var typing = function (on) {
      if (on && !typingEl) {
        typingEl = d.createElement("div");
        typingEl.className = "cb-msg them cb-typing new";
        typingEl.innerHTML = '<p role="status" aria-label="Typing"><i></i><i></i><i></i></p>';
        log.appendChild(typingEl);
        down();
      } else if (!on && typingEl) {
        typingEl.parentNode.removeChild(typingEl);
        typingEl = null;
      }
    };
    var grow = function () {
      sendBtn.classList.toggle("idle", !box.value.trim());
      if (card.hidden) return;   // a shut card has no height to measure
      box.style.height = "auto";
      var h = box.scrollHeight;
      if (h) { box.style.height = Math.min(h, 134) + "px"; box.style.overflowY = h > 134 ? "auto" : "hidden"; }
    };
    var send = function (text) {
      text = (text || "").trim();
      if (!text) { box.focus(); return; }
      var at = stamp();
      msgs.push({ w: "me", t: text, at: at });
      save();
      chips.classList.add("gone");
      add("me", text, null, at);
      box.value = "";
      grow();
      if (typeof api.onSend === "function") { try { api.onSend(text); } catch (err) { /* the sender's own problem */ } }
      else setTimeout(function () { showNote(false); }, 450);
    };

    // ---- opening and closing
    var show = function (on, quiet) {
      if (on === isOpen) return;
      isOpen = on;
      clearTimeout(hideT);
      openBtn.setAttribute("aria-expanded", on ? "true" : "false");
      openBtn.setAttribute("aria-label", on ? "Close the chat" : "Chat with us");
      if (on) {
        card.hidden = false;
        grow();
        status();
        // they've found the chat: no nudge after this
        try { sessionStorage.setItem("sbChatNudged", "1"); } catch (err) { /* private mode */ }
        clearTimeout(nudgeT);
        cb.classList.remove("nudge");
        clearInterval(tick);
        tick = setInterval(status, 30000);
        if (!quiet && !still.matches) card.getBoundingClientRect();   // start the opening from the closed look
        cb.classList.add("on");
        cb.classList.remove("news");
        d.documentElement.classList.toggle("cb-lock", phone.matches);
        fit();
        down(true);
        // on phones the keyboard would cover the sheet at once: it waits for a tap in the box
        if (!quiet && !phone.matches) setTimeout(function () { box.focus({ preventScroll: true }); }, 320);
      } else {
        var inside = card.contains(d.activeElement);
        cb.classList.remove("on");
        d.documentElement.classList.remove("cb-lock");
        clearInterval(tick);
        hideT = setTimeout(function () { card.hidden = true; }, still.matches || quiet ? 0 : 520);
        if (inside) openBtn.focus({ preventScroll: true });
      }
      save();
    };
    openBtn.addEventListener("click", function () { show(!isOpen); });
    closeBtn.addEventListener("click", function () { show(false); });
    cb.addEventListener("click", function (e) { if (e.target === cb) show(false); });   // the dimmed page on phones
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) show(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); send(box.value); });
    box.addEventListener("input", grow);
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(box.value); }
    });
    chips.addEventListener("click", function (e) {
      var c = e.target.closest(".cb-chip");
      if (c) send(c.textContent);
    });

    // on phones the keyboard takes the bottom of the screen: the sheet sits on top of it
    var vv = window.visualViewport;
    var fit = function () {
      if (!vv || !isOpen || !phone.matches) { cb.style.removeProperty("--cb-kb"); cb.style.removeProperty("--cb-vh"); return; }
      cb.style.setProperty("--cb-kb", Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + "px");
      cb.style.setProperty("--cb-vh", Math.round(vv.height) + "px");
      down(true);
    };
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    var onPhone = function () { d.documentElement.classList.toggle("cb-lock", isOpen && phone.matches); fit(); };
    if (phone.addEventListener) phone.addEventListener("change", onPhone); else if (phone.addListener) phone.addListener(onPhone);

    // ---- the nudge, on phones and tablets only (big screens open the words when pointed at, in site.css). A minute
    // after the visitor first scrolls (counted across pages: sessionStorage "sbChatT0"), the sun opens out into
    // "Chat with us" with a soft two-note chime, waits a few seconds and folds back. Once per visit ("sbChatNudged"),
    // and never once the chat has been opened. Browsers only let a page make a sound after the visitor has tapped it
    // somewhere: the sound is woken on the first tap, and a visitor who has only scrolled gets the nudge in silence.
    var touch = window.matchMedia("(hover: none)"), audio = null;
    var ss = function (k, v) {
      try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (err) { /* private mode */ }
      return null;
    };
    var wake = function () {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return unwake();
        if (!audio) audio = new AC();
        if (audio.state !== "running") { audio.resume(); return; }
        // iPhones keep the sound asleep until something has played inside a tap
        var s = audio.createBufferSource();
        s.buffer = audio.createBuffer(1, 1, 22050);
        s.connect(audio.destination);
        s.start(0);
        unwake();
      } catch (err) { audio = null; unwake(); }
    };
    var WAKE = ["touchend", "pointerup", "keydown"];
    var unwake = function () { WAKE.forEach(function (ev) { d.removeEventListener(ev, wake, true); }); };
    var chime = function () {
      if (!audio || audio.state !== "running") return;
      var t = audio.currentTime + .02;
      [[659.25, 0], [987.77, .17]].forEach(function (n) {   // E5 then B5, like a small bell
        [[1, .1], [2, .025]].forEach(function (h) {           // the note and a quiet octave over it
          var o = audio.createOscillator(), g = audio.createGain(), at = t + n[1];
          o.type = "sine";
          o.frequency.value = n[0] * h[0];
          g.gain.setValueAtTime(.0001, at);
          g.gain.exponentialRampToValueAtTime(h[1], at + .015);
          g.gain.exponentialRampToValueAtTime(.0001, at + (h[0] === 1 ? 1.1 : .5));
          o.connect(g);
          g.connect(audio.destination);
          o.start(at);
          o.stop(at + 1.2);
        });
      });
    };
    var nudge = function () {
      if (ss("sbChatNudged") || isOpen) return;
      // not while the tab is in the background, or while the letter or the menu covers the page: a little later
      if (d.hidden || window.getComputedStyle(cb).display === "none") { nudgeT = setTimeout(nudge, 5000); return; }
      ss("sbChatNudged", "1");
      cb.classList.add("nudge");
      chime();
      nudgeT = setTimeout(function () { cb.classList.remove("nudge"); }, 4500);
    };
    var plan = function () {
      var t0 = +ss("sbChatT0");
      if (!t0) return;
      clearTimeout(nudgeT);
      nudgeT = setTimeout(nudge, Math.max(2500, t0 + 60000 - Date.now()));   // on a new page, not before it has settled
    };
    if (touch.matches && !ss("sbChatNudged")) {
      if (ss("sbChatT0")) plan();
      else window.addEventListener("scroll", function first() {
        window.removeEventListener("scroll", first);
        ss("sbChatT0", String(Date.now()));
        plan();
      }, { passive: true });
      WAKE.forEach(function (ev) { d.addEventListener(ev, wake, true); });
    }

    // ---- for connecting it later
    api.open = function () { show(true); };
    api.close = function () { show(false); };
    api.typing = typing;
    api.reply = function (text, name) {
      text = String(text == null ? "" : text).trim();
      if (!text) return;
      typing(false);
      if (note && note.parentNode) note.parentNode.removeChild(note);   // the team is answering: the chat is live
      var at = stamp();
      msgs.push({ w: "them", t: text, n: name || "", at: at });
      save();
      add("them", text, name, at);
      if (!isOpen) cb.classList.add("news");
    };

    // the thread so far, from the pages before
    msgs.forEach(function (m) { add(m.w === "me" ? "me" : "them", m.t, m.n, m.at, true); });
    if (msgs.some(function (m) { return m.w === "me"; })) { chips.classList.add("gone"); showNote(true); }
    status();
    grow();
    if (wasOpen) show(true, true);
  })();
})();
