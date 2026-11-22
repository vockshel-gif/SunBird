/* Sunbird admin panel.
   It works two ways, with the same screens:
   - on your computer (python admin.py): saves straight into the files and rebuilds the site;
   - on the live website (/admin/): saves to GitHub, which rebuilds and publishes the site.
   No libraries: everything is in this file. */
(function () {
  'use strict';

  const EDITABLE = ['content/', 'static/img/'];
  const IMG_RX = /\.(jpe?g|png|webp|gif|svg|avif)$/i;
  const REGIONS = ['Cultural Triangle', 'Hill country', 'South & west coast', 'Wildlife parks', 'North & east'];
  // longest side of an uploaded photo, by folder
  const MAX_SIDE = { site: 2400, about: 2400, people: 600, logos: 600 };
  const DEFAULT_SIDE = 1800;
  // photos the design itself uses (not listed in any text file), so they can't be deleted
  const PROTECTED = ['static/img/logo.png', 'static/img/logo-white.png', 'static/img/logo.svg', 'static/img/logo-white.svg'];
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const siteBase = location.pathname.replace(/\/admin(\/.*)?$/, '');

  // ====================================================================== small helpers
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'textContent', 'hidden', 'multiple', 'placeholder',
    'rows', 'type', 'accept', 'src', 'href', 'alt', 'title', 'name', 'min', 'max', 'step', 'spellcheck', 'htmlFor',
    'readOnly', 'tabIndex', 'loading', 'target', 'rel', 'id', 'autocomplete']);

  function h(sel, attrs, ...kids) {
    const m = /^([a-z0-9]*)(.*)$/i.exec(sel);
    const el = document.createElement(m[1] || 'div');
    (m[2].match(/[.#][\w-]+/g) || []).forEach(p => (p[0] === '.' ? el.classList.add(p.slice(1)) : (el.id = p.slice(1))));
    if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (PROPS.has(k)) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  const slugify = s => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  const basename = p => p.split('/').pop();
  const stem = p => basename(p).replace(/\.[^.]+$/, '');
  const humanize = k => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
  const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const isQuoted = v => { v = v.trim(); return v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'"); };
  const unq = v => (isQuoted(v) ? v.trim().slice(1, -1) : v.trim());
  const sitePath = p => '/' + p.replace(/^static\//, ''); // static/img/a.jpg -> /img/a.jpg
  const oneLine = v => String(v == null ? '' : v).replace(/\s*\n\s*/g, ' ').trim();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));

  function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const s = atob(b64.replace(/\s/g, ''));
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  // images written in the text files:  ![alt](/img/a.jpg "caption")
  const IMG_MD = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  const onlyImages = s => s.trim() !== '' && s.replace(IMG_MD, '').trim() === '';
  const parseImgs = s => [...s.matchAll(IMG_MD)].map(m => ({ alt: m[1], src: m[2], title: m[3] || '' }));
  const cleanCap = s => oneLine(s).replace(/"/g, '”').replace(/[[\]]/g, '');
  const imgMd = p => `![${cleanCap(p.alt)}](${p.src}${p.title ? ` "${cleanCap(p.title)}"` : ''})`;
  const isBullet = l => /^\s*[-*]\s+\S/.test(l) && !/^\s*\*\*/.test(l);
  const bulletText = l => l.replace(/^\s*[-*]\s+/, '');

  // ====================================================================== state
  const S = {
    be: null,             // where files are read from and saved to (Local or GitHub)
    files: [],            // every editable file: {path, size, sha}
    byPath: new Map(),
    texts: new Map(),     // path -> {sha, text}
    ready: null,          // promise: all text files loaded
    editor: null,         // the open editor: {isDirty, save, discard}
    recent: new Set(),    // photos uploaded in this visit (shown first)
  };

  function setFiles(files) {
    S.files = files;
    S.byPath = new Map(files.map(f => [f.path, f]));
  }

  async function getText(path) {
    const f = S.byPath.get(path);
    if (!f) throw new Error('This file does not exist any more: ' + path);
    const c = S.texts.get(path);
    if (c && c.sha === f.sha) return c.text;
    const raw = await S.be.readText(f);
    const text = raw.replace(/\r\n/g, '\n');
    // remember Windows line endings, so saving changes only the lines that changed
    S.texts.set(path, { sha: f.sha, text, crlf: raw.indexOf('\r\n') >= 0 });
    return text;
  }

  function preloadTexts() {
    const want = S.files.filter(f => f.path.startsWith('content/') && /\.(md|txt)$/.test(f.path));
    let i = 0;
    const worker = async () => {
      while (i < want.length) {
        const f = want[i++];
        try { await getText(f.path); } catch (e) { console.warn(e); }
      }
    };
    return Promise.all(Array.from({ length: 8 }, worker));
  }

  const textOf = path => (S.texts.get(path) || {}).text || '';
  const filesIn = dir => S.files.filter(f => f.path.startsWith(dir) && f.path.slice(dir.length).indexOf('/') < 0);
  const images = () => S.files.filter(f => f.path.startsWith('static/img/') && IMG_RX.test(f.path));

  function imgUrl(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    const f = S.byPath.get('static' + src);
    return f ? S.be.imageUrl(f) : S.be.siteUrl(src);
  }
  function imgEl(src, cls) {
    const el = h('img' + (cls || ''), { src: imgUrl(src), alt: '', loading: 'lazy', draggable: 'false' });
    el.addEventListener('error', () => el.classList.add('broken'), { once: true });
    return el;
  }

  // ====================================================================== saving: on this computer
  const Local = {
    mode: 'local',
    async tree() {
      const r = await fetch('/api/tree', { cache: 'no-store' });
      if (!r.ok) throw new Error('The admin server did not answer. Is python admin.py still running?');
      return (await r.json()).files;
    },
    async readText(f) {
      const r = await fetch('/api/file?path=' + encodeURIComponent(f.path), { cache: 'no-store' });
      if (!r.ok) throw new Error('Could not open ' + f.path);
      return r.text();
    },
    imageUrl: f => '/api/file?path=' + encodeURIComponent(f.path) + '&v=' + encodeURIComponent(f.sha),
    siteUrl: u => u,
    async commit(changes, message) {
      const files = changes.map(c => (c.delete ? { path: c.path, delete: true }
        : c.bytes ? { path: c.path, base64: bytesToB64(c.bytes) } : { path: c.path, text: c.text }));
      const r = await fetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, message }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Saving failed.');
      return { files: data.files, build: data.build };
    },
  };

  // ====================================================================== saving: to GitHub
  class Conflict extends Error {}

  function makeGitHub(cfg) {
    const store = (() => { try { return localStorage; } catch (e) { return null; } })();
    const session = (() => { try { return sessionStorage; } catch (e) { return null; } })();
    const KEY = 'sbAdminToken';
    const gh = {
      mode: 'github',
      repo: cfg.repo,
      branch: cfg.branch || 'main',
      token: (session && session.getItem(KEY)) || (store && store.getItem(KEY)) || '',
      fresh: new Map(), // photos uploaded but not published yet: path -> blob URL
      setToken(t, remember) {
        gh.token = t;
        try {
          (remember ? store : session).setItem(KEY, t);
          (remember ? session : store).removeItem(KEY);
        } catch (e) { /* private window: keep it in memory only */ }
      },
      signOut() {
        gh.token = '';
        try { store.removeItem(KEY); session.removeItem(KEY); } catch (e) { /* nothing stored */ }
      },
      async api(path, opts = {}) {
        const r = await fetch('https://api.github.com/repos/' + gh.repo + path, {
          method: opts.method || 'GET',
          headers: Object.assign({
            Authorization: 'Bearer ' + gh.token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          }, opts.body ? { 'Content-Type': 'application/json' } : {}),
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          cache: 'no-store',
        });
        const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
        if (!r.ok) {
          const e = new Error(r.status === 401 ? 'GitHub did not accept the key. Sign in again.'
            : r.status === 403 || r.status === 404 ? 'The key is not allowed to change ' + gh.repo + '. Check its permissions.'
              : data.message || 'GitHub answered with an error (' + r.status + ').');
          e.status = r.status;
          throw e;
        }
        return data;
      },
      async head() {
        const ref = await gh.api('/git/ref/heads/' + gh.branch);
        const commit = await gh.api('/git/commits/' + ref.object.sha);
        return { commit: ref.object.sha, tree: commit.tree.sha };
      },
      async fullTree(treeSha) {
        const t = await gh.api('/git/trees/' + treeSha + '?recursive=1');
        return t.tree.filter(e => e.type === 'blob');
      },
      async tree() {
        const hd = await gh.head();
        return (await gh.fullTree(hd.tree)).filter(e => EDITABLE.some(p => e.path.startsWith(p)))
          .map(e => ({ path: e.path, size: e.size, sha: e.sha }));
      },
      async readText(f) {
        const b = await gh.api('/git/blobs/' + f.sha);
        return dec.decode(b64ToBytes(b.content));
      },
      imageUrl: f => gh.fresh.get(f.path) || siteBase + sitePath(f.path),
      siteUrl: u => (u.startsWith('/') ? siteBase + u : u),
      async commit(changes, message, expected, attempt = 0) {
        const hd = await gh.head();
        const now = new Map((await gh.fullTree(hd.tree)).map(e => [e.path, e.sha]));
        for (const p of Object.keys(expected || {})) {
          if (expected[p] && now.get(p) !== expected[p]) throw new Conflict(p);
        }
        const entries = [];
        for (const c of changes) {
          if (c.delete) {
            if (now.has(c.path)) entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
            continue;
          }
          const bytes = c.bytes || enc.encode(c.text);
          const blob = await gh.api('/git/blobs', { method: 'POST', body: { content: bytesToB64(bytes), encoding: 'base64' } });
          entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const tree = await gh.api('/git/trees', { method: 'POST', body: { base_tree: hd.tree, tree: entries } });
        const commit = await gh.api('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [hd.commit] } });
        try {
          await gh.api('/git/refs/heads/' + gh.branch, { method: 'PATCH', body: { sha: commit.sha } });
        } catch (e) {
          // someone saved at the same moment: try once more on top of their change
          if (e.status === 422 && attempt < 1) return gh.commit(changes, message, expected, attempt + 1);
          throw e;
        }
        changes.forEach(c => { if (c.blobUrl) gh.fresh.set(c.path, c.blobUrl); });
        watchPublish(commit.sha);
        return { files: await gh.tree() };
      },
    };
    return gh;
  }

  // "Publishing…" -> "Live" in the top bar, from GitHub's build of the site
  let publishTimer = null;
  function watchPublish(sha) {
    clearInterval(publishTimer);
    setStatus('busy', 'Publishing…');
    const started = Date.now();
    publishTimer = setInterval(async () => {
      if (Date.now() - started > 6 * 60 * 1000) { clearInterval(publishTimer); setStatus('', 'Saved'); return; }
      try {
        const r = await S.be.api('/actions/runs?head_sha=' + sha + '&per_page=5');
        const run = (r.workflow_runs || [])[0];
        if (!run) return;
        if (run.status !== 'completed') { setStatus('busy', 'Publishing…'); return; }
        clearInterval(publishTimer);
        if (run.conclusion === 'success') setStatus('ok', 'Live on the site');
        else setStatus('bad', 'The site did not update', run.html_url);
      } catch (e) {
        // the key may not be allowed to read Actions: just say it was saved
        clearInterval(publishTimer);
        setStatus('ok', 'Saved · live in about a minute');
      }
    }, 6000);
  }

  // ====================================================================== committing
  async function commit(changes, message, expected) {
    const crlf = new Set(changes.filter(c => c.text != null && (S.texts.get(c.path) || {}).crlf).map(c => c.path));
    const out = changes.map(c => (crlf.has(c.path) ? Object.assign({}, c, { text: c.text.replace(/\r?\n/g, '\r\n') }) : c));
    let r;
    try {
      r = await S.be.commit(out, message, expected);
    } catch (e) {
      if (e instanceof Conflict) {
        throw new Error('Someone else changed ' + basename(e.message) + ' since you opened it. Copy your text somewhere safe, reload the page and try again.');
      }
      throw e;
    }
    setFiles(r.files);
    for (const c of changes) {
      if (c.delete) { S.texts.delete(c.path); continue; }
      if (c.bytes) S.recent.add(c.path);
      const f = S.byPath.get(c.path);
      if (c.text != null && f) S.texts.set(c.path, { sha: f.sha, text: c.text, crlf: crlf.has(c.path) });
    }
    if (r.build) {
      if (r.build.ok) setStatus('ok', 'Saved · site rebuilt');
      else showBuildError(r.build.log);
    }
    return r;
  }

  // ====================================================================== front matter (the part between --- lines)
  function parseDoc(text) {
    text = text.replace(/\r\n/g, '\n');
    const doc = { entries: [], body: text, sep: '\n\n', hasFm: false };
    if (!text.startsWith('---\n')) return doc;
    const end = text.indexOf('\n---', 4);
    if (end < 0) return doc;
    doc.hasFm = true;
    const head = text.slice(4, end);
    const rest = text.slice(end + 4);
    doc.sep = rest.match(/^\n*/)[0];
    doc.body = rest.slice(doc.sep.length);
    let help = [];
    let cur = null;
    for (const line of head.split('\n')) {
      const t = line.trim();
      const li = /^\s+-\s+(.*)$/.exec(line);
      if (li && cur) {
        cur.items.push(unq(li[1]));
        if (cur.listQuoted == null) cur.listQuoted = isQuoted(li[1]);
        cur.raw.push(line);
        cur.isList = true;
        continue;
      }
      if (!t || t.startsWith('#')) {
        doc.entries.push({ raw: line });
        if (t) help.push(t.replace(/^#+\s?/, '')); else help = [];
        cur = null;
        continue;
      }
      const i = line.indexOf(':');
      if (i > 0) {
        const rawVal = line.slice(i + 1);
        cur = { key: line.slice(0, i).trim(), value: unq(rawVal), quoted: isQuoted(rawVal), items: [], raw: [line], help: help.join(' '), isList: false };
        help = [];
        doc.entries.push(cur);
        continue;
      }
      doc.entries.push({ raw: line });
      cur = null;
    }
    doc.entries.forEach(e => { if (e.key) e.origVal = JSON.stringify(e.isList ? e.items : e.value); });
    return doc;
  }

  const fmEntry = (doc, k) => doc.entries.find(e => e.key === k);
  const fmGet = (doc, k) => { const e = fmEntry(doc, k); return e ? (e.isList ? e.items : e.value) : undefined; };

  function fmSet(doc, k, v) {
    let e = fmEntry(doc, k);
    if (!e) {
      e = { key: k, value: '', items: [], raw: [], help: '', isList: false, isNew: true, quoted: true };
      doc.entries.push(e);
      doc.hasFm = true;
    }
    if (Array.isArray(v)) { e.isList = true; e.items = v.slice(); } else { e.isList = false; e.value = v; }
    e.dirty = true;
  }

  function fmtVal(v, quoted) {
    if (typeof v === 'number') return String(v);
    v = oneLine(v);
    if (/^-?\d+$/.test(v) && !quoted) return v;
    if (quoted || v === '' || isQuoted(v)) return '"' + v + '"';
    return v;
  }

  function fmLines(e) {
    if (!e.key) return [e.raw];
    if (!e.dirty || (!e.isNew && JSON.stringify(e.isList ? e.items : e.value) === e.origVal)) return e.raw;
    if (e.isList) {
      const items = e.items.map(oneLine).filter(Boolean);
      if (!items.length) return [e.key + ':'];
      const q = e.listQuoted != null ? e.listQuoted : items.some(x => /[:#|"]/.test(x));
      return [e.key + ':', ...items.map(x => '  - ' + (q ? '"' + x + '"' : x))];
    }
    return [e.key + ': ' + fmtVal(e.value, e.quoted)];
  }

  function serializeDoc(doc, body) {
    if (!doc.hasFm) return body;
    const lines = [];
    for (const e of doc.entries) {
      if (e.isNew && (e.isList ? !e.items.some(x => oneLine(x)) : oneLine(e.value) === '')) continue;
      lines.push(...fmLines(e));
    }
    return '---\n' + lines.join('\n') + '\n---' + (doc.sep || '\n\n') + body;
  }

  // ====================================================================== what each kind of page has
  const COLS = {
    tours: {
      dir: 'content/tours/', title: 'Tours', one: 'tour', body: 'tour', folder: 'tours',
      label: m => m.title, sub: m => [m.duration, m.tagline].filter(Boolean).join(' · '),
      url: (m, slug) => m.url || '/' + slug + '/', canAdd: true,
      intro: 'Multi-day tours and day tours. The file name becomes the web address.',
      fields: [
        ['title', 'Tour name', 'text'],
        ['tagline', 'Tagline', 'text', 'One short line under the name.'],
        ['duration', 'Length', 'text', 'For example “10 days” or “1 day”. Used to sort tours by length.'],
        ['category', 'Type', 'select', '', [['bespoke', 'Multi-day tour'], ['wildlife', 'Day tour']]],
        ['themes', 'Categories', 'themes', 'Tap to add or remove. The first one is the main category: it sets the breadcrumb.'],
        ['best_months', 'Best months', 'text', 'For example “Dec-Apr”. Shown as “Best …” on the tour.'],
        ['mixed_months', 'Mixed months', 'text', 'Months that can go either way, for example “Jul-Sep, Nov”. Other months count as off-season.'],
        ['image', 'Main photo', 'photo', 'The photo on tour cards, and at the top of the tour when there is no top photo.'],
        ['hero_image', 'Top photo (wide)', 'photo', 'The full-screen photo at the top of the tour page. Use a wide photo, 2000px or more across. Leave empty to use the main photo.'],
        ['summary', 'Short summary', 'textarea', 'Shown on tour cards and in Google results. Two sentences is plenty.'],
        ['order', 'Position in lists', 'number', 'Lower numbers come first.'],
      ],
      template: (title, slug) => `---\ntitle: "${title}"\ntagline: ""\ncategory: "bespoke"\nthemes:\n  - culture-heritage\n# weather: the months this tour is at its best, and the mixed ones (other months count as off-season)\nbest_months: "Dec-Apr"\nmixed_months: ""\nduration: "7 days"\nimage: ""\nsummary: ""\norder: 50\n---\n\nA few sentences that welcome guests to this tour.\n\n## Itinerary\n\n### Day 1 · Negombo · Arrival\n\n- Arrive at Bandaranaike International Airport (CMB)\n- Transfer to your hotel\n\n## Journey highlights\n\n- The first highlight\n\n## FAQ\n\n### Can the tour be customized?\n\nYes. Every tour is private and tailor-made.\n`,
    },
    destinations: {
      dir: 'content/destinations/', title: 'Destinations', one: 'destination', body: 'place', folder: 'places',
      label: m => m.name, sub: m => [m.region, m.tagline].filter(Boolean).join(' · '),
      url: (m, slug) => '/destinations/' + slug + '/', canAdd: true,
      intro: 'One page per place, at /destinations/<name>/.',
      fields: [
        ['name', 'Place name', 'text'],
        ['tagline', 'Tagline', 'text'],
        ['image', 'Main photo', 'photo', 'Destination photos are tall portraits.'],
        ['region', 'Region', 'select', 'Groups the places on the Destinations page.', REGIONS.map(r => [r, r])],
        ['district', 'District', 'text', 'Sets the weather shown for this place, for example “Badulla”.'],
        ['map', 'Map pin', 'text', 'Latitude, longitude. For example “6.8667, 81.0466” (right-click the place in Google Maps to copy it).'],
        ['order', 'Position in lists', 'number'],
      ],
      template: (title) => `---\nname: "${title}"\ntagline: ""\nimage: ""\norder: 50\nregion: "Hill country"\ndistrict: ""\nmap: ""\n---\n\nA few sentences about ${title}.\n\n**Hidden gems**\n\n- A hidden gem\n\n**Best time to visit:** \n`,
    },
    categories: {
      dir: 'content/categories/', title: 'Tour categories', one: 'category', body: 'text', folder: 'tours',
      label: m => m.name, sub: m => m.tagline, url: (m, slug) => '/tours/' + slug + '/',
      intro: 'The 7 kinds of trip. A tour joins a category by listing it under its categories.',
      fields: [
        ['name', 'Name', 'text'], ['title', 'Page title', 'text'], ['word', 'Word on the home wheel', 'text'],
        ['tagline', 'Tagline', 'text'], ['image', 'Photo', 'photo'], ['focus', 'Photo focus', 'text'],
        ['description', 'Description for Google', 'textarea'], ['order', 'Position in lists', 'number'],
      ],
    },
    pages: {
      dir: 'content/pages/', title: 'Pages', one: 'page', body: 'text', folder: 'site',
      label: m => m.title, sub: m => m.url, url: m => m.url,
      intro: 'Home, About us, Contact and the other pages. Lines like {{testimonials}} insert ready-made blocks: leave them as they are.',
      fields: [], advanced: ['url', 'layout'],
    },
    posts: {
      dir: 'content/posts/', title: 'Blog posts', one: 'post', body: 'text', folder: 'blog',
      label: m => m.title, sub: m => [m.date, m.category].filter(Boolean).join(' · '), url: m => m.url,
      canAdd: true, sortDate: true,
      intro: 'Travel stories, newest first.',
      fields: [
        ['title', 'Title', 'text'], ['date', 'Date', 'date'], ['category', 'Topic', 'text'],
        ['image', 'Photo', 'photo'], ['summary', 'Summary', 'textarea'],
      ],
      advanced: ['url'],
      template: (title, slug, date) => `---\ntitle: "${title}"\ndate: "${date}"\nurl: "/${date.replace(/-/g, '/')}/${slug}/"\ncategory: ""\nimage: ""\nsummary: ""\n---\n\nStart writing here.\n`,
    },
  };

  const LISTS = {
    reviews: {
      path: 'content/testimonials.txt', title: 'Guest reviews', one: 'review',
      intro: 'Shown on the home and About pages.',
      cols: [['name', 'Name', 'text'], ['review', 'Review', 'textarea'], ['photo', 'Photo', 'photo', 'people']],
    },
    partners: {
      path: 'content/partners.txt', title: 'Partner logos', one: 'logo',
      intro: 'Logos shown under the reviews.',
      cols: [['name', 'Name', 'text'], ['logo', 'Logo', 'photo', 'logos'], ['link', 'Link (optional)', 'text']],
    },
    vehicles: {
      path: 'content/vehicles.txt', title: 'Vehicles', one: 'vehicle',
      intro: 'Vehicles on the transport page.',
      cols: [['name', 'Name', 'text'], ['model', 'Model', 'text'], ['seats', 'Seats', 'text'], ['driving', 'Driving', 'text'], ['price', 'Price (optional)', 'text']],
    },
  };

  const RAW_FILES = [
    ['content/menu.txt', 'Menu', 'The menu at the top of every page.'],
    ['content/redirects.txt', 'Old addresses', 'Old web addresses and the new pages they lead to.'],
    ['content/data/photo-credits.txt', 'Photo credits', 'Where downloaded photos came from.'],
  ];

  function docMeta(path) {
    const d = parseDoc(textOf(path));
    const m = {};
    d.entries.forEach(e => { if (e.key) m[e.key] = e.isList ? e.items : e.value; });
    return m;
  }
  const categories = () => filesIn('content/categories/').filter(f => f.path.endsWith('.md'))
    .map(f => ({ slug: stem(f.path), ...docMeta(f.path) }))
    .sort((a, b) => (+a.order || 99) - (+b.order || 99));
  const placeNames = () => filesIn('content/destinations/').filter(f => f.path.endsWith('.md'))
    .map(f => docMeta(f.path).name).filter(Boolean).sort();

  // ====================================================================== page shell
  const app = document.getElementById('app');
  let main, statusEl, saveBar, saveBarText;

  const NAV = [
    ['#/', 'Home', 'home'],
    ['#/photos', 'Photos', 'photo'],
    null,
    ['#/c/tours', 'Tours', 'map'],
    ['#/c/destinations', 'Destinations', 'pin'],
    ['#/c/categories', 'Tour categories', 'grid'],
    ['#/c/pages', 'Pages', 'page'],
    ['#/c/posts', 'Blog posts', 'pen'],
    null,
    ['#/list/reviews', 'Guest reviews', 'quote'],
    ['#/list/partners', 'Partner logos', 'star'],
    ['#/list/vehicles', 'Vehicles', 'car'],
    null,
    ['#/settings', 'Settings', 'gear'],
    ['#/files', 'Menu & addresses', 'list'],
  ];
  const ICONS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    photo: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 11l5-5 4 4 3-3 4 4M15.5 9.5h.01',
    map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
    pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
    pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    quote: 'M7 17c-2 0-3-1.5-3-3.5C4 10 6 7.5 9 6l1 1.5C8.3 8.6 7.6 9.8 7.5 11H10v6zm9 0c-2 0-3-1.5-3-3.5 0-3.5 2-6 5-7.5l1 1.5c-1.7 1.1-2.4 2.3-2.5 3.5H19v6z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    car: 'M5 16h14M6 16l1.5-5.5A2 2 0 0 1 9.4 9h5.2a2 2 0 0 1 1.9 1.5L18 16v3h-2v-1.5H8V19H6zM8 13.5h.01M16 13.5h.01',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2l-4-4',
    left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', copy: 'M9 9h10v10H9zM5 15V5h10',
  };
  const icon = (name, cls) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICONS[name] || '');
    s.append(p);
    return s;
  };
  const iconBtn = (name, label, fn, disabled) => h('button.icon-btn', { type: 'button', title: label, 'aria-label': label, disabled: !!disabled, onclick: fn }, icon(name));

  function shell() {
    const nav = h('nav.side-nav', NAV.map(n => (n ? h('a.nav-link', { href: n[0], dataset: null, 'data-route': n[0] }, icon(n[2]), h('span', n[1])) : h('hr'))));
    statusEl = h('div.status');
    const siteLink = h('a.top-link', { href: S.be.siteUrl('/'), target: '_blank', rel: 'noopener' }, 'View site', icon('ext'));
    const modeChip = S.be.mode === 'local'
      ? h('span.mode-chip', { title: 'Changes are saved into the files on this computer and the site is rebuilt at once.' }, h('i'), 'On this computer')
      : h('span.mode-chip.online', { title: 'Changes are saved to GitHub and published.' }, h('i'), 'Online · ' + S.be.repo);
    const signOut = S.be.mode === 'github' ? h('button.top-link.plain', { type: 'button', onclick: () => { S.be.signOut(); location.reload(); } }, 'Sign out') : null;
    saveBarText = h('span.sb-text', 'You have unsaved changes');
    saveBar = h('div.save-bar', { hidden: true },
      h('div.sb-inner', saveBarText,
        h('button.btn.ghost', { type: 'button', onclick: () => S.editor && S.editor.discard() }, 'Discard'),
        h('button.btn.gold', { type: 'button', onclick: () => S.editor && S.editor.save() }, 'Save changes')));
    main = h('main.main');
    app.replaceChildren(
      h('header.topbar',
        h('a.brand', { href: '#/' }, h('img', { src: imgUrl('/img/logo-white.png'), alt: '' }), h('span', 'Admin')),
        modeChip, h('div.spacer'), statusEl, siteLink, signOut),
      h('div.layout', h('aside.side', nav), main),
      saveBar,
      h('div.toasts'));
  }

  function setStatus(kind, text, link) {
    if (!statusEl) return;
    statusEl.className = 'status ' + (kind || '');
    statusEl.replaceChildren(h('i'), link ? h('a', { href: link, target: '_blank', rel: 'noopener' }, text) : h('span', text));
  }

  function toast(text, opts = {}) {
    const box = document.querySelector('.toasts');
    const el = h('div.toast' + (opts.bad ? '.bad' : ''), h('span', text));
    if (opts.link) el.append(h('a', { href: opts.link[1], target: opts.link[2] ? '_blank' : null }, opts.link[0]));
    box.append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
    if (!opts.sticky) setTimeout(close, opts.bad ? 8000 : 4000);
    return { el, close, set(t) { el.firstChild.textContent = t; } };
  }

  function showBuildError(log) {
    dialog({
      title: 'The site could not be rebuilt',
      body: [h('p', 'Your change was saved, but the website builder stopped with this message. Undo the last change or ask for help with it.'),
        h('pre.log', log || '(no message)')],
      actions: [['OK', true]],
    });
  }

  // ====================================================================== dialogs
  function dialog({ title, body, actions, wide, onOpen }) {
    return new Promise(resolve => {
      const close = v => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', esc); resolve(v); };
      const esc = e => { if (e.key === 'Escape') close(null); };
      const foot = actions ? h('div.dlg-foot', actions.map(([label, val, cls]) => h('button.btn' + (cls ? '.' + cls : val ? '.gold' : '.ghost'), { type: 'button', onclick: () => close(typeof val === 'function' ? val() : val) }, label))) : null;
      const box = h('div.dlg' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true' },
        h('div.dlg-head', h('h2', title), iconBtn('x', 'Close', () => close(null))),
        h('div.dlg-body', body), foot);
      const wrap = h('div.dlg-wrap', { onmousedown: e => { if (e.target === wrap) close(null); } }, box);
      document.body.append(wrap);
      document.addEventListener('keydown', esc);
      requestAnimationFrame(() => wrap.classList.add('in'));
      if (onOpen) onOpen(box, close);
    });
  }

  const confirmBox = (title, text, ok, danger) => dialog({
    title, body: h('p', text), actions: [['Cancel', false], [ok, true, danger ? 'danger' : 'gold']],
  });

  async function askText(title, label, value, hint) {
    const inp = h('input', { type: 'text', value: value || '' });
    let res = null;
    await dialog({
      title,
      body: [h('label.field', h('span.f-label', label), inp, hint ? h('span.f-help', hint) : null)],
      actions: [['Cancel', false], ['OK', () => { res = inp.value.trim(); return true; }]],
      onOpen: (box, close) => {
        inp.focus();
        inp.select();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { res = inp.value.trim(); close(true); } });
      },
    });
    return res;
  }

  // ====================================================================== form controls
  function autoGrow(el) {
    if (!el.isConnected) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }
  const growAll = root => requestAnimationFrame(() => root.querySelectorAll('textarea.grow').forEach(autoGrow));
  // text wraps differently once the web fonts arrive or the window changes size
  window.addEventListener('resize', debounce(() => growAll(document), 120));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => growAll(document));

  function textInput(value, onChange, opts = {}) {
    const el = opts.multiline
      ? h('textarea.grow', { value: value == null ? '' : value, rows: opts.rows || 2, placeholder: opts.placeholder || '' })
      : h('input', { type: opts.type || 'text', value: value == null ? '' : value, placeholder: opts.placeholder || '' });
    if (opts.list) el.setAttribute('list', opts.list);
    el.addEventListener('input', () => { if (opts.multiline) autoGrow(el); onChange(el.value); });
    return el;
  }

  function selectInput(options, value, onChange) {
    const opts = options.slice();
    if (value && !opts.some(o => o[0] === value)) opts.push([value, value]);
    const el = h('select', opts.map(o => h('option', { value: o[0], selected: o[0] === value }, o[1])));
    if (!value) el.prepend(h('option', { value: '', selected: true }, 'Choose…'));
    el.addEventListener('change', () => onChange(el.value));
    return el;
  }

  function field(label, help, control, wide) {
    return h('div.field' + (wide ? '.wide' : ''), h('span.f-label', label), control, help ? h('span.f-help', help) : null);
  }

  function folderOf(src) {
    const m = /^\/img\/([^/]+)\//.exec(src || '');
    return m ? m[1] : '';
  }

  function photoField(value, onChange, opts = {}) {
    const wrap = h('div.photo-field' + (opts.tall ? '.tall' : ''));
    const pick = () => openPicker({ folder: opts.folder || folderOf(value) || 'tours' }, p => { value = p; onChange(p); draw(); });
    const draw = () => {
      wrap.replaceChildren(
        h('button.pf-thumb', { type: 'button', onclick: pick, title: 'Choose a photo' }, value ? imgEl(value) : h('span.pf-empty', icon('plus'), 'Add photo')),
        h('div.pf-side',
          value ? h('code.pf-path', value) : h('span.muted', 'No photo yet'),
          h('div.pf-actions',
            h('button.btn.sm', { type: 'button', onclick: pick }, value ? 'Change photo' : 'Choose photo'),
            value && !opts.required ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { value = ''; onChange(''); draw(); } }, 'Remove') : null)));
    };
    draw();
    return wrap;
  }

  function listField(items, onChange, opts = {}) {
    items = items.slice();
    const box = h('div.list-field');
    const emit = () => onChange(items.slice());
    const move = (i, d) => { const j = i + d; [items[i], items[j]] = [items[j], items[i]]; emit(); draw(); };
    const draw = () => {
      box.replaceChildren(
        ...items.map((it, i) => h('div.lf-row',
          h('span.lf-no', i + 1),
          textInput(it, v => { items[i] = v; emit(); }, { multiline: true, rows: 1, placeholder: opts.placeholder }),
          h('div.row-tools',
            iconBtn('up', 'Move up', () => move(i, -1), i === 0),
            iconBtn('down', 'Move down', () => move(i, 1), i === items.length - 1),
            iconBtn('x', 'Remove', () => { items.splice(i, 1); emit(); draw(); })))),
        h('button.btn.sm.add', {
          type: 'button',
          onclick: () => { items.push(''); emit(); draw(); const all = box.querySelectorAll('textarea'); if (all.length) all[all.length - 1].focus(); },
        }, icon('plus'), opts.addLabel || 'Add'));
      growAll(box);
    };
    draw();
    return box;
  }

  function themesField(value, onChange) {
    const sel = (Array.isArray(value) ? value : value ? [value] : []).slice();
    const cats = categories();
    const box = h('div.chips');
    const draw = () => box.replaceChildren(
      ...cats.map(c => {
        const i = sel.indexOf(c.slug);
        return h('button.chip' + (i >= 0 ? '.on' : ''), {
          type: 'button',
          onclick: () => { if (i >= 0) sel.splice(i, 1); else sel.push(c.slug); onChange(sel.slice()); draw(); },
        }, i >= 0 ? h('b', i + 1) : null, c.name || c.slug, i === 0 ? h('em', 'main') : null);
      }),
      ...sel.filter(s => !cats.some(c => c.slug === s)).map(s => h('span.chip.on.unknown', { title: 'No category file has this name' }, s)));
    draw();
    return box;
  }

  // a text box for the site's own simple text format, with buttons for photos and styles
  function mdEditor(text, onChange, opts = {}) {
    const ta = h('textarea.md.grow', { value: text, rows: opts.rows || 5, spellcheck: true, placeholder: opts.placeholder || '' });
    const strip = h('div.md-photos');
    const fire = () => { autoGrow(ta); onChange(ta.value); drawStrip(); };
    ta.addEventListener('input', fire);
    const insert = (snippet, block) => {
      const s = ta.selectionStart; const e = ta.selectionEnd; const v = ta.value;
      let before = v.slice(0, s); const after = v.slice(e);
      if (block) {
        if (before.trim() && !before.endsWith('\n\n')) before = before.replace(/\n?$/, '\n\n');
        if (after.trim()) snippet += after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      }
      ta.value = before + snippet + after;
      const pos = (before + snippet).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
      fire();
    };
    const wrapSel = (l, r, ph) => {
      const s = ta.selectionStart; const e = ta.selectionEnd; const v = ta.value;
      const sel = v.slice(s, e) || ph;
      ta.value = v.slice(0, s) + l + sel + r + v.slice(e);
      ta.focus();
      ta.setSelectionRange(s + l.length, s + l.length + sel.length);
      fire();
    };
    const tool = (label, fn, ic) => h('button.md-tool', { type: 'button', onclick: fn }, ic ? icon(ic) : null, label);
    const tools = h('div.md-tools',
      tool('Photo', () => openPicker({ folder: opts.folder || 'tours', multi: true }, ps => insert([].concat(ps).map(p => `![](${p})`).join(' '), true)), 'photo'),
      tool('Bold', () => wrapSel('**', '**', 'bold words')),
      tool('Italic', () => wrapSel('*', '*', 'italic words')),
      opts.noHeadings ? null : tool('Heading', () => insert('### A heading', true)),
      tool('Link', async () => {
        const url = await askText('Add a link', 'Link to', '', 'A page of this site such as /contact-us/, or a full address starting with https://');
        if (url) wrapSel('[', `](${url})`, 'link words');
      }),
      tool('Button', async () => {
        const url = await askText('Add a button', 'The button opens', '/contact-us/#plan');
        if (url) insert(`[Button words](${url}){.btn}`, true);
      }),
      h('span.md-hint', 'Several photos on one line become a row.'));
    const drawStrip = () => {
      const seen = new Set();
      const pics = parseImgs(ta.value).filter(p => !seen.has(p.src) && seen.add(p.src));
      strip.replaceChildren(...pics.map(p => h('div.md-pic',
        h('button', { type: 'button', title: 'Change this photo', onclick: () => openPicker({ folder: folderOf(p.src) || opts.folder }, np => { ta.value = ta.value.split('](' + p.src).join('](' + np); fire(); }) }, imgEl(p.src)),
        iconBtn('x', 'Take this photo out of the text', () => {
          const rx = new RegExp('!\\[[^\\]]*\\]\\(' + p.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s+"[^"]*")?\\)[ \\t]?', 'g');
          ta.value = ta.value.replace(rx, '').replace(/\n{3,}/g, '\n\n');
          fire();
        }))));
      strip.hidden = !pics.length;
    };
    drawStrip();
    return h('div.md-editor', tools, ta, strip);
  }

  // ====================================================================== photos: library, picker, upload
  function folders() {
    const counts = new Map();
    images().forEach(f => {
      const parts = f.path.split('/');
      const k = parts.length > 3 ? parts[2] : '';
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const order = ['tours', 'places', 'site', 'about', 'blog', 'people', 'logos'];
    return [...counts.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }
  const FOLDER_NAMES = { tours: 'Tours', places: 'Destinations', site: 'Site & home', about: 'About us', blog: 'Blog', people: 'Guests', logos: 'Logos', '': 'Main folder' };
  const folderName = k => FOLDER_NAMES[k] != null ? FOLDER_NAMES[k] : humanize(k);
  const folderDir = k => 'static/img/' + (k ? k + '/' : '');

  function photoBrowser({ folder, onPick, multi }) {
    let cur = folders().some(f => f[0] === folder) ? folder : 'tours';
    let q = '';
    const picked = [];
    const tabs = h('div.folder-tabs');
    const grid = h('div.photo-grid');
    const search = h('input.search', { type: 'search', placeholder: 'Search photos by name' });
    search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); drawGrid(); }, 120));
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    fileInput.addEventListener('change', async () => {
      const paths = await uploadFlow(fileInput.files, cur);
      fileInput.value = '';
      if (paths && paths.length) {
        drawTabs();
        drawGrid();
        if (onPick && !multi && paths.length === 1) onPick(paths[0]);
      }
    });
    const doneBtn = multi ? h('button.btn.gold', { type: 'button', disabled: true, onclick: () => onPick(picked.slice()) }, 'Add photos') : null;
    const drawTabs = () => tabs.replaceChildren(...folders().map(([k, n]) => h('button.ftab' + (k === cur ? '.on' : ''), {
      type: 'button', onclick: () => { cur = k; drawTabs(); drawGrid(); },
    }, folderName(k), h('small', n))));
    const drawGrid = () => {
      let list = images().filter(f => (q ? f.path.toLowerCase().includes(q) : f.path.startsWith(folderDir(cur)) && f.path.slice(folderDir(cur).length).indexOf('/') < 0));
      list.sort((a, b) => (S.recent.has(b.path) - S.recent.has(a.path)) || a.path.localeCompare(b.path));
      grid.replaceChildren(
        h('button.tile.upload-tile', { type: 'button', onclick: () => fileInput.click() }, icon('upload'), h('b', 'Upload photos'), h('small', 'to ' + folderName(cur))),
        ...list.map(f => {
          const src = sitePath(f.path);
          const tile = h('button.tile' + (S.recent.has(f.path) ? '.new' : '') + (picked.includes(src) ? '.picked' : ''), {
            type: 'button', title: basename(f.path),
            onclick: () => {
              if (multi) {
                const i = picked.indexOf(src);
                if (i >= 0) picked.splice(i, 1); else picked.push(src);
                tile.classList.toggle('picked', i < 0);
                doneBtn.disabled = !picked.length;
                doneBtn.textContent = picked.length ? 'Add ' + plural(picked.length, 'photo') : 'Add photos';
              } else if (onPick) onPick(src);
              else photoDetail(f, () => { drawTabs(); drawGrid(); });
            },
          }, imgEl(src), h('span.tile-name', stem(f.path)));
          return tile;
        }));
      if (!list.length && q) grid.append(h('p.muted.empty', 'No photo matches “' + q + '”.'));
    };
    // drop photos straight onto the grid
    grid.addEventListener('dragover', e => { e.preventDefault(); grid.classList.add('drop'); });
    grid.addEventListener('dragleave', () => grid.classList.remove('drop'));
    grid.addEventListener('drop', async e => {
      e.preventDefault();
      grid.classList.remove('drop');
      if (e.dataTransfer.files.length) {
        const paths = await uploadFlow(e.dataTransfer.files, cur);
        if (paths && paths.length) { drawTabs(); drawGrid(); }
      }
    });
    drawTabs();
    drawGrid();
    return h('div.browser', h('div.browser-bar', tabs, h('div.browser-tools', search, doneBtn)), grid, fileInput);
  }

  function openPicker(opts, cb) {
    let closeFn;
    const browser = photoBrowser({ folder: opts.folder, multi: opts.multi, onPick: p => { closeFn(); cb(p); } });
    dialog({ title: opts.multi ? 'Choose photos' : 'Choose a photo', body: browser, wide: true, onOpen: (box, close) => { closeFn = () => close(true); } });
  }

  function loadImg(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(file.name + ' could not be read as a photo.'));
      img.src = URL.createObjectURL(file);
    });
  }

  // shrink a photo in the browser before it is uploaded, so the site stays fast
  async function prepareImage(file, folder, forceExt) {
    const ext = ((file.name.match(/\.([^.]+)$/) || [])[1] || '').toLowerCase();
    if (/svg|gif/.test(file.type) || ext === 'svg' || ext === 'gif') {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { blob: file, bytes, ext: ext === 'svg' ? 'svg' : 'gif', before: file.size, after: file.size };
    }
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = await loadImg(file); }
    const sw = src.width || src.naturalWidth; const sh = src.height || src.naturalHeight;
    const max = MAX_SIDE[folder] || DEFAULT_SIDE;
    const k = Math.min(1, max / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * k)); const hh = Math.max(1, Math.round(sh * k));
    const outExt = forceExt || (file.type === 'image/png' && (folder === 'logos' || folder === '') ? 'png' : file.type === 'image/webp' && forceExt === 'webp' ? 'webp' : 'jpg');
    const type = outExt === 'png' ? 'image/png' : outExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, hh);
    let blob = await new Promise(r => c.toBlob(r, type, 0.84));
    if (!blob) throw new Error(file.name + ' could not be converted.');
    if (k === 1 && blob.size >= file.size && file.type === type) blob = file; // already small: keep the original
    return { blob, bytes: new Uint8Array(await blob.arrayBuffer()), ext: outExt === 'jpg' && ext === 'jpeg' && blob === file ? 'jpeg' : outExt, w, h: hh, before: file.size, after: blob.size };
  }

  // ask for good file names, then shrink and upload the photos; returns their /img/… paths
  async function uploadFlow(fileList, folder) {
    const files = [...fileList].filter(f => /^image\//.test(f.type) || IMG_RX.test(f.name));
    if (!files.length) { toast('Those files are not photos.', { bad: true }); return []; }
    const rows = files.map(f => ({ file: f, name: slugify(stem(f.name)) || 'photo', url: URL.createObjectURL(f) }));
    const max = MAX_SIDE[folder] || DEFAULT_SIDE;
    const ok = await dialog({
      title: 'Upload ' + plural(files.length, 'photo') + ' to ' + folderName(folder),
      body: [
        h('p.muted', 'Give each photo a short name that says what it shows, for example “kandy-temple-of-the-tooth”. Good names help Google. Large photos are shrunk to ' + max + ' px on the longest side.'),
        h('div.up-list', rows.map(r => h('div.up-row', h('img', { src: r.url, alt: '' }),
          h('div.up-info', h('input', { type: 'text', value: r.name, oninput: e => { r.name = e.target.value; } }), h('small.muted', kb(r.file.size)))))),
      ],
      actions: [['Cancel', false], ['Upload', true]],
    });
    rows.forEach(r => URL.revokeObjectURL(r.url));
    if (!ok) return [];
    const t = toast('Getting ' + plural(files.length, 'photo') + ' ready…', { sticky: true });
    try {
      const taken = new Set(S.files.map(f => f.path));
      const changes = [];
      let before = 0; let after = 0;
      for (const r of rows) {
        const out = await prepareImage(r.file, folder);
        const base = slugify(r.name) || 'photo';
        let path; let n = 1;
        do { path = folderDir(folder) + base + (n > 1 ? '-' + n : '') + '.' + out.ext; n++; } while (taken.has(path));
        taken.add(path);
        before += out.before;
        after += out.after;
        changes.push({ path, bytes: out.bytes, blobUrl: URL.createObjectURL(out.blob) });
      }
      t.set('Uploading ' + plural(changes.length, 'photo') + '…');
      await commit(changes, 'Add ' + plural(changes.length, 'photo') + ' to ' + folderName(folder));
      t.close();
      toast(plural(changes.length, 'photo') + ' added' + (after < before * 0.9 ? ' · shrunk from ' + kb(before) + ' to ' + kb(after) : ''));
      return changes.map(c => sitePath(c.path));
    } catch (e) {
      t.close();
      toast(e.message, { bad: true });
      return [];
    }
  }

  function whereUsed(src) {
    const hits = [];
    for (const [path, t] of S.texts) {
      if (path.startsWith('content/') && t.text.indexOf(src) >= 0) hits.push(path);
    }
    return hits.sort();
  }

  function editorLink(path) {
    for (const k of Object.keys(COLS)) {
      if (path.startsWith(COLS[k].dir) && path.endsWith('.md')) {
        const m = docMeta(path);
        return ['#/c/' + k + '/' + encodeURIComponent(stem(path)), COLS[k].label(m) || stem(path), COLS[k].one];
      }
    }
    for (const k of Object.keys(LISTS)) if (LISTS[k].path === path) return ['#/list/' + k, LISTS[k].title, 'list'];
    if (path === 'content/settings.txt') return ['#/settings', 'Settings', 'settings'];
    return ['#/files/' + encodeURIComponent(path), basename(path), 'file'];
  }

  async function photoDetail(f, refresh) {
    await S.ready;
    const src = sitePath(f.path);
    const used = whereUsed(src);
    const prot = PROTECTED.includes(f.path);
    const img = imgEl(src, '.pd-img');
    const dims = h('span');
    img.addEventListener('load', () => { dims.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' px'; });
    const replaceInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    let closeFn;
    replaceInput.addEventListener('change', async () => {
      const file = replaceInput.files[0];
      if (!file) return;
      const ext = (f.path.match(/\.([^.]+)$/) || [])[1].toLowerCase();
      replaceInput.value = '';
      if ((ext === 'svg' || ext === 'gif') && !file.name.toLowerCase().endsWith('.' + ext)) {
        toast('This photo is a .' + ext + ' file, so choose another .' + ext + ' file to replace it.', { bad: true });
        return;
      }
      const t = toast('Replacing the photo…', { sticky: true });
      try {
        const out = await prepareImage(file, folderOf(src), ext === 'jpeg' ? 'jpg' : ext);
        await commit([{ path: f.path, bytes: out.bytes, blobUrl: URL.createObjectURL(out.blob) }], 'Replace photo ' + basename(f.path));
        t.close();
        toast('Photo replaced. Every page that uses it now shows the new one.');
        closeFn();
        refresh();
      } catch (e) { t.close(); toast(e.message, { bad: true }); }
    });
    const del = async () => {
      if (!await confirmBox('Delete this photo?', basename(f.path) + ' will be removed from the website.', 'Delete photo', true)) return;
      try {
        await commit([{ path: f.path, delete: true }], 'Delete photo ' + basename(f.path));
        toast('Photo deleted');
        closeFn();
        refresh();
      } catch (e) { toast(e.message, { bad: true }); }
    };
    const copy = () => { navigator.clipboard && navigator.clipboard.writeText(src).then(() => toast('Copied ' + src)); };
    dialog({
      title: stem(f.path), wide: true,
      body: h('div.pd',
        h('div.pd-pic', img),
        h('div.pd-info',
          h('p.kicker', folderName(folderOf(src))),
          h('div.pd-facts', h('span', kb(f.size)), dims),
          h('div.pd-path', h('code', src), iconBtn('copy', 'Copy the photo address', copy)),
          h('h3', used.length ? 'Used on' : 'Not used on any page yet'),
          used.length ? h('ul.pd-used', used.map(p => { const l = editorLink(p); return h('li', h('a', { href: l[0], onclick: () => closeFn() }, l[1]), h('small', ' · ' + l[2])); })) : null,
          h('div.pd-actions',
            h('button.btn', { type: 'button', onclick: () => replaceInput.click() }, 'Replace with another photo'),
            prot ? h('p.muted', 'The website design uses this photo, so it can be replaced but not deleted.')
              : used.length ? h('p.muted', 'To delete it, first take it out of the pages above.')
                : h('button.btn.danger-text', { type: 'button', onclick: del }, 'Delete photo')),
          h('p.muted.small', 'Replacing keeps the same address, so every page that uses it shows the new photo.'),
          replaceInput)),
      onOpen: (box, close) => { closeFn = () => close(true); },
    });
  }

  // ====================================================================== page sections (tours)
  function splitSections(body) {
    const intro = []; const secs = []; let cur = null;
    for (const l of body.split('\n')) {
      if (/^## /.test(l)) { cur = { heading: l.slice(3).trim(), lines: [] }; secs.push(cur); } else (cur ? cur.lines : intro).push(l);
    }
    return { intro, secs };
  }
  const withBlankEnd = lines => { while (lines.length && !lines[lines.length - 1].trim()) lines.pop(); lines.push(''); return lines; };
  const textLines = t => (t.trim() ? withBlankEnd(t.replace(/\s+$/, '').split('\n')) : ['']);

  function parseDays(lines) {
    const lead = []; const days = []; let cur = null;
    for (const l of lines) {
      if (/^### /.test(l)) { cur = { heading: l.slice(4).trim(), lines: [] }; days.push(cur); } else (cur ? cur.lines : lead).push(l);
    }
    days.forEach(d => {
      // "Day 4 · Kandy → Ella · Title", "Days 2–3 · Place · Title" or "Day 8 · Title" (the place is optional)
      const parts = d.heading.split(/\s+·\s+/);
      if (/^days?\s*\d/i.test(parts[0])) {
        const rest = parts.slice(1);
        d.label = parts[0];
        d.place = rest.length >= 2 ? rest[0] : '';
        d.title = rest.length >= 2 ? rest.slice(1).join(' · ') : (rest[0] || '');
      } else {
        d.label = ''; d.place = ''; d.title = d.heading;
      }
      d.bullets = []; d.photos = []; d.before = []; d.after = [];
      d.lines.forEach(l => {
        const s = l.trim();
        if (!s) return;
        if (isBullet(l)) d.bullets.push(bulletText(s));
        else if (onlyImages(s)) d.photos.push(...parseImgs(s));
        else (d.bullets.length || d.photos.length ? d.after : d.before).push(s);
      });
    });
    return { lead, days };
  }
  function daysLines(m) {
    const out = m.lead.slice();
    if (!out.length || out[out.length - 1].trim()) out.push('');
    m.days.forEach(d => {
      const head = [oneLine(d.label), oneLine(d.place), oneLine(d.title)].filter(Boolean).join(' · ');
      out.push('### ' + head, '');
      d.before.forEach(l => out.push(l, ''));
      const bl = d.bullets.map(oneLine).filter(Boolean);
      bl.forEach(b => out.push('- ' + b));
      if (d.photos.length) out.push(d.photos.map(imgMd).join(' '));
      if (bl.length || d.photos.length) out.push('');
      d.after.forEach(l => out.push(l, ''));
    });
    return out;
  }

  function parseFaq(lines) {
    const lead = []; const qs = []; let cur = null;
    for (const l of lines) {
      if (/^### /.test(l)) { cur = { q: l.slice(4).trim(), a: [] }; qs.push(cur); } else (cur ? cur.a : lead).push(l);
    }
    qs.forEach(x => { x.a = x.a.join('\n').trim(); });
    return { lead, qs };
  }
  function faqLines(m) {
    const out = m.lead.slice();
    if (!out.length || out[out.length - 1].trim()) out.push('');
    m.qs.filter(x => oneLine(x.q)).forEach(x => {
      out.push('### ' + oneLine(x.q), '');
      if (x.a.trim()) out.push(...x.a.trim().split('\n'), '');
    });
    return out;
  }

  function makeSection(s, changed) {
    const sec = { heading: s.heading, orig: s.lines, changed: false };
    const nonEmpty = s.lines.filter(l => l.trim());
    if (/^itinerary$/i.test(s.heading)) { sec.kind = 'days'; sec.m = parseDays(s.lines); }
    else if (/^faq$/i.test(s.heading)) { sec.kind = 'faq'; sec.m = parseFaq(s.lines); }
    else if (nonEmpty.length && nonEmpty.every(isBullet)) { sec.kind = 'list'; sec.items = nonEmpty.map(l => bulletText(l.trim())); }
    else { sec.kind = 'text'; sec.text = s.lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, ''); }
    sec.touch = () => { sec.changed = true; changed(); };
    sec.lines = () => {
      if (!sec.changed) return sec.orig;
      if (sec.kind === 'days') return daysLines(sec.m);
      if (sec.kind === 'faq') return faqLines(sec.m);
      if (sec.kind === 'list') return ['', ...sec.items.map(oneLine).filter(Boolean).map(x => '- ' + x), ''];
      return ['', ...textLines(sec.text)];
    };
    return sec;
  }

  function tourBody(body, changed) {
    const sp = splitSections(body);
    const intro = { text: sp.intro.join('\n'), orig: sp.intro, changed: false };
    const secs = sp.secs.map(s => makeSection(s, changed));
    return {
      value() {
        const lines = intro.changed ? (intro.text.trim() ? textLines(intro.text) : []) : intro.orig.slice();
        secs.forEach(s => lines.push('## ' + oneLine(s.heading), ...s.lines()));
        return lines.join('\n');
      },
      view(col) {
        const out = [card('Opening text', 'The first paragraphs under the tour name.',
          mdEditor(intro.text.replace(/^\n+/, '').replace(/\s+$/, ''), v => { intro.text = v; intro.changed = true; changed(); }, { folder: col.folder }))];
        secs.forEach(s => out.push(sectionCard(s, col)));
        return out;
      },
    };
  }

  function card(title, help, ...kids) {
    return h('section.card', h('div.card-head', typeof title === 'string' ? h('h2', title) : title, help ? h('p.card-help', help) : null), kids);
  }

  function sectionCard(s, col) {
    const headInput = h('input.sec-title', { type: 'text', value: s.heading, title: 'The heading of this part' });
    headInput.addEventListener('input', () => { s.heading = headInput.value; s.touch(); });
    const kindHelp = { days: 'One card per day. Use a place name from Destinations so the day links to its page.', faq: 'Questions and answers. They fold open on the tour page.', list: 'One point per line.', text: '' }[s.kind];
    let content;
    if (s.kind === 'days') content = daysEditor(s, col);
    else if (s.kind === 'faq') content = faqEditor(s);
    else if (s.kind === 'list') content = listField(s.items, v => { s.items = v; s.touch(); }, { addLabel: 'Add a point' });
    else content = mdEditor(s.text, v => { s.text = v; s.touch(); }, { folder: col.folder });
    return card(headInput, kindHelp, content);
  }

  function daysEditor(s, col) {
    const box = h('div.days');
    const m = s.m;
    // plain "Day 1, Day 2 …" labels are kept in order automatically; labels like "Days 2–3" are left as typed
    const simple = () => m.days.every(d => /^Day \d+$/.test(d.label));
    const renumber = () => { if (simple()) m.days.forEach((d, i) => { d.label = 'Day ' + (i + 1); }); };
    const move = (i, dir) => {
      const j = i + dir;
      // the label belongs to the position in the trip, so it stays where it is
      const li = m.days[i].label; const lj = m.days[j].label;
      [m.days[i], m.days[j]] = [m.days[j], m.days[i]];
      m.days[i].label = li; m.days[j].label = lj;
      s.touch(); draw();
    };
    const nextLabel = () => {
      const nums = m.days.map(d => (d.label.match(/\d+/g) || []).map(Number)).flat();
      return 'Day ' + ((nums.length ? Math.max(...nums) : 0) + 1);
    };
    const bigNo = label => { const n = (label.match(/\d+/) || [''])[0]; return n ? n.padStart(2, '0') : '–'; };
    const dayCard = (d, i) => {
      const photos = h('div.day-photos');
      const drawPhotos = () => photos.replaceChildren(
        ...d.photos.map((p, k) => h('div.day-pic',
          h('button', { type: 'button', title: 'Change this photo', onclick: () => openPicker({ folder: folderOf(p.src) || col.folder }, np => { p.src = np; s.touch(); drawPhotos(); }) }, imgEl(p.src)),
          h('div.pic-tools',
            k > 0 ? iconBtn('left', 'Move left', () => { [d.photos[k - 1], d.photos[k]] = [d.photos[k], d.photos[k - 1]]; s.touch(); drawPhotos(); }) : null,
            iconBtn('x', 'Remove this photo', () => { d.photos.splice(k, 1); s.touch(); drawPhotos(); })))),
        h('button.day-add-pic', { type: 'button', onclick: () => openPicker({ folder: col.folder }, np => { d.photos.push({ alt: '', src: np, title: '' }); s.touch(); drawPhotos(); }) }, icon('plus'), 'Add photo'));
      drawPhotos();
      const no = h('div.day-no', h('small', /^days/i.test(d.label) ? 'Days' : 'Day'), bigNo(d.label));
      const label = textInput(d.label, v => { d.label = v; no.lastChild.textContent = bigNo(v); no.firstChild.textContent = /^days/i.test(v) ? 'Days' : 'Day'; s.touch(); }, { placeholder: 'Day 1' });
      label.classList.add('day-label');
      label.title = 'The day number. Write “Days 2–3” for a stay of more than one day.';
      const place = textInput(d.place, v => { d.place = v; s.touch(); }, { placeholder: 'Place, e.g. Kandy or Kandy → Ella', list: 'dl-places' });
      const title = textInput(d.title, v => { d.title = v; s.touch(); }, { placeholder: 'What the day is about' });
      const bullets = textInput(d.bullets.join('\n'), v => { d.bullets = v.split('\n').map(x => x.replace(/^\s*[-*•]\s*/, '')); s.touch(); }, { multiline: true, rows: 3, placeholder: 'One activity per line' });
      const extra = d.before.length || d.after.length
        ? field('More text', 'Shown under the day’s activities.', textInput(d.before.concat(d.after).join('\n\n'), v => { d.before = []; d.after = v.split(/\n\s*\n/).map(x => oneLine(x)).filter(Boolean); s.touch(); }, { multiline: true, rows: 1 }), true)
        : null;
      return h('article.day',
        no,
        h('div.day-main',
          h('div.day-titles', label, place, title),
          h('div.day-grid', field('Activities', null, bullets), field('Photos', null, photos)),
          extra),
        h('div.row-tools.vertical',
          iconBtn('up', 'Move this day up', () => move(i, -1), i === 0),
          iconBtn('down', 'Move this day down', () => move(i, 1), i === m.days.length - 1),
          iconBtn('x', 'Delete this day', async () => {
            const keep = simple();
            if (await confirmBox('Delete ' + (d.label || 'this day') + '?', keep ? 'The days after it move up one.' : 'Check the day numbers of the other days afterwards.', 'Delete day', true)) {
              m.days.splice(i, 1);
              if (keep) renumber();
              s.touch(); draw();
            }
          })));
    };
    const draw = () => {
      box.replaceChildren(...m.days.map(dayCard),
        h('button.btn.add-day', {
          type: 'button',
          onclick: () => {
            m.days.push({ label: nextLabel(), place: '', title: '', bullets: [], photos: [], before: [], after: [] });
            s.touch(); draw();
            const t = box.querySelectorAll('.day-titles input');
            if (t.length) t[t.length - 2].focus();
          },
        }, icon('plus'), 'Add a day'));
      growAll(box);
    };
    draw();
    return box;
  }

  function faqEditor(s) {
    const box = h('div.faq');
    const qs = s.m.qs;
    const draw = () => {
      box.replaceChildren(...qs.map((x, i) => h('div.faq-row',
        h('div.faq-fields',
          textInput(x.q, v => { x.q = v; s.touch(); }, { placeholder: 'Question' }),
          textInput(x.a, v => { x.a = v; s.touch(); }, { multiline: true, rows: 2, placeholder: 'Answer' })),
        h('div.row-tools.vertical',
          iconBtn('up', 'Move up', () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; s.touch(); draw(); }, i === 0),
          iconBtn('down', 'Move down', () => { [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; s.touch(); draw(); }, i === qs.length - 1),
          iconBtn('x', 'Remove', () => { qs.splice(i, 1); s.touch(); draw(); })))),
      h('button.btn.sm.add', { type: 'button', onclick: () => { qs.push({ q: '', a: '' }); s.touch(); draw(); } }, icon('plus'), 'Add a question'));
      growAll(box);
    };
    draw();
    return box;
  }

  // ====================================================================== page sections (destinations)
  function placeBody(body, changed) {
    const blocks = body.replace(/\s+$/, '').split(/\n[ \t]*\n/);
    const m = { intro: [], gems: [], attractions: [], info: [], changed: false };
    const isList = b => { const ls = b.split('\n').filter(l => l.trim()); return ls.length > 0 && ls.every(isBullet); };
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i].trim();
      const first = b.split('\n')[0].trim();
      const rest = b.split('\n').slice(1).join('\n');
      if (/^\*\*Hidden gems\*\*$/i.test(first)) {
        const src = rest.trim() ? rest : blocks[i + 1] && isList(blocks[i + 1]) ? blocks[++i] : '';
        m.gems = src.split('\n').filter(isBullet).map(l => bulletText(l.trim()));
        continue;
      }
      if (/^\*\*Top attractions\*\*$/i.test(first)) {
        const src = rest.trim() ? rest : blocks[i + 1] && onlyImages(blocks[i + 1].replace(/\n/g, ' ')) ? blocks[++i] : '';
        m.attractions = parseImgs(src).map(p => ({ src: p.src, name: p.title || p.alt }));
        continue;
      }
      const im = /^\*\*([^*]+?):\*\*\s*([\s\S]*)$/.exec(b);
      if (im) { m.info.push({ label: im[1], text: oneLine(im[2]) }); continue; }
      m.intro.push(blocks[i]);
    }
    m.introText = m.intro.join('\n\n').replace(/^\n+/, '');
    const touch = () => { m.changed = true; changed(); };
    return {
      value() {
        if (!m.changed) return body;
        const out = [];
        if (m.introText.trim()) out.push(m.introText.trim());
        const gems = m.gems.map(oneLine).filter(Boolean);
        if (gems.length) out.push('**Hidden gems**', gems.map(g => '- ' + g).join('\n'));
        const at = m.attractions.filter(a => a.src);
        if (at.length) out.push('**Top attractions**', at.map(a => imgMd({ alt: a.name, src: a.src, title: a.name })).join(' '));
        m.info.filter(x => oneLine(x.label) && oneLine(x.text)).forEach(x => out.push('**' + oneLine(x.label).replace(/:$/, '') + ':** ' + oneLine(x.text)));
        return out.join('\n\n') + '\n';
      },
      view(col) {
        return [
          card('Opening text', 'The paragraphs about the place. A short last line leads into the hidden gems.',
            mdEditor(m.introText, v => { m.introText = v; touch(); }, { folder: col.folder, noHeadings: true })),
          card('Top attractions', 'A row of tall photos with their names. Change the order with the arrows.', attractionsEditor(m, touch)),
          card('Hidden gems', 'Numbered on the page. One per line, for example “Ella Wala Falls – Swim beneath a secluded cascade”.',
            listField(m.gems, v => { m.gems = v; touch(); }, { addLabel: 'Add a hidden gem' })),
          card('Good to know', 'Short facts in the box at the bottom of the page.', infoEditor(m, touch)),
        ];
      },
    };
  }

  function attractionsEditor(m, touch) {
    const box = h('div.attractions');
    const draw = () => {
      box.replaceChildren(...m.attractions.map((a, i) => h('div.attraction',
        h('button.att-pic', { type: 'button', title: 'Change the photo', onclick: () => openPicker({ folder: 'places' }, p => { a.src = p; touch(); draw(); }) }, imgEl(a.src)),
        textInput(a.name, v => { a.name = v; touch(); }, { placeholder: 'Name' }),
        h('div.row-tools',
          iconBtn('left', 'Move left', () => { [m.attractions[i - 1], m.attractions[i]] = [m.attractions[i], m.attractions[i - 1]]; touch(); draw(); }, i === 0),
          iconBtn('right', 'Move right', () => { [m.attractions[i + 1], m.attractions[i]] = [m.attractions[i], m.attractions[i + 1]]; touch(); draw(); }, i === m.attractions.length - 1),
          iconBtn('x', 'Remove', () => { m.attractions.splice(i, 1); touch(); draw(); })))),
      h('button.attraction.att-add', { type: 'button', onclick: () => openPicker({ folder: 'places' }, p => { m.attractions.push({ src: p, name: '' }); touch(); draw(); const ins = box.querySelectorAll('.attraction input'); if (ins.length) ins[ins.length - 1].focus(); }) }, icon('plus'), 'Add attraction'));
    };
    draw();
    return box;
  }

  function infoEditor(m, touch) {
    const box = h('div.info-list');
    const labels = ['Best time to visit', 'Where to stay', 'Where to eat', 'Where to shop', 'Getting there'];
    const draw = () => {
      box.replaceChildren(...m.info.map((x, i) => h('div.info-row',
        textInput(x.label, v => { x.label = v; touch(); }, { placeholder: 'Label', list: 'dl-info' }),
        textInput(x.text, v => { x.text = v; touch(); }, { multiline: true, rows: 1, placeholder: 'Text' }),
        iconBtn('x', 'Remove', () => { m.info.splice(i, 1); touch(); draw(); }))),
      h('datalist#dl-info', labels.map(l => h('option', { value: l }))),
      h('button.btn.sm.add', { type: 'button', onclick: () => { m.info.push({ label: '', text: '' }); touch(); draw(); } }, icon('plus'), 'Add a fact'));
      growAll(box);
    };
    draw();
    return box;
  }

  function textBody(body, changed, folder) {
    let text = body;
    return {
      value: () => text,
      view: col => [card('Text', 'The page text. Lines like {{form}} insert ready-made blocks; ::: band … ::: makes a full-width section.',
        mdEditor(text, v => { text = v; changed(); }, { folder: col.folder || folder, rows: 14 }))],
    };
  }

  // ====================================================================== views
  function page(kicker, title, sub, ...kids) {
    return h('div.page', h('header.page-head', h('div', kicker ? h('p.kicker', kicker) : null, h('h1', title), sub ? h('p.lead', sub) : null)), kids);
  }
  function loading(text) { main.replaceChildren(h('div.page', h('p.loading', text || 'Loading…'))); }
  function setEditor(ed) { S.editor = ed; refreshSaveBar(); }
  function refreshSaveBar() {
    const d = !!(S.editor && S.editor.isDirty());
    saveBar.hidden = !d;
    document.body.classList.toggle('has-savebar', d);
  }
  const changedSoon = debounce(refreshSaveBar, 120);

  function viewHome() {
    const n = dir => filesIn(dir).filter(f => f.path.endsWith('.md')).length;
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const tiles = [
      ['#/photos', 'Photos', plural(images().length, 'photo'), 'Upload, replace and find photos', 'photo'],
      ['#/c/tours', 'Tours', plural(n('content/tours/'), 'tour'), 'Days, photos, months and text', 'map'],
      ['#/c/destinations', 'Destinations', plural(n('content/destinations/'), 'place'), 'Attractions and hidden gems', 'pin'],
      ['#/list/reviews', 'Guest reviews', 'On the home page', 'Add a new review', 'quote'],
      ['#/c/posts', 'Blog posts', plural(n('content/posts/'), 'post'), 'Write a travel story', 'pen'],
      ['#/settings', 'Settings', 'Phone, email, links', 'Contact details and switches', 'gear'],
    ];
    const how = S.be.mode === 'local'
      ? [h('b', 'Working on this computer.'), ' Saving writes into the files in this folder and rebuilds the site at once, so you can check it on ', h('a', { href: '/', target: '_blank' }, 'localhost'), '. To put changes online, upload them to GitHub as usual.']
      : [h('b', 'Working on the live website.'), ' Saving sends the change to GitHub, and the website updates about a minute later. The status at the top shows when it is live.'];
    main.replaceChildren(page('Sunbird Lanka Tours', hello + '.', 'What would you like to change today?',
      h('div.tiles', tiles.map(t => h('a.tile-card', { href: t[0] }, icon(t[4]), h('h2', t[1]), h('p.tc-count', t[2]), h('p.tc-sub', t[3])))),
      h('div.note', how)));
  }

  function viewPhotos(folder) {
    main.replaceChildren(page('Photos', 'Photos', 'Click a photo to see where it is used, replace it or delete it. Drop new photos onto the grid to upload them.',
      photoBrowser({ folder: folder || 'tours' })));
  }

  async function viewCollection(key) {
    const col = COLS[key];
    if (!col) return notFound();
    loading();
    await S.ready;
    const docs = filesIn(col.dir).filter(f => f.path.endsWith('.md')).map(f => ({ f, slug: stem(f.path), m: docMeta(f.path) }));
    if (col.sortDate) docs.sort((a, b) => String(b.m.date || '').localeCompare(String(a.m.date || '')));
    else docs.sort((a, b) => ((+a.m.order || 999) - (+b.m.order || 999)) || String(col.label(a.m) || a.slug).localeCompare(String(col.label(b.m) || b.slug)));
    let q = '';
    const list = h('div.doc-list');
    const draw = () => list.replaceChildren(...docs.filter(d => !q || (String(col.label(d.m) || '') + ' ' + d.slug).toLowerCase().includes(q)).map(d => h('a.doc-row', { href: '#/c/' + key + '/' + encodeURIComponent(d.slug) },
      h('div.dr-img', d.m.image && typeof d.m.image === 'string' ? imgEl(d.m.image) : null),
      h('div.dr-text', h('b', col.label(d.m) || d.slug), h('small', col.sub(d.m) || d.f.path)),
      d.m.order != null && d.m.order !== '' && !col.sortDate ? h('span.dr-order', '#' + d.m.order) : null,
      h('span.dr-go', 'Edit'))));
    const search = h('input.search', { type: 'search', placeholder: 'Search ' + col.title.toLowerCase() });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); draw(); });
    draw();
    main.replaceChildren(page(null, col.title, col.intro,
      h('div.list-bar', search, col.canAdd ? h('button.btn.gold', { type: 'button', onclick: () => newDoc(key) }, icon('plus'), 'New ' + col.one) : null),
      list));
  }

  async function newDoc(key) {
    const col = COLS[key];
    const title = await askText('New ' + col.one, col.one === 'destination' ? 'Place name' : 'Title', '', 'You can change everything else after this.');
    if (!title) return;
    const today = new Date().toISOString().slice(0, 10);
    let slug = slugify(title) || col.one;
    if (key === 'posts') slug = slug.slice(0, 60);
    const fileSlug = key === 'posts' ? today + '-' + slug : slug;
    if (S.byPath.has(col.dir + fileSlug + '.md')) { toast('There is already a ' + col.one + ' with that name.', { bad: true }); return; }
    S.pendingNew = { key, slug: fileSlug, text: col.template(title.replace(/"/g, '”'), slug, today) };
    location.hash = '#/c/' + key + '/' + encodeURIComponent(fileSlug);
  }

  async function viewDoc(key, slug) {
    const col = COLS[key];
    if (!col) return notFound();
    const path = col.dir + slug + '.md';
    loading();
    await S.ready;
    let text; let isNew = false;
    if (S.pendingNew && S.pendingNew.key === key && S.pendingNew.slug === slug) { text = S.pendingNew.text; isNew = true; S.pendingNew = null; }
    else if (!S.byPath.has(path)) return notFound();
    else text = await getText(path);
    const ed = { key, col, path, slug, orig: isNew ? '' : text, sha: isNew ? null : S.byPath.get(path).sha, isNew, raw: false };

    const build = t => {
      ed.doc = parseDoc(t);
      const fn = col.body === 'tour' ? tourBody : col.body === 'place' ? placeBody : textBody;
      ed.body = fn(ed.doc.body, changedSoon, col.folder);
    };
    build(text);
    ed.current = () => (ed.raw ? ed.rawText : serializeDoc(ed.doc, ed.body.value()));
    ed.isDirty = () => ed.isNew || ed.current() !== ed.orig;
    ed.discard = async () => {
      if (ed.isNew) { setEditor(null); location.hash = '#/c/' + key; return; }
      if (!await confirmBox('Discard your changes?', 'The ' + col.one + ' goes back to how it was when you last saved.', 'Discard changes', true)) return;
      ed.raw = false; build(ed.orig); draw(); refreshSaveBar();
    };
    ed.save = async () => {
      const t = ed.current();
      const label = col.label(docMeta0(t)) || slug;
      saveBarText.textContent = 'Saving…';
      try {
        const wasNew = ed.isNew;
        await commit([{ path, text: t }], (wasNew ? 'Add ' : 'Update ') + col.one + ': ' + label, ed.sha ? { [path]: ed.sha } : null);
        ed.orig = t; ed.isNew = false; ed.sha = S.byPath.get(path).sha;
        // the form already matches what was saved; redraw only when the screen itself changes
        if (ed.raw || wasNew) { ed.raw = false; build(t); draw(); }
        else { const h1 = main.querySelector('.page-head h1'); if (h1) h1.textContent = label; }
        toast('Saved “' + label + '”', { link: ['View page', S.be.siteUrl(col.url(docMeta0(t), slug) || '/'), true] });
      } catch (e) { toast(e.message, { bad: true }); }
      saveBarText.textContent = 'You have unsaved changes';
      refreshSaveBar();
    };
    ed.remove = async () => {
      const label = col.label(docMeta0(ed.current())) || slug;
      if (!await confirmBox('Delete “' + label + '”?', 'The page will be removed from the website. Its photos stay in the photo library.', 'Delete ' + col.one, true)) return;
      try {
        await commit([{ path, delete: true }], 'Delete ' + col.one + ': ' + label);
        setEditor(null);
        toast('Deleted “' + label + '”');
        location.hash = '#/c/' + key;
      } catch (e) { toast(e.message, { bad: true }); }
    };

    const draw = () => {
      const m = docMeta0(ed.current());
      const url = col.url(m, slug);
      const rawBtn = h('button.btn.sm.ghost', {
        type: 'button',
        onclick: () => {
          if (ed.raw) { build(ed.rawText); ed.raw = false; } else { ed.rawText = ed.current(); ed.raw = true; }
          draw();
        },
      }, ed.raw ? 'Back to the form' : 'Edit as text');
      const head = h('header.page-head',
        h('div', h('p.kicker', h('a', { href: '#/c/' + key }, col.title), ' / ', ed.isNew ? 'New' : basename(path)),
          h('h1', col.label(m) || slug), col.sub(m) ? h('p.lead', col.sub(m)) : null),
        h('div.head-actions',
          url && !ed.isNew ? h('a.btn.sm.ghost', { href: S.be.siteUrl(url), target: '_blank', rel: 'noopener' }, 'View on site', icon('ext')) : null,
          rawBtn,
          (col.canAdd && !ed.isNew) ? h('button.btn.sm.danger-text', { type: 'button', onclick: ed.remove }, 'Delete') : null));
      let content;
      if (ed.raw) {
        const ta = h('textarea.raw.grow', { value: ed.rawText, spellcheck: false });
        ta.addEventListener('input', () => { ed.rawText = ta.value; autoGrow(ta); changedSoon(); });
        content = [h('div.note', 'This is the whole file as text. The part between the --- lines holds the settings; keep each setting on one line.'), ta];
      } else {
        content = [detailsCard(ed), ...ed.body.view(col)];
      }
      const dl = h('datalist#dl-places', placeNames().map(n => h('option', { value: n })));
      main.replaceChildren(h('div.page.doc', head, content, dl));
      growAll(main);
    };
    draw();
    setEditor(ed);
  }

  function docMeta0(text) {
    const d = parseDoc(text);
    const m = {};
    d.entries.forEach(e => { if (e.key) m[e.key] = e.isList ? e.items : e.value; });
    return m;
  }

  function inferType(key, val) {
    if (Array.isArray(val)) return 'list';
    if (/(^|_)(image|photo|logo|picture)$/.test(key) || /^\/img\/\S+\.(jpe?g|png|webp|gif|svg)$/i.test(val || '')) return 'photo';
    if (String(val || '').length > 70 || /(description|summary|text|intro)$/.test(key)) return 'textarea';
    return 'text';
  }

  function detailsCard(ed) {
    const doc = ed.doc;
    const col = ed.col;
    const shown = new Set();
    const fields = [];
    const advanced = [];
    const control = (key, type, opts) => {
      const e = fmEntry(doc, key);
      const val = e ? (e.isList ? e.items : e.value) : (type === 'themes' || type === 'list' ? [] : '');
      const set = v => { fmSet(doc, key, v); changedSoon(); };
      switch (type) {
        case 'photo': return photoField(val, set, { folder: col.folder, tall: col.body === 'place' });
        case 'textarea': return textInput(val, set, { multiline: true, rows: 2 });
        case 'number': return textInput(val, v => set(/^-?\d+$/.test(v.trim()) ? Number(v.trim()) : v), { type: 'number' });
        case 'date': return textInput(val, set, { type: 'date' });
        case 'select': return selectInput(opts || [], val, set);
        case 'themes': return themesField(val, set);
        case 'list': return listField(Array.isArray(val) ? val : val ? [val] : [], set);
        default: return textInput(val, set);
      }
    };
    const wideType = t => ['photo', 'textarea', 'themes', 'list'].includes(t);
    for (const [key, label, type, help, opts] of col.fields) {
      shown.add(key);
      const e = fmEntry(doc, key);
      fields.push(field(label, help || (e && e.help) || '', control(key, type, opts), wideType(type)));
    }
    doc.entries.filter(e => e.key && !shown.has(e.key)).forEach(e => {
      const type = inferType(e.key, e.isList ? e.items : e.value);
      const f = field(humanize(e.key), e.help, control(e.key, type), wideType(type));
      ((col.advanced || []).includes(e.key) ? advanced : fields).push(f);
    });
    const box = h('section.card.details', h('div.card-head', h('h2', 'Details')), h('div.fields', fields));
    if (advanced.length) box.append(h('details.advanced', h('summary', 'Advanced'), h('div.fields', advanced)));
    return box;
  }

  // ------------------------------------------------------------------ "a | b | c" list files
  async function viewList(key) {
    const L = LISTS[key];
    if (!L) return notFound();
    loading();
    await S.ready;
    const exists = S.byPath.has(L.path);
    const text = exists ? await getText(L.path) : '';
    const ed = { orig: text, sha: exists ? S.byPath.get(L.path).sha : null };
    const parse = t => {
      const lines = t.replace(/\s+$/, '').split('\n');
      const head = []; const rows = []; const tail = [];
      lines.forEach(l => {
        const isRow = l.trim() && !l.trim().startsWith('#');
        if (isRow) rows.push(l.split('|').map(c => c.trim()));
        else (rows.length ? tail : head).push(l);
      });
      return { head, rows, tail };
    };
    let model = parse(text);
    const serialize = () => {
      const rows = model.rows.map(r => {
        const cells = L.cols.map((c, i) => oneLine(r[i] || '').replace(/\|/g, '/'));
        while (cells.length > 1 && !cells[cells.length - 1]) cells.pop();
        return cells.join(' | ');
      }).filter(r => r.replace(/[|\s]/g, ''));
      const head = model.head.slice();
      if (head.length && head[head.length - 1].trim()) head.push('');
      return head.concat(rows, model.tail).join('\n') + '\n';
    };
    // compare with the list as first read (tidied the same way), so opening a list never counts as a change
    ed.base = serialize();
    ed.isDirty = () => serialize() !== ed.base;
    ed.discard = async () => {
      if (!await confirmBox('Discard your changes?', 'The list goes back to how it was.', 'Discard changes', true)) return;
      model = parse(ed.orig); ed.base = serialize(); draw(); refreshSaveBar();
    };
    ed.save = async () => {
      const t = serialize();
      saveBarText.textContent = 'Saving…';
      try {
        await commit([{ path: L.path, text: t }], 'Update ' + L.title.toLowerCase(), ed.sha ? { [L.path]: ed.sha } : null);
        ed.orig = t; ed.sha = S.byPath.get(L.path).sha;
        model = parse(t); ed.base = serialize(); draw();
        toast('Saved ' + L.title.toLowerCase());
      } catch (e) { toast(e.message, { bad: true }); }
      saveBarText.textContent = 'You have unsaved changes';
      refreshSaveBar();
    };
    const list = h('div.rows');
    const draw = () => {
      const rows = model.rows;
      list.replaceChildren(...rows.map((r, i) => {
        const photoCol = L.cols.findIndex(c => c[2] === 'photo');
        const fieldsEls = L.cols.map((c, ci) => {
          if (c[2] === 'photo') return null;
          return field(c[1], null, textInput(r[ci] || '', v => { r[ci] = v; changedSoon(); }, { multiline: c[2] === 'textarea', rows: c[2] === 'textarea' ? 3 : 1 }), c[2] === 'textarea');
        });
        return h('div.row-card',
          photoCol >= 0 ? h('div.rc-photo', photoField(r[photoCol] || '', v => { r[photoCol] = v; changedSoon(); }, { folder: L.cols[photoCol][3] })) : null,
          h('div.rc-fields.fields', fieldsEls),
          h('div.row-tools.vertical',
            iconBtn('up', 'Move up', () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); changedSoon(); }, i === 0),
            iconBtn('down', 'Move down', () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); changedSoon(); }, i === rows.length - 1),
            iconBtn('x', 'Remove', async () => {
              if (await confirmBox('Remove this ' + L.one + '?', (r[0] || 'It') + ' will be taken off the website when you save.', 'Remove', true)) { rows.splice(i, 1); draw(); changedSoon(); }
            })));
      }));
      growAll(list);
    };
    draw();
    main.replaceChildren(page(null, L.title, L.intro,
      h('div.list-bar', h('span.muted', plural(model.rows.length, L.one)),
        h('button.btn.gold', { type: 'button', onclick: () => { model.rows.unshift(L.cols.map(() => '')); draw(); changedSoon(); const f = list.querySelector('input, textarea'); if (f) f.focus(); } }, icon('plus'), 'Add ' + L.one)),
      list));
    setEditor(ed);
  }

  // ------------------------------------------------------------------ settings.txt
  async function viewSettings() {
    const path = 'content/settings.txt';
    loading();
    await S.ready;
    const text = await getText(path);
    const ed = { orig: text, sha: S.byPath.get(path).sha };
    let lines;
    const parse = t => t.replace(/\n$/, '').split('\n').map(l => {
      const t2 = l.trim();
      if (!t2 || t2.startsWith('#') || l.indexOf(':') < 1) return { raw: l };
      const i = l.indexOf(':');
      const rawVal = l.slice(i + 1);
      return { raw: l, key: l.slice(0, i).trim(), value: unq(rawVal), quoted: isQuoted(rawVal) };
    });
    lines = parse(text);
    const serialize = () => lines.map(x => (x.key && x.dirty ? x.key + ': ' + (x.quoted ? '"' + oneLine(x.value) + '"' : oneLine(x.value)) : x.raw)).join('\n') + '\n';
    ed.isDirty = () => serialize() !== ed.orig;
    ed.discard = async () => {
      if (!await confirmBox('Discard your changes?', 'The settings go back to how they were.', 'Discard changes', true)) return;
      lines = parse(ed.orig); draw(); refreshSaveBar();
    };
    ed.save = async () => {
      const t = serialize();
      saveBarText.textContent = 'Saving…';
      try {
        await commit([{ path, text: t }], 'Update settings', { [path]: ed.sha });
        ed.orig = t; ed.sha = S.byPath.get(path).sha; lines = parse(t); draw();
        toast('Settings saved');
      } catch (e) { toast(e.message, { bad: true }); }
      saveBarText.textContent = 'You have unsaved changes';
      refreshSaveBar();
    };
    const body = h('div');
    const LABELS = { web3forms_key: 'Enquiry form key (web3forms)', tawk_chat: 'Live chat (tawk.to)', google_tag: 'Google tag (analytics)', phone_link: 'Phone (for the call link)', phone2: 'Second phone', phone2_link: 'Second phone (for the call link)', whatsapp: 'WhatsApp number', email2: 'Second email', admin_repo: 'GitHub repository', admin_branch: 'GitHub branch' };
    const draw = () => {
      // blank lines split the file into groups; a group's first note is its title
      const groups = [];
      let cur = null;
      lines.forEach(x => {
        const t = x.raw.trim();
        if (!t) { cur = null; return; }
        if (!cur) { cur = { help: [], fields: [] }; groups.push(cur); }
        if (x.key) cur.fields.push(x);
        else if (t.startsWith('#')) {
          const note = t.replace(/^#+\s?/, '');
          if (cur.fields.length) cur.fields.push({ note }); else cur.help.push(note);
        }
      });
      const named = groups.filter(g => g.fields.length);
      body.replaceChildren(...named.map((g, gi) => {
        // a short first note is the whole title; a long one is cut at its first ":" or "("
        const title = g.help[0] ? (g.help[0].length <= 48 ? g.help[0] : g.help[0].replace(/[:(].*$/, '').trim()) : gi === 0 ? 'Company' : 'More';
        const help = g.help[0] ? [g.help[0].slice(title.length).replace(/^[\s:]+/, '').replace(/^\((.*)\)$/, '$1')].concat(g.help.slice(1)).filter(Boolean).join(' ') : '';
        return h('section.card',
          h('div.card-head', h('h2', title), help ? h('p.card-help', help) : null),
          h('div.fields', g.fields.map(x => {
            if (x.note) return h('p.f-note.wide', x.note);
            const set = v => { x.value = v; x.dirty = true; changedSoon(); };
            const yesno = /^(yes|no)$/i.test(x.value);
            const ctl = yesno ? selectInput([['yes', 'Yes'], ['no', 'No']], x.value.toLowerCase(), set)
              : textInput(x.value, set, { multiline: x.value.length > 70, rows: 2 });
            return field(LABELS[x.key] || humanize(x.key), null, ctl, x.value.length > 70);
          })));
      }));
      growAll(body);
    };
    draw();
    main.replaceChildren(page(null, 'Settings', 'Contact details, social links and switches used all over the site.', body));
    setEditor(ed);
  }

  // ------------------------------------------------------------------ other text files
  async function viewFiles(path) {
    if (!path) {
      main.replaceChildren(page(null, 'Menu & addresses', 'Small text files that run parts of the site. Each starts with notes on how it works.',
        h('div.doc-list', RAW_FILES.filter(r => S.byPath.has(r[0])).map(r => h('a.doc-row', { href: '#/files/' + encodeURIComponent(r[0]) },
          h('div.dr-icon', icon('list')), h('div.dr-text', h('b', r[1]), h('small', r[2])), h('span.dr-go', 'Edit'))))));
      return;
    }
    if (!S.byPath.has(path) || !/^content\/.+\.txt$/.test(path)) return notFound();
    loading();
    const text = await getText(path);
    const info = RAW_FILES.find(r => r[0] === path) || [path, basename(path), ''];
    const ed = { orig: text, sha: S.byPath.get(path).sha, cur: text };
    const ta = h('textarea.raw.grow', { value: text, spellcheck: false });
    ta.addEventListener('input', () => { ed.cur = ta.value; autoGrow(ta); changedSoon(); });
    ed.isDirty = () => ed.cur !== ed.orig;
    ed.discard = async () => {
      if (!await confirmBox('Discard your changes?', 'The file goes back to how it was.', 'Discard changes', true)) return;
      ta.value = ed.cur = ed.orig; autoGrow(ta); refreshSaveBar();
    };
    ed.save = async () => {
      const t = ed.cur.endsWith('\n') ? ed.cur : ed.cur + '\n';
      try {
        await commit([{ path, text: t }], 'Update ' + basename(path), { [path]: ed.sha });
        ed.orig = ed.cur = t; ta.value = t; ed.sha = S.byPath.get(path).sha;
        toast('Saved ' + info[1].toLowerCase());
      } catch (e) { toast(e.message, { bad: true }); }
      refreshSaveBar();
    };
    main.replaceChildren(page(h('a', { href: '#/files' }, 'Menu & addresses'), info[1], info[2], ta));
    growAll(main);
    setEditor(ed);
  }

  function notFound() {
    main.replaceChildren(page(null, 'Not found', 'That page of the admin panel does not exist.', h('a.btn', { href: '#/' }, 'Back to the start')));
  }

  // ====================================================================== routing
  let lastHash = location.hash;
  let skipHash = false;

  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent);
    setEditor(null);
    document.querySelectorAll('.nav-link').forEach(a => {
      const r = a.getAttribute('data-route').replace(/^#\/?/, '');
      a.classList.toggle('on', r === '' ? parts[0] === '' : (parts.slice(0, r.split('/').length).join('/') === r));
    });
    window.scrollTo(0, 0);
    const [a, b, c] = parts;
    if (!a) return viewHome();
    if (a === 'photos') return viewPhotos(b);
    if (a === 'c' && c) return viewDoc(b, c).catch(showError);
    if (a === 'c') return viewCollection(b).catch(showError);
    if (a === 'list') return viewList(b).catch(showError);
    if (a === 'settings') return viewSettings().catch(showError);
    if (a === 'files') return viewFiles(parts.slice(1).join('/')).catch(showError);
    return notFound();
  }

  function showError(e) {
    console.error(e);
    main.replaceChildren(page(null, 'Something went wrong', e.message || String(e), h('button.btn', { type: 'button', onclick: () => location.reload() }, 'Reload')));
  }

  window.addEventListener('hashchange', () => {
    if (skipHash) { skipHash = false; return; }
    if (S.editor && S.editor.isDirty() && !window.confirm('You have unsaved changes. Leave without saving them?')) {
      skipHash = true;
      location.hash = lastHash;
      return;
    }
    lastHash = location.hash;
    route();
  });
  window.addEventListener('beforeunload', e => {
    if (S.editor && S.editor.isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (S.editor && S.editor.isDirty()) S.editor.save();
    }
  });

  // ====================================================================== sign in (live website only)
  function loginScreen(gh, error) {
    const inp = h('input', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off' });
    const remember = h('input', { type: 'checkbox', checked: true });
    const msg = h('p.login-error', error || '');
    const go = async () => {
      const t = inp.value.trim();
      if (!t) return;
      msg.textContent = 'Checking…';
      gh.token = t;
      try {
        await gh.api('');
        gh.setToken(t, remember.checked);
        start();
      } catch (e) { msg.textContent = e.message; }
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    app.replaceChildren(h('div.login',
      h('div.login-box',
        h('img.login-logo', { src: siteBase + '/img/logo.png', alt: 'Sunbird Lanka Tours' }),
        h('h1', 'Admin'),
        h('p', 'To save changes, the panel needs a GitHub key that may change the website’s files. You only do this once per device.'),
        h('label.field', h('span.f-label', 'GitHub key'), inp),
        h('label.check', remember, ' Remember on this device'),
        h('button.btn.gold.wide', { type: 'button', onclick: go }, 'Sign in'),
        msg,
        h('details.howto', h('summary', 'How to get a key'),
          h('ol',
            h('li', 'Sign in to GitHub and open ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'New fine-grained token'), '.'),
            h('li', 'Name it “Sunbird admin” and choose an expiry date.'),
            h('li', 'Repository access: ', h('b', 'Only select repositories'), ' → ', h('b', gh.repo.split('/')[1] || gh.repo), '.'),
            h('li', 'Permissions → Repository permissions: ', h('b', 'Contents: Read and write'), '. Also ', h('b', 'Actions: Read-only'), ' if you want to see when the site is live.'),
            h('li', 'Generate the token, copy it and paste it above.')),
          h('p.muted', 'The key stays in this browser only. Anyone who has it can change the website, so don’t share it. Sign out on shared computers.')))));
    inp.focus();
  }

  // ====================================================================== start
  async function start() {
    app.replaceChildren(h('p.boot', 'Opening the admin panel…'));
    try {
      setFiles(await S.be.tree());
    } catch (e) {
      if (S.be.mode === 'github' && (e.status === 401 || e.status === 403 || e.status === 404)) { S.be.signOut(); return loginScreen(S.be, e.message); }
      app.replaceChildren(h('div.login', h('div.login-box', h('h1', 'Could not open the files'), h('p', e.message), h('button.btn', { type: 'button', onclick: () => location.reload() }, 'Try again'))));
      return;
    }
    S.ready = preloadTexts();
    shell();
    setStatus('', S.be.mode === 'local' ? 'Ready' : 'Signed in');
    route();
  }

  async function boot() {
    let cfg = {};
    try { cfg = await (await fetch('config.json', { cache: 'no-store' })).json(); } catch (e) { /* no config */ }
    if (cfg.mode === 'local') { S.be = Local; return start(); }
    if (!cfg.repo) {
      app.replaceChildren(h('div.login', h('div.login-box', h('h1', 'Admin is not set up'),
        h('p', 'Add the line “admin_repo: owner/repository” to content/settings.txt, or open the panel on your computer with python admin.py.'))));
      return;
    }
    S.be = makeGitHub(cfg);
    if (!S.be.token) return loginScreen(S.be);
    return start();
  }

  boot();
})();
