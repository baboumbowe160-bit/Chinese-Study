/* Handwriting photo checker – runs fully on the phone, no internet needed.
   1. find the ink in the photo (ignores paper, shadows and coloured grid lines)
   2. thin the ink to centre lines (skeleton)
   3. compare with the real stroke centre lines of every character the app knows
   4. score the shape and say which character it reads as, and where it differs   */
(function () {
  "use strict";
  const N = 96, PAD = 8; let TOL = 0.15 * N;

  /* ---------- 1. ink ---------- */
  function inkMask(img) {
    const { width: W, height: H, data } = img, n = W * H;
    const lum = new Float32Array(n), skip = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[4 * i], g = data[4 * i + 1], b = data[4 * i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b; lum[i] = l;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      // coloured grid lines / printed boxes (red, pink, green, light blue) are not ink
      if (mx - mn > 55 && l > 85) skip[i] = 1;
    }
    // paper brightness = 90th percentile
    const sorted = Float32Array.from(lum).sort();
    const paper = sorted[Math.floor(n * 0.9)];
    // integral image for local mean (handles shadows across the photo)
    const S = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += lum[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const r = Math.max(6, Math.round(Math.min(W, H) / 7)), m = new Uint8Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (skip[i]) continue;
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      const mean = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      if (lum[i] < mean * 0.86 && lum[i] < paper - 35) m[i] = 1;
    }
    // remove long thin printed lines (ruled lines, box edges) that cross the whole crop
    for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) c += m[y * W + x]; if (c > 0.85 * W) for (let x = 0; x < W; x++) { const up = y > 2 && m[(y - 3) * W + x], dn = y < H - 3 && m[(y + 3) * W + x]; if (!(up && dn)) m[y * W + x] = 0; } }
    for (let x = 0; x < W; x++) { let c = 0; for (let y = 0; y < H; y++) c += m[y * W + x]; if (c > 0.85 * H) for (let y = 0; y < H; y++) { const l = x > 2 && m[y * W + x - 3], rr = x < W - 3 && m[y * W + x + 3]; if (!(l && rr)) m[y * W + x] = 0; } }
    return dropSpecks(m, W, H);
  }
  function dropSpecks(m, W, H) {
    const lab = new Int32Array(W * H), sizes = [0], q = [];
    let k = 0;
    for (let s = 0; s < W * H; s++) {
      if (!m[s] || lab[s]) continue;
      k++; let size = 0; q.length = 0; q.push(s); lab[s] = k;
      while (q.length) {
        const i = q.pop(); size++; const x = i % W, y = (i - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (m[j] && !lab[j]) { lab[j] = k; q.push(j); }
        }
      }
      sizes.push(size);
    }
    const big = Math.max(0, ...sizes), min = Math.min(40, big * 0.04) + W * H * 0.0004;
    for (let i = 0; i < W * H; i++) if (lab[i] && sizes[lab[i]] < min) m[i] = 0;
    return m;
  }

  /* ---------- 2. skeleton (Zhang–Suen thinning) ---------- */
  function thin(m, W, H) {
    const a = Uint8Array.from(m); let changed = true; const del = [];
    const P = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : a[y * W + x];
    for (let it = 0; changed && it < 60; it++) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        del.length = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (!a[y * W + x]) continue;
          const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; let A = 0; for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) A++;
          if (A !== 1) continue;
          if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          del.push(y * W + x);
        }
        if (del.length) { changed = true; del.forEach(i => (a[i] = 0)); }
      }
    }
    return a;
  }

  /* ---------- 3. normalise point sets into an N×N box ---------- */
  // pts: [x, y, angle]; angle in radians (direction of the stroke at that point)
  const NB = 4;
  const bin = a => { let t = a % Math.PI; if (t < 0) t += Math.PI; return Math.round(t / (Math.PI / NB)) % NB; };
  function normalise(pts) {
    // moment normalisation: centre of mass in the middle, spread scaled to a fixed size
    let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length; cy /= pts.length;
    let vx = 0, vy = 0; for (const [x, y] of pts) { vx += (x - cx) ** 2; vy += (y - cy) ** 2; }
    let sx = Math.sqrt(vx / pts.length) || 1, sy = Math.sqrt(vy / pts.length) || 1;
    const MODE = 2;
    if (MODE === 1) { const s0 = Math.max(sx, sy); sx = Math.max(sx, s0 * 0.45); sy = Math.max(sy, s0 * 0.45); const k = Math.sqrt(sx * sy); sx = sy = k; }
    else if (MODE === 2) { sx = Math.max(sx, sy * 0.3); sy = Math.max(sy, sx * 0.3); }
    const w = sx, h = sy, T = N / 5.2;
    const g = new Uint8Array(N * N), gb = Array.from({ length: NB }, () => new Uint8Array(N * N)), out = [], ob = [];
    for (const [x, y, a] of pts) {
      const gx = Math.round(N / 2 + (x - cx) / sx * T), gy = Math.round(N / 2 + (y - cy) / sy * T);
      if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
      const i = gy * N + gx, b = bin(a);
      if (!gb[b][i]) { gb[b][i] = 1; if (!g[i]) { g[i] = 1; } out.push(i); ob.push(b); }
    }
    return { grid: g, idx: out, ob, gb, aspect: w / Math.max(h, 1e-6) };
  }
  function prep(r) { r.dt = distance(r.grid); r.dtb = r.gb.map(distance); return r; }
  // distance from a point with direction b to the nearest point of the other shape going the same way
  const dirDist = (o, i, b) => Math.min(o.dtb[b][i], o.dtb[(b + 1) % NB][i] + 3, o.dtb[(b + NB - 1) % NB][i] + 3, o.dt[i] + 7);
  // reference: stroke centre lines (medians) from the stroke data, y flipped as Hanzi Writer does
  const modelCache = new Map();
  function model(c, d) {
    if (modelCache.has(c)) return modelCache.get(c);
    const pts = [];
    (d.medians || []).forEach(line => {
      for (let i = 0; i < line.length; i++) {
        const [xa, ya] = line[i];
        if (i + 1 < line.length) { const [xb, yb] = line[i + 1]; const a = Math.atan2(yb - ya, xb - xa); const L = Math.hypot(xb - xa, yb - ya), k = Math.max(1, Math.ceil(L / 4)); for (let j = 0; j < k; j++) pts.push([xa + (xb - xa) * j / k, 900 - (ya + (yb - ya) * j / k), a]); }
        else if (line.length > 1) { const [xp, yp] = line[i - 1]; pts.push([xa, 900 - ya, Math.atan2(ya - yp, xa - xp)]); }
      }
    });
    const r = pts.length ? normalise(pts) : null;
    if (r) { prep(r); r.strokes = (d.medians || []).length; }
    modelCache.set(c, r); return r;
  }
  function distance(g) {
    const D = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) D[i] = g[i] ? 0 : 1e6;
    const d1 = 1, d2 = 1.414;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + d1);
      if (y > 0) { v = Math.min(v, D[i - N] + d1); if (x > 0) v = Math.min(v, D[i - N - 1] + d2); if (x < N - 1) v = Math.min(v, D[i - N + 1] + d2); }
      D[i] = v;
    }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x; let v = D[i];
      if (x < N - 1) v = Math.min(v, D[i + 1] + d1);
      if (y < N - 1) { v = Math.min(v, D[i + N] + d1); if (x < N - 1) v = Math.min(v, D[i + N + 1] + d2); if (x > 0) v = Math.min(v, D[i + N - 1] + d2); }
      D[i] = v;
    }
    return D;
  }
  function compare(u, m) {
    let p = 0, r = 0;
    u.idx.forEach((i, k) => { p += Math.max(0, 1 - dirDist(m, i, u.ob[k]) / TOL); });
    m.idx.forEach((i, k) => { r += Math.max(0, 1 - dirDist(u, i, m.ob[k]) / TOL); });
    p /= u.idx.length; r /= m.idx.length;
    // very different overall shape (e.g. tall vs flat) costs a little
    const ar = Math.abs(Math.log((u.aspect + 0.05) / (m.aspect + 0.05)));
    const f = p + r ? 2 * p * r / (p + r) : 0;
    return { p, r, f: f * Math.max(0.6, 1 - 0.12 * ar) };
  }

  /* ---------- 4. full analysis of one cropped photo ---------- */
  function readInk(img) {
    const W = img.width, H = img.height;
    const m = inkMask(img);
    let ink = 0; for (let i = 0; i < m.length; i++) ink += m[i];
    if (ink < W * H * 0.004) return { error: "empty" };
    if (ink > W * H * 0.45) return { error: "dark" };
    const sk = thin(m, W, H), pts = [], R = Math.max(3, Math.round(Math.min(W, H) / 50));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sk[y * W + x]) {
      let sxx = 0, syy = 0, sxy = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !sk[yy * W + xx]) continue; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      pts.push([x, y, 0.5 * Math.atan2(-2 * sxy, sxx - syy)]);
    }
    if (pts.length < 8) return { error: "empty" };
    const u = prep(normalise(pts));
    return { u, mask: m, W, H };
  }
  function check(img, target, pool) {
    const res = readInk(img); if (res.error) return res;
    const u = res.u, tm = model(target, pool(target));
    if (!tm) return { error: "nodata" };
    const mine = compare(u, tm);
    const ranked = [];
    pool.all().forEach(c => { const md = model(c, pool(c)); if (md) ranked.push([c, compare(u, md).f]); });
    ranked.sort((a, b) => b[1] - a[1]);
    // where does it differ? (3×3 zones)
    const zones = [];
    const names = [["top-left", "top", "top-right"], ["left side", "middle", "right side"], ["bottom-left", "bottom", "bottom-right"]];
    for (let zy = 0; zy < 3; zy++) for (let zx = 0; zx < 3; zx++) {
      let mn = 0, ms = 0, un = 0, us = 0;
      const inZ = i => { const x = i % N, y = (i - x) / N; return Math.min(2, Math.floor(x / (N / 3))) === zx && Math.min(2, Math.floor(y / (N / 3))) === zy; };
      tm.idx.forEach(i => { if (inZ(i)) { mn++; ms += Math.max(0, 1 - u.dt[i] / TOL); } });
      u.idx.forEach(i => { if (inZ(i)) { un++; us += Math.max(0, 1 - tm.dt[i] / TOL); } });
      if (mn >= 6 && ms / mn < 0.45) zones.push({ kind: "missing", where: names[zy][zx], v: ms / mn });
      else if (un >= 6 && us / un < 0.4) zones.push({ kind: "extra", where: names[zy][zx], v: us / un });
    }
    return { score: mine.f, p: mine.p, r: mine.r, ranked: ranked.slice(0, 5), rank: ranked.findIndex(x => x[0] === target) + 1, of: ranked.length, zones, u, tm, mask: res.mask, W: res.W, H: res.H };
  }
  /* ---------- find the separate characters on a page (for tap-to-check) ---------- */
  function findBoxes(img) {
    const W = img.width, H = img.height, m = inkMask(img);
    // grow the ink so the strokes of one character join into one blob
    const r = Math.max(2, Math.round(Math.min(W, H) / 45)), g = new Uint8Array(W * H);
    const rowRun = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (m[y * W + x]) last = x; if (x - last <= r) rowRun[y * W + x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) last = x; if (last - x <= r) rowRun[y * W + x] = 1; } }
    for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (rowRun[y * W + x]) last = y; if (y - last <= r) g[y * W + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (rowRun[y * W + x]) last = y; if (last - y <= r) g[y * W + x] = 1; } }
    const lab = new Int32Array(W * H), boxes = [], q = [];
    for (let s0 = 0; s0 < W * H; s0++) {
      if (!g[s0] || lab[s0]) continue;
      let x0 = W, y0 = H, x1 = 0, y1 = 0, ink = 0; q.length = 0; q.push(s0); lab[s0] = 1;
      while (q.length) {
        const i = q.pop(), x = i % W, y = (i - x) / W; ink += m[i];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && g[i - 1] && !lab[i - 1]) { lab[i - 1] = 1; q.push(i - 1); }
        if (x < W - 1 && g[i + 1] && !lab[i + 1]) { lab[i + 1] = 1; q.push(i + 1); }
        if (y > 0 && g[i - W] && !lab[i - W]) { lab[i - W] = 1; q.push(i - W); }
        if (y < H - 1 && g[i + W] && !lab[i + W]) { lab[i + W] = 1; q.push(i + W); }
      }
      const w = x1 - x0, h = y1 - y0;
      if (w * h < W * H * 0.004 || w * h > W * H * 0.7 || ink < 20) continue;
      boxes.push({ x0, y0, x1, y1, w, h });
    }
    // merge pieces that belong to one character (e.g. left and right parts side by side)
    const med = boxes.length ? boxes.map(b => Math.max(b.w, b.h)).sort((a, b) => a - b)[Math.floor(boxes.length / 2)] : 0;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length && !merged; j++) {
        const a = boxes[i], b = boxes[j];
        const X0 = Math.min(a.x0, b.x0), Y0 = Math.min(a.y0, b.y0), X1 = Math.max(a.x1, b.x1), Y1 = Math.max(a.y1, b.y1);
        const gap = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)) + Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
        if (gap < r * 2 && Math.max(X1 - X0, Y1 - Y0) <= med * 1.25) { boxes.splice(j, 1); boxes[i] = { x0: X0, y0: Y0, x1: X1, y1: Y1, w: X1 - X0, h: Y1 - Y0 }; merged = true; }
      }
    }
    // square them up with a little margin
    return boxes.map(b => { const s = Math.max(b.w, b.h) * 1.25, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return { x: cx - s / 2, y: cy - s / 2, s }; })
      .filter(b => b.s > Math.min(W, H) * 0.08)
      .sort((a, b) => (Math.abs(a.y - b.y) < a.s * 0.5 ? a.x - b.x : a.y - b.y)).slice(0, 40);
  }
  // picture of the comparison: grey = textbook model, red = your writing, gold = missing parts
  function overlay(canvas, r) {
    const ctx = canvas.getContext("2d"), S = canvas.width / N;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#f2b1a6"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke(); ctx.setLineDash([]);
    const dot = (i, col, rad) => { const x = i % N, y = (i - x) / N; ctx.fillStyle = col; ctx.beginPath(); ctx.arc((x + 0.5) * S, (y + 0.5) * S, rad, 0, 7); ctx.fill(); };
    r.tm.idx.forEach(i => dot(i, r.u.dt[i] > TOL * 0.6 ? "#d9a521" : "#d8cfc9", S * 1.6));
    r.u.idx.forEach(i => dot(i, r.tm.dt[i] > TOL * 0.6 ? "#7a0b10" : "#c8161d", S * 0.9));
  }
  window.CSInk = { check, readInk, overlay, model, findBoxes, N, setTol: t => { TOL = t * N; } };
})();
