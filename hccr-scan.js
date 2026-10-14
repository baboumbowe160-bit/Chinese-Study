/* Page scanner: finds the handwritten characters on a photo of a notebook / practice sheet.
   1. ink = pen marks darker than the paper around them (shadows and coloured lines ignored)
   2. straighten the page (ruled lines horizontal), remove ruled lines and margins
   3. join pen strokes into character-sized groups, and groups into rows
   4. for each row, list the possible characters (single groups or 2–4 neighbouring groups, e.g. 又+寸 = 对)
   CSScan.analyse(canvas) → page ; CSScan.candidates(row, T) ; CSScan.input(page, cand) → Float32Array(96*96) */
(function () {
  "use strict";
  const TT = 40;   // working size of a character in pixels

  /* ---------- small image helpers ---------- */
  function grayOf(img) {
    const { width: W, height: H, data } = img, g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = (data[4 * i] + data[4 * i + 1] + data[4 * i + 2]) / 3;
    return g;
  }
  function maxFilter(a, W, H, r) {           // square max filter, radius r
    const t = new Float32Array(W * H), o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = -1e9; const x0 = Math.max(0, x - r), x1 = Math.min(W - 1, x + r); for (let k = x0; k <= x1; k++) { const v = a[y * W + k]; if (v > m) m = v; } t[y * W + x] = m; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let m = -1e9; const y0 = Math.max(0, y - r), y1 = Math.min(H - 1, y + r); for (let k = y0; k <= y1; k++) { const v = t[k * W + x]; if (v > m) m = v; } o[y * W + x] = m; }
    return o;
  }
  function gaussBlur(a, W, H, k) {
    const sig = 0.3 * ((k - 1) * 0.5 - 1) + 0.8, r = (k - 1) >> 1, ker = new Float32Array(k);
    let s = 0; for (let i = 0; i < k; i++) { ker[i] = Math.exp(-((i - r) ** 2) / (2 * sig * sig)); s += ker[i]; } for (let i = 0; i < k; i++) ker[i] /= s;
    const t = new Float32Array(W * H), o = new Float32Array(W * H);
    const rf = (i, n) => i < 0 ? -i - 1 + 0 : i >= n ? 2 * n - i - 1 : i;  // reflect
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = 0; i < k; i++) v += ker[i] * a[y * W + Math.min(W - 1, Math.max(0, rf(x + i - r, W)))]; t[y * W + x] = v; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let v = 0; for (let i = 0; i < k; i++) v += ker[i] * t[Math.min(H - 1, Math.max(0, rf(y + i - r, H))) * W + x]; o[y * W + x] = v; }
    return o;
  }
  // binary morphology with rectangular kernels (kh rows × kw cols), via running counts
  function erode(m, W, H, kh, kw) {
    let a = m;
    if (kw > 1) { const o = new Uint8Array(W * H), r0 = (kw - 1) >> 1, r1 = kw - 1 - r0;
      for (let y = 0; y < H; y++) { const b = y * W; for (let x = 0; x < W; x++) { let ok = 1; for (let k = x - r0; k <= x + r1; k++) { if (k < 0 || k >= W) continue; if (!a[b + k]) { ok = 0; break; } } o[b + x] = ok; } } a = o; }
    if (kh > 1) { const o = new Uint8Array(W * H), r0 = (kh - 1) >> 1, r1 = kh - 1 - r0;
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let ok = 1; for (let k = y - r0; k <= y + r1; k++) { if (k < 0 || k >= H) continue; if (!a[k * W + x]) { ok = 0; break; } } o[y * W + x] = ok; } a = o; }
    return a === m ? Uint8Array.from(m) : a;
  }
  function dilate(m, W, H, kh, kw) {
    let a = m;
    if (kw > 1) { const o = new Uint8Array(W * H), r0 = (kw - 1) >> 1, r1 = kw - 1 - r0;
      for (let y = 0; y < H; y++) { const b = y * W; let last = -1e9; for (let x = 0; x < W + r0; x++) { if (x < W && a[b + x]) last = x; const ox = x - r0; if (ox >= 0 && ox < W && last >= ox - r1) o[b + ox] = 1; } } a = o; }
    if (kh > 1) { const o = new Uint8Array(W * H), r0 = (kh - 1) >> 1, r1 = kh - 1 - r0;
      for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H + r0; y++) { if (y < H && a[y * W + x]) last = y; const oy = y - r0; if (oy >= 0 && oy < H && last >= oy - r1) o[oy * W + x] = 1; } } a = o; }
    return a === m ? Uint8Array.from(m) : a;
  }
  // fast erosion for long line kernels: run lengths
  function openLine(m, W, H, L, horizontal) {
    const o = new Uint8Array(W * H);
    if (horizontal) {
      for (let y = 0; y < H; y++) { const b = y * W; let s = -1; for (let x = 0; x <= W; x++) { const on = x < W && m[b + x]; if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s >= L) o.fill(1, b + s, b + x); s = -1; } } }
    } else {
      for (let x = 0; x < W; x++) { let s = -1; for (let y = 0; y <= H; y++) { const on = y < H && m[y * W + x]; if (on && s < 0) s = y; if (!on && s >= 0) { if (y - s >= L) for (let k = s; k < y; k++) o[k * W + x] = 1; s = -1; } } }
    }
    return o;
  }
  function percentile(arr, p) { if (!arr.length) return 0; const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p / 100 * (s.length - 1))))]; }
  function median(arr) { return percentile(arr, 50); }

  /* ---------- 1. ink ---------- */
  function ink(img) {
    const { width: W, height: H, data } = img, n = W * H;
    const g = grayOf(img);
    let k = Math.max(15, (Math.floor(Math.min(H, W) / 20)) | 1);
    const bg = gaussBlur(maxFilter(g, W, H, ((k >> 1) | 1) >> 1), W, H, k);
    const dark = new Float32Array(n), cand = [];
    for (let i = 0; i < n; i++) {
      let d = (bg[i] - g[i]) / Math.max(bg[i], 1); if (d < 0) d = 0; if (d > 1) d = 1;
      const r = data[4 * i], gg = data[4 * i + 1], b = data[4 * i + 2];
      if (r - Math.max(gg, b) > 30) d = 0;                       // red margin / red pen
      dark[i] = d; if (d > 0.12) cand.push(d);
    }
    const lev = cand.length > 50 ? percentile(cand, 90) : 0.5;
    const st = Math.max(0.2, lev * 0.6), wk = Math.max(0.12, lev * 0.33);
    const strong = new Uint8Array(n); for (let i = 0; i < n; i++) strong[i] = dark[i] > st ? 1 : 0;
    const sd = dilate(strong, W, H, 3, 3), m = new Uint8Array(n);
    for (let i = 0; i < n; i++) m[i] = sd[i] && dark[i] > wk ? 1 : 0;
    return { m, dark };
  }

  /* ---------- 2. straighten ---------- */
  function skewAngle(m, W, H) {
    const pts = []; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (m[y * W + x]) pts.push(x, y);
    let best = -1, ba = 0;
    const NB = Math.ceil(Math.hypot(W, H) / 2) + 4, prof = new Float32Array(NB);
    for (let a = -10; a <= 10.001; a += 0.5) {
      const r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r); prof.fill(0);
      for (let i = 0; i < pts.length; i += 2) { const yy = ((-sn * (pts[i] - W / 2) + cs * (pts[i + 1] - H / 2)) / 2 + NB / 2) | 0; if (yy >= 0 && yy < NB) prof[yy]++; }
      let v = 0; for (let i = 1; i < NB; i++) v += (prof[i] - prof[i - 1]) ** 2;
      if (v > best) { best = v; ba = a; }
    }
    return ba;
  }
  function drawRotated(srcCanvas, a, scale) {
    const W = srcCanvas.width, H = srcCanvas.height;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
    const x = c.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    const r = a * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    // p' = R(p - centre) + centre, with R = [[cos, sin], [-sin, cos]] (same as OpenCV getRotationMatrix2D), then scaled
    x.setTransform(cs * scale, -sn * scale, sn * scale, cs * scale, scale * ((1 - cs) * W / 2 - sn * H / 2), scale * (sn * W / 2 + (1 - cs) * H / 2));
    x.drawImage(srcCanvas, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  /* ---------- 3. ruled lines ---------- */
  function vrun(m, W, H) {
    const up = new Int32Array(W * H), out = new Int32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; up[i] = m[i] ? (y ? up[i - W] : 0) + 1 : 0; }
    for (let x = 0; x < W; x++) { let dn = 0; for (let y = H - 1; y >= 0; y--) { const i = y * W + x; dn = m[i] ? dn + 1 : 0; out[i] = m[i] ? up[i] + dn - 1 : 0; } }
    return out;
  }
  function removeLines(m, W, H, T) {
    const L = Math.max(9, Math.floor(2 * T));
    const hl = openLine(dilate(m, W, H, 5, 1), W, H, L, true), vl = openLine(dilate(m, W, H, 1, 5), W, H, L, false);
    const k = Math.max(3, Math.floor(T * 0.2));
    const vert = dilate(erode(m, W, H, k, 1), W, H, k, 1), horz = dilate(erode(m, W, H, 1, k), W, H, 1, k);
    const n = W * H, m2 = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (!m[i]) continue; const line = hl[i] || vl[i]; m2[i] = !line || (hl[i] && vert[i]) || (vl[i] && horz[i]) ? 1 : 0; }
    // faint or dashed ruled lines: rows where thin pen marks fill most of a strip
    const vr = vrun(m2, W, H), lim = Math.max(3, Math.floor(0.12 * T)), sw = Math.max(20, Math.floor(3 * T));
    const kill = new Uint8Array(n);
    for (let x0 = 0; x0 < W; x0 += sw >> 1) {
      const x1 = Math.min(W, x0 + sw);
      for (let y = 0; y < H; y++) {
        let c = 0; for (let x = x0; x < x1; x++) { const i = y * W + x; if (m2[i] && vr[i] <= lim) c++; }
        if (c > 0.45 * (x1 - x0)) for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++) for (let x = x0; x < x1; x++) { const i = yy * W + x; if (m2[i] && vr[i] <= lim) kill[i] = 1; }
      }
    }
    for (let i = 0; i < n; i++) if (kill[i]) m2[i] = 0;
    return m2;
  }

  /* ---------- 4. connected pieces ---------- */
  function components(m, W, H) {
    const lab = new Int32Array(W * H), st = [null]; const q = new Int32Array(W * H);
    let k = 0;
    for (let s = 0; s < W * H; s++) {
      if (!m[s] || lab[s]) continue;
      k++; let qh = 0, qt = 0; q[qt++] = s; lab[s] = k;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, a = 0;
      while (qh < qt) {
        const i = q[qh++], x = i % W, y = (i - x) / W; a++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (m[j] && !lab[j]) { lab[j] = k; q[qt++] = j; } } }
      }
      st.push({ id: k, x0, y0, x1: x1 + 1, y1: y1 + 1, a });
    }
    return { lab, st };
  }
  function estimateT(m, W, H) {
    const { st } = components(m, W, H); const s = [];
    for (let i = 1; i < st.length; i++) { const c = st[i], w = c.x1 - c.x0, h = c.y1 - c.y0, mx = Math.max(w, h); if (c.a >= 8 && mx <= 4 * Math.min(w, h) + 2) s.push(mx); }
    if (s.length < 5) return 20;
    const p60 = percentile(s, 60); return median(s.filter(v => v >= p60));
  }

  // join pieces into character-sized groups (closest pairs first)
  function cluster(boxes, T, lim) {
    lim = lim || 1.3;
    let cl = boxes.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, ids: [b.id] }));
    for (let it = 0; it < 200 && cl.length > 1; it++) {
      const n = cl.length, bj = new Int32Array(n).fill(-1), bc = new Float64Array(n).fill(1e9);
      // sort by x for pruning
      const order = cl.map((c, i) => i).sort((a, b) => cl[a].x0 - cl[b].x0);
      for (let ii = 0; ii < n; ii++) {
        const a = cl[order[ii]];
        for (let jj = ii + 1; jj < n; jj++) {
          const b = cl[order[jj]];
          if (b.x0 - a.x1 >= 0.3 * T && b.x0 - a.x0 > lim * T) break;
          const uw = Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0), uh = Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0);
          if (uw > lim * T || uh > lim * T) continue;
          const gx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1), gy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1);
          if (gx >= 0.3 * T || gy >= 0.3 * T) continue;
          const cost = Math.max(uw, uh) + 0.5 * (gx + gy);
          const i = order[ii], j = order[jj];
          if (cost < bc[i]) { bc[i] = cost; bj[i] = j; }
          if (cost < bc[j]) { bc[j] = cost; bj[j] = i; }
        }
      }
      const merged = new Uint8Array(n), add = [];
      const idx = [...Array(n).keys()].filter(i => bj[i] >= 0).sort((a, b) => bc[a] - bc[b]);
      for (const i of idx) {
        const j = bj[i]; if (merged[i] || merged[j]) continue;
        if (bj[j] !== i && bc[j] < bc[i] - 1e-6) continue;
        const a = cl[i], b = cl[j];
        add.push({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), ids: a.ids.concat(b.ids) });
        merged[i] = merged[j] = 1;
      }
      if (!add.length) break;
      cl = cl.filter((c, i) => !merged[i]).concat(add);
    }
    return cl;
  }
  function makeRows(cl, T) {
    cl = cl.slice().sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
    const rows = [];
    for (const c of cl) {
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      let best = null, bd = 0.45 * T;
      for (const r of rows) {
        let near = null, nd = 1e9; for (const d of r) { const dd = Math.abs((d.x0 + d.x1) / 2 - cx); if (dd < nd) { nd = dd; near = d; } }
        const d = Math.abs((near.y0 + near.y1) / 2 - cy) + 0.02 * Math.max(0, nd - 2 * T);
        if (d < bd) { best = r; bd = d; }
      }
      if (best) best.push(c); else rows.push([c]);
    }
    // pieces of one line that ended up in separate rows (a character written a bit higher or lower)
    const mcy = r => median(r.map(c => (c.y0 + c.y1) / 2));
    for (let changed = true; changed;) {
      changed = false; rows.sort((a, b) => mcy(a) - mcy(b));
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i], b = rows[i + 1];
        if (Math.abs(mcy(a) - mcy(b)) >= 0.5 * T) continue;
        let ov = 0; for (const p of a) for (const q of b) if (Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 0.5 * Math.min(p.x1 - p.x0, q.x1 - q.x0)) ov++;
        if (ov <= 0.25 * Math.min(a.length, b.length)) { rows[i] = a.concat(b); rows.splice(i + 1, 1); changed = true; break; }
      }
    }
    rows.forEach(r => r.sort((a, b) => a.x0 - b.x0));
    return rows;
  }

  /* ---------- analyse a photo ---------- */
  function analyse(photo) {
    // photo: canvas (any size). Work on ≤1400 px first to measure the writing.
    const s0 = Math.min(1, 1400 / Math.max(photo.width, photo.height));
    let small = drawRotated(photo, 0, s0);
    let img = small.getContext("2d").getImageData(0, 0, small.width, small.height);
    let { m } = ink(img);
    const ang = skewAngle(m, small.width, small.height);
    if (Math.abs(ang) > 0.2) { small = drawRotated(photo, ang, s0); img = small.getContext("2d").getImageData(0, 0, small.width, small.height); m = ink(img).m; }
    const T0 = estimateT(m, small.width, small.height);
    const T1 = estimateT(removeLines(m, small.width, small.height, T0), small.width, small.height);
    const s = Math.min(3, Math.max(0.3, TT / Math.max(T1, 4)));
    const work = drawRotated(photo, ang, s0 * s);
    const W = work.width, H = work.height;
    const wimg = work.getContext("2d").getImageData(0, 0, W, H);
    const m0 = ink(wimg).m;
    let T = TT, mc, lab, cl = [];
    for (let it = 0; it < 3; it++) {
      mc = removeLines(m0, W, H, T);
      const C = components(mc, W, H); lab = C.lab;
      const boxes = [];
      for (let i = 1; i < C.st.length; i++) {
        const c = C.st[i], w = c.x1 - c.x0, h = c.y1 - c.y0;
        if (c.a < Math.max(5, T * T * 0.004)) continue;
        if ((w > 1.5 * T && h < 0.25 * w) || (h > 1.5 * T && w < 0.25 * h)) continue;   // leftover line pieces
        boxes.push(c);
      }
      cl = cluster(boxes, T);
      const good = cl.map(c => Math.max(c.x1 - c.x0, c.y1 - c.y0)).filter(v => v > 0.6 * T);
      if (good.length < 5) break;
      const nT = Math.min(1.15 * TT, Math.max(0.85 * TT, median(good))); if (Math.abs(nT - T) < 0.05 * T) break; T = nT;
    }
    cl = cl.filter(c => Math.max(c.x1 - c.x0, c.y1 - c.y0) >= 0.3 * T);
    const rows = makeRows(cl, T);
    return { work, img: wimg, W, H, lab, T, rows, angle: ang, scale: s0 * s, s0 };
  }

  /* ---------- candidate characters in a row ---------- */
  function candidates(row, T, maxw, maxn) {
    maxw = maxw || 2.4; maxn = maxn || 4;
    const out = [], n = row.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j <= Math.min(n, i + maxn); j++) {
      const seg = row.slice(i, j);
      const x0 = Math.min(...seg.map(a => a.x0)), x1 = Math.max(...seg.map(a => a.x1));
      if (j - i > 1 && x1 - x0 > maxw * T) break;
      if (j - i > 1 && seg[seg.length - 1].x0 - Math.max(...seg.slice(0, -1).map(a => a.x1)) > 0.6 * T) break;
      const y0 = Math.min(...seg.map(a => a.y0)), y1 = Math.max(...seg.map(a => a.y1));
      out.push({ i, j, x0, y0, x1, y1, ids: seg.flatMap(a => a.ids) });
    }
    return out;
  }

  /* ---------- network input for one candidate (96×96, ink bright) ---------- */
  function otsu(vals) {
    const h = new Float64Array(256); for (const v of vals) h[Math.max(0, Math.min(255, v | 0))]++;
    let tot = vals.length, sumAll = 0; for (let i = 0; i < 256; i++) sumAll += i * h[i];
    let wb = 0, sb = 0, best = 0, t = 0;
    for (let i = 0; i < 256; i++) { wb += h[i]; if (!wb) continue; const wf = tot - wb; if (!wf) break; sb += i * h[i]; const mb = sb / wb, mf = (sumAll - sb) / wf, v = wb * wf * (mb - mf) ** 2; if (v > best) { best = v; t = i; } }
    return t;
  }
  function resample(src, sw, sh, ow, oh) {    // area-average when shrinking, bilinear when enlarging
    function axis(a, w, h, n, horiz) {
      const nin = horiz ? w : h; if (nin === n) return a;
      const ow2 = horiz ? n : w, oh2 = horiz ? h : n, o = new Float64Array(ow2 * oh2), sc = nin / n;
      const get = (p, q) => horiz ? a[q * w + p] : a[p * w + q];   // p along axis, q across
      const across = horiz ? h : w;
      for (let i = 0; i < n; i++) {
        let ks = [], ws = [];
        if (sc > 1) { const s0 = i * sc, s1 = (i + 1) * sc; for (let k = Math.floor(s0); k < Math.min(nin, Math.ceil(s1)); k++) { const wv = Math.min(s1, k + 1) - Math.max(s0, k); if (wv > 0) { ks.push(k); ws.push(wv); } } }
        else { const s = (i + 0.5) * sc - 0.5, k = Math.floor(s), f = s - k; ks = [Math.min(Math.max(k, 0), nin - 1), Math.min(Math.max(k + 1, 0), nin - 1)]; ws = [1 - f, f]; }
        const wsum = ws.reduce((p, q) => p + q, 0);
        for (let q = 0; q < across; q++) { let v = 0; for (let t = 0; t < ks.length; t++) v += get(ks[t], q) * ws[t]; v /= wsum; if (horiz) o[q * ow2 + i] = v; else o[i * ow2 + q] = v; }
      }
      return o;
    }
    const a = axis(src, sw, sh, oh, false);            // rows first (matches the Python version)
    return axis(a, sw, oh, ow, true);
  }
  function input(page, c, pad) {
    pad = pad == null ? 2 : pad;
    const { img, lab, W } = page, data = img.data;
    const X0 = Math.max(0, c.x0 - pad), Y0 = Math.max(0, c.y0 - pad), X1 = Math.min(page.W, c.x1 + pad), Y1 = Math.min(page.H, c.y1 + pad);
    const w = X1 - X0, h = Y1 - Y0, n = w * h, ids = new Set(c.ids);
    const G = new Float64Array(n), Mk = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (Y0 + y) * W + X0 + x, k = y * w + x;
      G[k] = data[4 * i] * 0.299 + data[4 * i + 1] * 0.587 + data[4 * i + 2] * 0.114;
      Mk[k] = ids.has(lab[i]) ? 1 : 0;
    }
    const Md = dilate(Mk, w, h, 3, 3);
    const outside = [], inside = []; let mx0 = 1e9, my0 = 1e9, mx1 = -1, my1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (!Md[k]) outside.push(G[k]); if (Mk[k]) { inside.push(G[k]); if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y; } }
    if (!inside.length) return null;
    const bg = outside.length > 20 ? median(outside) : percentile(Array.from(G), 95), lo = percentile(inside, 5);
    const N = new Float64Array(n), mdv = [];
    for (let k = 0; k < n; k++) { let v = (G[k] - lo) / Math.max(bg - lo, 1); v = v < 0 ? 0 : v > 1 ? 1 : v; N[k] = Md[k] ? v * 255 : 255; if (Md[k]) mdv.push(N[k]); }
    const t = otsu(mdv);
    for (let k = 0; k < n; k++) if (N[k] > t) N[k] = 255;
    const cw = mx1 - mx0 + 1, ch = my1 - my0 + 1, L = Math.max(cw, ch);
    const sq = new Float64Array(L * L).fill(255), oy = (L - ch) >> 1, ox = (L - cw) >> 1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) sq[(oy + y) * L + ox + x] = N[(my0 + y) * w + mx0 + x];
    const r = resample(sq, L, L, 88, 88), out = new Float32Array(96 * 96);
    for (let y = 0; y < 88; y++) for (let x = 0; x < 88; x++) out[(y + 4) * 96 + x + 4] = (255 - r[y * 88 + x]) * 0.8;   // 80 % ink strength reads clean pen strokes much better
    return out;
  }

  window.CSScan = { analyse, candidates, input, TT };
})();
