// Generates the hero's topographic map: a seeded height field with a summit
// under each project "station", traced into contour lines with marching squares.
(() => {
  const SEED = 1987;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('terrain');
  if (!svg) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Station layouts as fractions of the sheet: [x, y, height, spread, id, label]
  const STATIONS_WIDE = [
    [0.66, 0.30, 1.00, 0.17, 'fred', 'Fred', '01'],
    [0.83, 0.19, 0.62, 0.10, 'side-quests', 'Side Quests', '02'],
    [0.45, 0.14, 0.55, 0.09, '4eyez', '4eyez', '03'],
  ];
  const STATIONS_NARROW = [
    [0.60, 0.20, 1.00, 0.30, 'fred', 'Fred', '01'],
    [0.24, 0.09, 0.60, 0.20, 'side-quests', 'Side Quests', '02'],
    [0.30, 0.34, 0.50, 0.18, '4eyez', '4eyez', '03'],
  ];

  // ── seeded value noise ──
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const rand = mulberry32(SEED);
  const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rand(); }
  for (let i = P - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[i + P] = perm[i];
  const fade = t => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const v = (a, b) => vals[perm[perm[a] + b]];
    const u = fade(xf), w = fade(yf);
    const a = v(X, Y), b = v(X + 1, Y), c = v(X, Y + 1), d = v(X + 1, Y + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(x, y) {
    let s = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 4; o++) { s += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s;
  }

  function build() {
    const W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H) return;
    const narrow = W < 720;
    const stations = narrow ? STATIONS_NARROW : STATIONS_WIDE;
    const cell = narrow ? 8 : 10;
    const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
    const base = Math.min(W, H * 1.6);

    // height field
    const h = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cell, y = j * cell;
      let z = fbm(x / 380 + 3.1, y / 380 + 7.7) * 0.45;
      // a long ridge running under the stations, falling away toward the title
      z += 0.18 * Math.exp(-(((y / H) - 0.25 - 0.1 * (x / W)) ** 2) / 0.05);
      for (const [sx, sy, sh, sp] of stations) {
        const dx = x - sx * W, dy = y - sy * H, r = sp * base;
        z += sh * 0.8 * Math.exp(-(dx * dx + dy * dy) / (2 * r * r));
      }
      h[j * cols + i] = z;
    }

    const levels = [];
    for (let l = 0.14; l < 1.5; l += 0.048) levels.push(l);

    const frag = document.createDocumentFragment();
    const g = document.createElementNS(NS, 'g');
    frag.appendChild(g);

    levels.forEach((lv, li) => {
      for (const pts of trace(h, cols, rows, cell, lv)) {
        if (pts.length < 6) continue;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', smooth(pts));
        p.setAttribute('class', li % 5 === 0 ? 'c c--index' : 'c');
        p.dataset.level = li;
        g.appendChild(p);
      }
    });

    // stations
    const sg = document.createElementNS(NS, 'g');
    for (const [sx, sy, , , id, label, code] of stations) {
      const x = sx * W, y = sy * H;
      const a = document.createElementNS(NS, 'a');
      a.setAttribute('href', '#' + id);
      a.setAttribute('aria-label', `Station ${code}: ${label}`);
      a.setAttribute('class', 'stn');
      a.innerHTML =
        `<circle class="stn-ring" cx="${x}" cy="${y}" r="15"/>` +
        `<path class="stn-tri" d="M${x} ${y - 6}l6 10h-12z"/>` +
        `<text class="stn-label" x="${x + 22}" y="${y + 2}">${label}</text>` +
        `<text class="stn-code" x="${x + 22}" y="${y + 18}">STA ${code}</text>`;
      sg.appendChild(a);
    }
    frag.appendChild(sg);

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    built = [W, H];
    svg.replaceChildren(frag);
    return { paths: g.querySelectorAll('path'), stations: sg };
  }

  // Marching squares, joining segments into continuous polylines.
  function trace(h, cols, rows, cell, lv) {
    const pt = new Map();   // edge key -> [x, y]
    const adj = new Map();  // edge key -> [neighbour keys]
    const link = (a, b) => {
      (adj.get(a) || adj.set(a, []).get(a)).push(b);
      (adj.get(b) || adj.set(b, []).get(b)).push(a);
    };
    const edge = (i, j, side, v0, v1, x0, y0, x1, y1) => {
      const key = side + (j * cols + i);
      if (!pt.has(key)) { const t = (lv - v0) / (v1 - v0); pt.set(key, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
      return key;
    };
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = h[j * cols + i], b = h[j * cols + i + 1], c = h[(j + 1) * cols + i + 1], d = h[(j + 1) * cols + i];
      const idx = (a > lv) | (b > lv) << 1 | (c > lv) << 2 | (d > lv) << 3;
      if (idx === 0 || idx === 15) continue;
      const x = i * cell, y = j * cell;
      const T = () => edge(i, j, 'h', a, b, x, y, x + cell, y);
      const R = () => edge(i + 1, j, 'v', b, c, x + cell, y, x + cell, y + cell);
      const B = () => edge(i, j + 1, 'h', d, c, x, y + cell, x + cell, y + cell);
      const L = () => edge(i, j, 'v', a, d, x, y, x, y + cell);
      switch (idx) {
        case 1: case 14: link(L(), T()); break;
        case 2: case 13: link(T(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(R(), B()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), B()); break;
        case 5: link(L(), T()); link(R(), B()); break;
        case 10: link(T(), R()); link(B(), L()); break;
      }
    }
    const seen = new Set(), lines = [];
    const walk = start => {
      const out = [start]; seen.add(start);
      let cur = start;
      for (;;) {
        const next = (adj.get(cur) || []).find(k => !seen.has(k));
        if (!next) break;
        seen.add(next); out.push(next); cur = next;
      }
      return out;
    };
    // open chains first (start at ends), then closed loops
    for (const [k, n] of adj) if (n.length === 1 && !seen.has(k)) lines.push(walk(k).map(q => pt.get(q)));
    for (const k of adj.keys()) if (!seen.has(k)) { const l = walk(k).map(q => pt.get(q)); l.push(l[0]); lines.push(l); }
    return lines;
  }

  // Quadratic smoothing through midpoints.
  function smooth(p) {
    const f = n => n.toFixed(1);
    let d = `M${f(p[0][0])} ${f(p[0][1])}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(mx)} ${f(my)}`;
    }
    const l = p[p.length - 1];
    return d + `L${f(l[0])} ${f(l[1])}`;
  }

  function animate(res) {
    if (!res || reduceMotion) return;
    res.paths.forEach(p => {
      const len = Math.ceil(p.getTotalLength());
      p.style.setProperty('--len', len);
      p.style.setProperty('--d', (Number(p.dataset.level) * 0.06).toFixed(2) + 's');
      p.classList.add('draw');
    });
    res.stations.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, delay: 1300, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
  }

  let built = [0, 0], t;
  const start = () => animate(build());
  // wait for web fonts so the sheet's height is final before measuring
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);

  // rebuild when the sheet changes size meaningfully (ignores mobile URL-bar jitter)
  new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      const [w, h] = built;
      if (Math.abs(svg.clientWidth - w) > 40 || Math.abs(svg.clientHeight - h) > 120) build();
    }, 150);
  }).observe(svg);

  // Day / night sheet toggle
  const btn = document.querySelector('.theme-toggle');
  btn?.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });
})();
