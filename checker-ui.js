/* Handwriting checker screen – shared by Homework and Write → Paper.
   CSChecker.open({ blob, targets: ["人", …], title, times, onDone(summary) })
   Whole page: straightens the photo, finds every handwritten character row by row, reads each copy with the
   handwriting recogniser (CSNet) and marks it: green = clearly the right character, gold = readable but unclear,
   red = reads as a different character. Then a summary per character and overall.
   One character: drag the red box onto one character to read just that one.                                   */
(function () {
  "use strict";
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const COLORS = { good: "#2e7d4f", close: "#d9a521", poor: "#c8161d", none: "#999" };
  const LABEL = { good: "clear ✓", close: "unclear", poor: "wrong" };
  const JUNK = Math.log(0.03), OTHER = 1.5, BETA = 2.0, G0 = 0.25;   // decoding constants (see decodeRow)
  const tick = () => new Promise(r => setTimeout(r, 0));
  function loadImg(blob) { return new Promise((res, rej) => { const url = URL.createObjectURL(blob), img = new Image(); img.onload = () => res({ img, url }); img.onerror = rej; img.src = url; }); }
  const pct = p => Math.round(p * 100) + "%";

  /* ---------- reading one row ---------- */
  // Every row of a notebook page is (nearly always) one character written again and again.
  // For each likely character X we find the best way to cut the row into copies (merging pieces such as 又+寸 → 对);
  // a piece may also be another character (scored 1 point lower) or not a character at all (pinyin, numbers, marks).
  function decodeRow(row, X) {
    const n = row.n, best = new Float64Array(n + 1).fill(-1e18), back = new Array(n + 1); best[0] = 0;
    const byEnd = row.byEnd;
    // typical gap between copies in this row; gaps much smaller than that are inside one character
    if (row.g0 == null) { const gp = row.gaps.map(g => g / row.T).filter(g => g > 0).sort((a, b) => a - b); const up = gp.slice(gp.length >> 1); row.g0 = gp.length >= 4 ? Math.min(0.45, Math.max(0.15, 0.45 * up[up.length >> 1])) : G0; }
    const g0 = row.g0;
    for (let j = 1; j <= n; j++) for (const k of byEnd[j] || []) {
      const c = row.cands[k]; if (best[c.i] < -1e17) continue;
      const w = Math.max(c.x1 - c.x0, 0.5 * row.T) / row.T;
      let s = JUNK, lab = null;
      if (c.lp) {
        const sx = X >= 0 ? c.lp[X] : -1e9, so = c.lp[c.top[0][0]] - (X >= 0 ? OTHER : 0);
        if (sx >= so && sx > JUNK) { s = sx; lab = X; } else if (so > JUNK) { s = so; lab = c.top[0][0]; }
      }
      // spacing: pieces far apart are rarely one character; pieces almost touching are rarely two (朋 = 月+月 written close)
      let pen = c.i > 0 ? Math.max(0, g0 - row.gaps[c.i - 1] / row.T) : 0;
      for (let q = c.i; q < c.j - 1; q++) pen += Math.max(0, row.gaps[q] / row.T - g0);
      const v = best[c.i] + w * s - BETA * pen;
      if (v > best[j]) { best[j] = v; back[j] = { k, lab }; }
    }
    const path = []; let j = n;
    while (j > 0) { const b = back[j]; if (!b) { j--; continue; } path.push(b); j = row.cands[b.k].i; }
    return { total: best[n], path: path.reverse() };
  }
  function readRow(row, forcedIdx, tset) {
    if (forcedIdx >= 0) { row.X = forcedIdx; row.decoded = decodeRow(row, forcedIdx).path; return; }
    const hyps = new Set();
    // with a homework list: any homework character that is among a piece's 5 best guesses; otherwise the clear guesses
    row.cands.forEach(c => c.top && c.top.slice(0, tset ? 5 : 2).forEach(([k, p]) => { if (tset ? tset.has(k) && p > 0.02 : p > 0.2) hyps.add(k); }));
    let bestX = -1, bestD = null;
    for (const X of hyps) { const d = decodeRow(row, X); if (!bestD || d.total > bestD.total) { bestD = d; bestX = X; } }
    row.X = bestX; row.decoded = bestD ? bestD.path : [];
  }
  // the copies of the row's character: pieces read as it, plus anything character-sized written between them
  function rowCopies(row, ri) {
    const X = row.X; if (X < 0) return [];
    const segs = row.decoded.filter(d => d.lab != null).map(d => ({ c: row.cands[d.k], lab: d.lab }));
    const mine = segs.filter(s => s.lab === X); if (!mine.length) return [];
    const ws = mine.map(s => s.c.x1 - s.c.x0).sort((a, b) => a - b), wMed = ws[ws.length >> 1];
    const first = mine[0].c.x0, last = mine[mine.length - 1].c.x1;
    const out = [];
    segs.forEach(({ c, lab }) => {
      const w = c.x1 - c.x0;
      if (lab !== X && (mine.length < 3 || c.x0 < first || c.x1 > last || w < 0.6 * wMed || w > 1.6 * wMed)) return;
      out.push({ row: ri, X, c, box: c, v: verdictFor(c, X), p: Math.exp(c.lp[X]), reads: c.top[0][0] });
    });
    return out;
  }
  function verdictFor(c, X) {
    const p = Math.exp(c.lp[X]), rank = c.top.findIndex(t => t[0] === X);
    if (rank === 0 && p >= 0.5) return "good";
    if ((rank >= 0 && rank < 3) || p >= 0.1) return "close";
    return "poor";
  }

  function open(o) {
    const times = o.times || 0;
    return new Promise(async resolveOpen => {
      const ov = el("div", "chk"); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Check my writing");
      const head = el("div", "chk-head");
      const back = el("button", "ghost", "‹ Back"); const title = el("b", null, o.title || "Check my writing");
      head.append(back, title);
      const body = el("div", "chk-body");
      ov.append(head, body); document.body.appendChild(ov); document.body.classList.add("noscroll");
      let navTok = null, closed = false, summaryOut = null, url = null;
      const close = () => {
        if (closed) return; closed = true; ov.remove(); document.body.classList.remove("noscroll");
        if (url) URL.revokeObjectURL(url);
        if (navTok && window.CSNav && !CSNav.restoring) { const t = navTok; navTok = null; CSNav.done(t); }
        if (o.onDone && summaryOut) o.onDone(summaryOut);
        resolveOpen(summaryOut);
      };
      if (window.CSNav) navTok = CSNav.push(() => { navTok = null; close(); });
      back.onclick = close;

      const tbar = el("div", "chk-targets");
      const tabs = el("div", "chk-tabs");
      const tPage = el("button", "on", "📄 Whole page"), tOne = el("button", null, "🔲 One character");
      tabs.append(tPage, tOne);
      const stage = el("div", "ck-stage"); const cv = el("canvas"); stage.append(cv);
      const info = el("p", "hint chk-info");
      const prog = el("div", "chk-prog"); const pf = el("span"); prog.append(pf); prog.hidden = true;
      const out = el("div", "chk-out");
      body.append(tbar, tabs, info, prog, stage, out);
      const setProg = f => { prog.hidden = f == null; if (f != null) pf.style.width = Math.round(f * 100) + "%"; };

      // 1. the reader (downloaded once, then kept on the phone)
      info.textContent = "Getting the handwriting reader ready…"; setProg(0);
      try { await CSNet.load(f => { info.textContent = "Downloading the handwriting reader (6.5 MB, only once)… " + pct(f); setProg(f); }); }
      catch (e) { setProg(null); info.textContent = "The handwriting reader needs the internet the first time. Connect and try again."; return; }
      const VOC = CSNet.chars, idxOf = c => VOC.indexOf(c);
      const targets = [...new Set(o.targets || [])].filter(c => idxOf(c) >= 0);
      const many = targets.length > 1;

      let forced = targets.length === 1 ? targets[0] : null;
      if (targets.length === 1) tbar.append(el("span", "hint", "Checking: "), el("span", "chk-tz", targets[0]));
      else if (many) {
        tbar.append(el("span", "hint", "Which character? "));
        const sel = el("select", "chk-sel");
        sel.append(new Option(targets.length > 8 ? "Auto – find the homework characters on this page" : "Auto – find them for me", ""));
        targets.forEach(c => sel.append(new Option(c, c)));
        sel.onchange = () => { forced = sel.value || null; if (mode === "page" && page) decodeAll(); };
        tbar.append(sel);
      }

      // 2. the photo
      let img; try { ({ img, url } = await loadImg(o.blob)); } catch (e) { setProg(null); info.textContent = "Couldn't open this photo."; return; }
      const photo = el("canvas"); photo.width = img.naturalWidth; photo.height = img.naturalHeight; photo.getContext("2d").drawImage(img, 0, 0);

      let mode = "page", page = null, rows = [], copies = [], frame = null, sel = -1, oneRes = null;
      const dpr = window.devicePixelRatio || 1;
      function paint() {
        const srcC = page ? page.work : photo, SW = srcC.width, SH = srcC.height;
        const cw = stage.clientWidth || 320, s2 = Math.min(cw / SW, 520 / SH);
        cv.style.width = SW * s2 + "px"; cv.style.height = SH * s2 + "px";
        cv.width = Math.round(SW * s2 * dpr); cv.height = Math.round(SH * s2 * dpr);
        const x = cv.getContext("2d"), z = s2 * dpr; x.drawImage(srcC, 0, 0, cv.width, cv.height); cv._z = s2;
        if (mode === "page") {
          copies.forEach((c, i) => {
            const b = c.box; x.lineWidth = (i === sel ? 4 : 2) * dpr; x.strokeStyle = COLORS[c.v];
            x.strokeRect(b.x0 * z, b.y0 * z, (b.x1 - b.x0) * z, (b.y1 - b.y0) * z);
          });
        } else if (frame) {
          x.lineWidth = 3 * dpr; x.strokeStyle = "#c8161d"; x.strokeRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
          x.fillStyle = "rgba(200,22,29,.08)"; x.fillRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
        }
      }

      /* ---------- whole page ---------- */
      async function scan() {
        info.textContent = "Straightening the page and finding your writing…"; setProg(0.02); paint(); await tick(); await tick();
        try { page = CSScan.analyse(photo); } catch (e) { page = null; }
        if (!page || !page.rows.length) { setProg(null); info.textContent = "No writing found. Take the photo straight from above, in good light, with the page filling the picture."; paint(); return false; }
        paint();
        // all possible characters in every row
        const cpu = CSNet.engine === "cpu";
        rows = page.rows.map(r => {
          const cands = CSScan.candidates(r, page.T, cpu ? 1.7 : 2.4, cpu ? 2 : 4);
          const byEnd = []; cands.forEach((c, k) => (byEnd[c.j] = byEnd[c.j] || []).push(k));
          const gaps = r.slice(1).map((a, q) => a.x0 - r[q].x1);
          return { n: r.length, T: page.T, cands, byEnd, gaps };
        });
        const all = []; rows.forEach(r => r.cands.forEach(c => all.push(c)));
        info.textContent = "Reading " + all.length + " pieces of writing…"; await tick();
        const inputs = [], who = [];
        all.forEach(c => { const x = CSScan.input(page, c); if (x) { inputs.push(x); who.push(c); } });
        const L = await CSNet.classify(inputs, f => { setProg(0.05 + 0.95 * f); info.textContent = "Reading your writing… " + pct(f); });
        if (closed) return false;
        L.forEach((l, i) => {
          const lp = CSNet.logSoftmax(l), c = who[i]; c.lp = lp;
          const order = [...lp.keys()].sort((a, b) => lp[b] - lp[a]).slice(0, 5);
          c.top = order.map(k => [k, Math.exp(lp[k])]);
        });
        setProg(null);
        window.CSChecker._last = { rows, page, VOC };
        return true;
      }
      function decodeAll() {
        const fIdx = forced ? idxOf(forced) : -1, tset = new Set(targets.map(idxOf));
        copies = [];
        rows.forEach((r, ri) => {
          readRow(r, r.userX != null ? r.userX : fIdx, many ? tset : null);
          const cp = rowCopies(r, ri); if (!cp.length) return;
          const nX = cp.filter(c => c.reads === r.X || c.v !== "poor").length;
          if (r.userX == null && !forced) {
            if (many && !tset.has(r.X)) return;                                   // not one of the homework characters
            if (nX < 2 && !(nX === 1 && cp[0].p >= 0.6)) return;                   // pinyin, numbers, notes…
          }
          copies.push(...cp);
        });
        copies.sort((a, b) => a.row - b.row || a.box.x0 - b.box.x0);
        sel = -1; paint(); summarise();
      }
      let busy = false;
      async function runPage() {
        mode = "page"; out.innerHTML = ""; tPage.classList.add("on"); tOne.classList.remove("on");
        if (!page) { if (busy) return; busy = true; const ok = await scan(); busy = false; if (!ok || closed) return; }
        decodeAll();
      }

      function thumb(c, size) {
        const b = c.box, w = b.x1 - b.x0, h = b.y1 - b.y0, L = Math.max(w, h) * 1.15;
        const t = el("canvas"); t.width = t.height = size; const x = t.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, size, size);
        x.drawImage(page.work, b.x0 + w / 2 - L / 2, b.y0 + h / 2 - L / 2, L, L, 0, 0, size, size);
        return t;
      }
      function summarise() {
        out.innerHTML = "";
        if (!copies.length) { info.textContent = forced ? "Couldn't find any " + forced + " on this page. Is it the right photo? Try a closer, sharper photo." : "Found writing, but couldn't read characters in it. Take a closer, sharper photo (2–3 rows at a time is best)."; return; }
        info.textContent = "Found " + copies.length + " cop" + (copies.length > 1 ? "ies" : "y") + ". Tap a box on the photo, or a copy below, to see how the app read it.";
        const good = copies.filter(c => c.v === "good").length, close_ = copies.filter(c => c.v === "close").length;
        const card = el("div", "chk-sum");
        const big = el("div", "chk-big"); big.append(el("b", null, pct(good / copies.length)), el("span", null, good + " of " + copies.length + " copies clear and correct"));
        const meter = el("div", "ck-meter"); const bar = el("span"); const ov2 = good / copies.length; bar.style.width = pct(ov2); bar.className = ov2 >= 0.85 ? "hi" : ov2 >= 0.6 ? "mid" : "lo"; meter.append(bar);
        card.append(big, meter, el("p", "hint", "Green = clearly the right character · gold = readable but unclear (" + close_ + ") · red = reads as a different character."));
        card.append(el("p", "g-fb " + (ov2 >= 0.85 ? "good" : ov2 >= 0.6 ? "" : "bad"),
          ov2 >= 0.85 ? "Excellent work! 很好！ Almost every copy is clear and correct." : ov2 >= 0.6 ? "Good effort – most copies are right. Look at the gold and red ones and write them again." : "Keep practising – many copies are hard to read. Watch the stroke order in Write, then try again."));
        out.append(card);
        const perChar = {};
        const groups = new Map(); copies.forEach((c, i) => { const ch = VOC[c.X]; if (!groups.has(ch)) groups.set(ch, []); groups.get(ch).push([c, i]); });
        groups.forEach((list, ch) => {
          const g = list.filter(([c]) => c.v === "good").length, avg = list.reduce((s, [c]) => s + c.p, 0) / list.length;
          perChar[ch] = { n: list.length, good: g, avg };
          const box = el("div", "chk-char");
          const h = el("div", "chk-ch"); h.append(el("span", "chk-cz", ch), el("span", null, list.length + " cop" + (list.length > 1 ? "ies" : "y") + " · " + g + " clear ✓"));
          if (!forced) { const fix = el("button", "ghost chk-fix", "Not " + ch + "?"); fix.onclick = () => fixRow(list, box); h.append(fix); }
          box.append(h);
          if (times) box.append(el("p", list.length >= times ? "hint" : "g-fb bad", list.length >= times ? "✓ " + list.length + " copies found (" + times + " needed)." : "Only " + list.length + " of " + times + " copies found – write " + (times - list.length) + " more (or retake the photo so every copy is clear)."));
          const bad = list.filter(([c]) => c.v === "poor");
          if (bad.length) {
            const rd = {}; bad.forEach(([c]) => { const r = VOC[c.reads]; rd[r] = (rd[r] || 0) + 1; });
            const [r1, n1] = Object.entries(rd).sort((a, b) => b[1] - a[1])[0];
            if (r1 !== ch) box.append(el("p", "chk-tip", n1 + " of your " + ch + " look more like " + r1 + ". Compare them with the model below and write them again."));
          }
          const thumbs = el("div", "chk-thumbs");
          list.forEach(([c, i]) => {
            const t = el("button", "chk-th " + c.v); const im = thumb(c, 96); im.className = "chk-tc";
            t.append(el("span", "chk-tn", "#" + (i + 1)), im, el("span", "chk-ts", c.v === "poor" ? VOC[c.reads] : pct(c.p)));
            t.onclick = () => showDetail(i); thumbs.append(t);
          });
          box.append(thumbs); out.append(box);
        });
        out.append(el("p", "hint", "The reader was trained on millions of handwritten characters. It can't see the order you wrote the strokes in – use Write → ✍ Write it 18 times for that."));
        summaryOut = { total: copies.length, good, avg: copies.reduce((s, c) => s + c.p, 0) / copies.length, perChar, at: Date.now() };
      }
      // the student says these copies are a different character
      function fixRow(list, box) {
        if (box.querySelector(".chk-fixrow")) return;
        const row = el("div", "chk-fixrow");
        const inp = el("input"); inp.placeholder = "Type the character you wrote"; inp.lang = "zh"; inp.maxLength = 2;
        const dl = el("datalist"); dl.id = "dl" + Math.random().toString(36).slice(2); targets.forEach(t => dl.append(new Option(t))); inp.setAttribute("list", dl.id);
        // quick choices: what the copies read as
        const alt = {}; list.forEach(([c]) => c.c.top.slice(0, 3).forEach(([k]) => { if (k !== c.X) alt[k] = (alt[k] || 0) + 1; }));
        const ar = el("div", "chk-alts");
        Object.entries(alt).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([k]) => { const bt = el("button", "chk-alt", "It's " + VOC[k]); bt.onclick = () => apply(+k); ar.append(bt); });
        const okb = el("button", "primarybtn", "Re-check");
        const apply = k => { new Set(list.map(([c]) => c.row)).forEach(ri => (rows[ri].userX = k)); decodeAll(); };
        okb.onclick = () => {
          const ch = [...inp.value.trim()].find(x => /[㐀-鿿]/.test(x));
          if (!ch || idxOf(ch) < 0) { inp.value = ""; inp.placeholder = "The reader doesn't know that one – try another"; return; }
          apply(idxOf(ch));
        };
        row.append(inp, dl, okb); box.insertBefore(ar, box.children[1] || null); box.insertBefore(row, ar.nextSibling); inp.focus();
      }
      function showDetail(i) {
        const c = copies[i]; if (!c) return; sel = i; paint();
        let d = out.querySelector(".chk-detail"); if (d) d.remove();
        d = el("div", "chk-detail");
        const row = el("div", "ck-res");
        const f1 = el("figure"); const t = thumb(c, 192); t.className = "ck-ov"; f1.append(t, el("figcaption", null, "Copy #" + (i + 1)));
        const f2 = el("figure"); const m = el("div", "ck-model", VOC[c.X]); f2.append(m, el("figcaption", null, "Model: " + VOC[c.X]));
        row.append(f1, f2);
        d.append(el("h4", null, "Copy #" + (i + 1) + " – " + LABEL[c.v]), row);
        const read = el("p", "ck-read"); read.append(el("span", "hint", "The reader sees: "));
        c.c.top.slice(0, 3).forEach(([k, p]) => read.append(el("span", "ck-cand" + (k === c.X ? " me" : ""), VOC[k] + " " + pct(p))));
        d.append(read);
        d.append(el("p", "chk-tip", c.v === "good" ? "Clear – this is easy to read as " + VOC[c.X] + "." : c.v === "close" ? "Readable, but it could also be read as " + VOC[c.c.top[0][0] === c.X ? (c.c.top[1] || c.c.top[0])[0] : c.c.top[0][0]] + ". Make each stroke clear and the right length." : "This reads as " + VOC[c.reads] + ", not " + VOC[c.X] + ". Check which stroke is missing, extra or in the wrong place."));
        const close2 = el("button", "ghost", "Close"); close2.onclick = () => { d.remove(); sel = -1; paint(); };
        d.append(close2);
        out.prepend(d); d.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      /* ---------- one character ---------- */
      function runOne() {
        mode = "one"; sel = -1; out.innerHTML = ""; tOne.classList.add("on"); tPage.classList.remove("on");
        const srcC = page ? page.work : photo, smin = Math.min(srcC.width, srcC.height);
        if (!frame) frame = { s: smin * 0.3, x: (srcC.width - smin * 0.3) / 2, y: (srcC.height - smin * 0.3) / 2 };
        info.textContent = "Drag the red box onto one character (or tap it). Use the slider to resize.";
        const sz = el("label", "ck-size"); const rng = el("input"); rng.type = "range"; rng.min = "3"; rng.max = "100"; rng.value = Math.round(frame.s / smin * 100); sz.append("Box size ", rng);
        rng.oninput = () => { const c = { x: frame.x + frame.s / 2, y: frame.y + frame.s / 2 }; frame.s = smin * rng.value / 100; frame.x = c.x - frame.s / 2; frame.y = c.y - frame.s / 2; paint(); };
        const go = el("button", "primarybtn", "Read this character");
        const res = el("div", "chk-one");
        go.onclick = async () => {
          res.innerHTML = ""; res.append(el("p", "hint", "Reading…")); await tick();
          if (!page) { info.textContent = "Getting the page ready…"; try { page = CSScan.analyse(photo); } catch (e) { page = null; } paint(); }
          res.innerHTML = "";
          if (!page) { res.append(el("p", "g-fb bad", "Couldn't read this photo.")); return; }
          // the pen marks whose centre is inside the box
          const ids = new Set(), lab = page.lab, W = page.W; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
          const fx0 = Math.max(0, Math.floor(frame.x)), fy0 = Math.max(0, Math.floor(frame.y)), fx1 = Math.min(page.W, Math.ceil(frame.x + frame.s)), fy1 = Math.min(page.H, Math.ceil(frame.y + frame.s));
          const cnt = new Map();
          for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) { const k = lab[y * W + x]; if (k) cnt.set(k, (cnt.get(k) || 0) + 1); }
          // keep pieces that are mostly inside
          const tot = new Map(); for (let i = 0; i < lab.length; i++) { const k = lab[i]; if (k && cnt.has(k)) tot.set(k, (tot.get(k) || 0) + 1); }
          cnt.forEach((n, k) => { if (n >= 0.6 * tot.get(k)) ids.add(k); });
          if (!ids.size) { res.append(el("p", "g-fb bad", "No writing in the red box – move it onto a character.")); return; }
          for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) if (ids.has(lab[y * W + x])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          const cand = { x0, y0, x1: x1 + 1, y1: y1 + 1, ids: [...ids] };
          const inp = CSScan.input(page, cand); if (!inp) { res.append(el("p", "g-fb bad", "Couldn't read this part.")); return; }
          const [l] = await CSNet.classify([inp]); const lp = CSNet.logSoftmax(l);
          cand.lp = lp; cand.top = [...lp.keys()].sort((a, b) => lp[b] - lp[a]).slice(0, 5).map(k => [k, Math.exp(lp[k])]);
          const X = forced ? idxOf(forced) : cand.top[0][0];
          const c = { X, c: cand, box: cand, v: verdictFor(cand, X), p: Math.exp(lp[X]), reads: cand.top[0][0] };
          oneRes = c;
          const row = el("div", "ck-res");
          const f1 = el("figure"); const t = thumb(c, 192); t.className = "ck-ov"; f1.append(t, el("figcaption", null, "Your writing"));
          const f2 = el("figure"); f2.append(el("div", "ck-model", VOC[X]), el("figcaption", null, "Model: " + VOC[X])); row.append(f1, f2);
          res.append(row);
          if (forced) res.append(el("p", "ck-score", VOC[X] + ": " + LABEL[c.v] + " · the reader is " + pct(c.p) + " sure"));
          else res.append(el("p", "ck-score", "Reads as " + VOC[X] + " (" + pct(c.p) + " sure)"));
          const meter = el("div", "ck-meter"); const bar = el("span"); bar.style.width = pct(c.p); bar.className = c.v === "good" ? "hi" : c.v === "close" ? "mid" : "lo"; meter.append(bar); res.append(meter);
          const read = el("p", "ck-read"); read.append(el("span", "hint", "Best guesses: ")); cand.top.slice(0, 4).forEach(([k, p]) => read.append(el("span", "ck-cand" + (k === X ? " me" : ""), VOC[k] + " " + pct(p)))); res.append(read);
          summaryOut = { total: 1, good: c.v === "good" ? 1 : 0, avg: c.p, perChar: { [VOC[X]]: { n: 1, good: c.v === "good" ? 1 : 0, avg: c.p } }, at: Date.now() };
        };
        out.append(sz, go, res); paint();
      }

      // tapping / dragging on the photo
      let drag = null;
      const at = e => { const rc = cv.getBoundingClientRect(); return { x: (e.clientX - rc.left) / cv._z, y: (e.clientY - rc.top) / cv._z }; };
      cv.style.touchAction = "none";
      cv.addEventListener("pointerdown", e => { const q = at(e); drag = { q, f: frame && Object.assign({}, frame), moved: false }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => { if (!drag || mode !== "one" || !frame) return; const q = at(e); const dx = q.x - drag.q.x, dy = q.y - drag.q.y; if (Math.abs(dx) + Math.abs(dy) > 4 / cv._z) drag.moved = true; if (drag.moved) { frame.x = drag.f.x + dx; frame.y = drag.f.y + dy; paint(); } });
      cv.addEventListener("pointerup", e => {
        if (drag && !drag.moved) {
          const q = at(e);
          if (mode === "page") { const i = copies.findIndex(c => q.x >= c.box.x0 && q.x <= c.box.x1 && q.y >= c.box.y0 && q.y <= c.box.y1); if (i >= 0) showDetail(i); }
          else if (frame) { frame.x = q.x - frame.s / 2; frame.y = q.y - frame.s / 2; paint(); }
        }
        drag = null;
      });
      tPage.onclick = () => runPage(); tOne.onclick = () => runOne();
      window.addEventListener("resize", () => !closed && paint());
      paint();
      runPage();
    });
  }
  window.CSChecker = { open, _decodeRow: decodeRow, _readRow: readRow };
})();
