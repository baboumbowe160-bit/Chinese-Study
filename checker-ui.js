/* Handwriting checker screen – shared by Homework and Write → Paper.
   CSChecker.open({ blob, targets: ["人", …], pool, title, times, onDone(summary) })
   Whole page: finds every written character, checks each copy on its own, then gives a summary per character and overall.
   One character: drag the red box onto one character.                                                               */
(function () {
  "use strict";
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const COLORS = { good: "#2e7d4f", close: "#d9a521", poor: "#c8161d", none: "#999" };
  const LABEL = { good: "good", close: "close", poor: "needs work" };
  const tick = () => new Promise(r => setTimeout(r, 0));
  function loadImg(blob) { return new Promise((res, rej) => { const url = URL.createObjectURL(blob), img = new Image(); img.onload = () => res({ img, url }); img.onerror = rej; img.src = url; }); }
  function crop(src, b, size) {
    const c = el("canvas"); c.width = c.height = size; const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, size, size); x.drawImage(src, b.x, b.y, b.s, b.s, 0, 0, size, size); return c;
  }

  function open(o) {
    const pool = o.pool, targets = [...new Set(o.targets || [])].filter(c => pool(c));
    const many = targets.length > 1;
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

      // target choice
      let forced = targets.length === 1 ? targets[0] : null;
      const tbar = el("div", "chk-targets");
      if (targets.length === 1) tbar.append(el("span", "hint", "Checking: "), el("span", "chk-tz", targets[0]));
      else if (targets.length > 1) {
        tbar.append(el("span", "hint", "Which character? "));
        const sel = el("select", "chk-sel");
        sel.append(new Option(targets.length > 8 ? "Auto – find which homework characters are on the page" : "Auto – find them for me", ""));
        targets.forEach(c => sel.append(new Option(c, c)));
        sel.onchange = () => { forced = sel.value || null; if (mode === "page") runPage(); };
        tbar.append(sel);
      }
      const tabs = el("div", "chk-tabs");
      const tPage = el("button", "on", "📄 Whole page"), tOne = el("button", null, "🔲 One character");
      tabs.append(tPage, tOne);
      const stage = el("div", "ck-stage"); const cv = el("canvas"); stage.append(cv);
      const info = el("p", "hint chk-info");
      const out = el("div", "chk-out");
      body.append(tbar, tabs, info, stage, out);

      let img; try { ({ img, url } = await loadImg(o.blob)); } catch (e) { info.textContent = "Couldn't open this photo."; return; }
      // working copy (max 1400px) for speed
      const k0 = Math.min(1, 1400 / Math.max(img.width, img.height));
      const src = el("canvas"); src.width = Math.round(img.width * k0); src.height = Math.round(img.height * k0);
      src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
      const SW = src.width, SH = src.height;

      let mode = "page", boxes = [], results = [], frame = null, sel = -1;
      const dpr = window.devicePixelRatio || 1;
      function paint() {
        const cw = stage.clientWidth || 320, s2 = Math.min(cw / SW, 480 / SH);
        cv.style.width = SW * s2 + "px"; cv.style.height = SH * s2 + "px";
        cv.width = Math.round(SW * s2 * dpr); cv.height = Math.round(SH * s2 * dpr);
        const x = cv.getContext("2d"), z = s2 * dpr; x.drawImage(src, 0, 0, cv.width, cv.height); cv._z = s2;
        if (mode === "page") {
          boxes.forEach((b, i) => {
            const r = results[i], v = r ? r.v : "none";
            x.lineWidth = (i === sel ? 4 : 2.2) * dpr; x.strokeStyle = COLORS[v]; x.strokeRect(b.x * z, b.y * z, b.s * z, b.s * z);
            if (r) { const fs = Math.max(8, Math.min(12, b.s * z / 5 / dpr)) * dpr; x.font = "700 " + fs + "px sans-serif"; x.fillStyle = COLORS[v]; x.fillRect(b.x * z, b.y * z, fs * (String(i + 1).length * 0.62 + 0.5), fs * 1.15); x.fillStyle = "#fff"; x.fillText(String(i + 1), b.x * z + fs * 0.22, b.y * z + fs * 0.95); }
          });
        } else if (frame) {
          x.lineWidth = 3 * dpr; x.strokeStyle = "#c8161d"; x.strokeRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
          x.fillStyle = "rgba(200,22,29,.08)"; x.fillRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
        }
      }

      /* ---------- whole page ---------- */
      let runId = 0;
      async function runPage() {
        const my = ++runId; mode = "page"; sel = -1; out.innerHTML = ""; results = [];
        tPage.classList.add("on"); tOne.classList.remove("on");
        info.textContent = "Looking for your characters…"; paint(); await tick();
        const kd = Math.min(1, 1100 / Math.max(SW, SH)), sm = el("canvas"); sm.width = Math.round(SW * kd); sm.height = Math.round(SH * kd);
        sm.getContext("2d").drawImage(src, 0, 0, sm.width, sm.height);
        try { boxes = CSInk.findBoxes(sm.getContext("2d").getImageData(0, 0, sm.width, sm.height), { dense: true }).map(b => ({ x: b.x / kd, y: b.y / kd, s: b.s / kd })); } catch (e) { boxes = []; }
        if (my !== runId) return;
        if (!boxes.length) { info.textContent = "No characters found. Take the photo straight from above, in good light, with dark pen – or use “One character”."; paint(); return; }
        const among = forced ? [forced] : many ? targets : pool.all();
        const prog = el("div", "chk-prog"); const pf = el("span"); prog.append(pf); out.append(prog);
        for (let i = 0; i < boxes.length; i++) {
          if (my !== runId || closed) return;
          info.textContent = "Checking copy " + (i + 1) + " of " + boxes.length + "…"; pf.style.width = ((i + 1) / boxes.length * 100) + "%";
          const c = crop(src, boxes[i], 180);
          let r; try { r = CSInk.check(c.getContext("2d").getImageData(0, 0, 180, 180), forced || (many ? null : targets[0] || null), pool, { among }); } catch (e) { r = { error: "fail" }; }
          if (r && !r.error) r.v = CSInk.verdict(r); else r = { error: (r && r.error) || "fail", v: "none" };
          r.crop = c; results[i] = r;
          if (i % 3 === 2) { paint(); await tick(); }
        }
        // the same character is usually written many times in a row: let each row agree on what it is
        if (!forced && (many || !targets.length)) {
          info.textContent = "Comparing the copies in each row…"; await tick();
          const rows = [];
          boxes.forEach((b, i) => { if (results[i].error) return; const cy = b.y + b.s / 2; const row = rows.find(rw => Math.abs(rw.cy - cy) < b.s * 0.6); if (row) row.items.push(i); else rows.push({ cy, items: [i] }); });
          for (const row of rows) {
            if (row.items.length < 3) continue;
            // majority vote of each copy's first choice (scores only break ties)
            const votes = {}, sum = {};
            row.items.forEach(i => { const rk = results[i].ranked || []; if (rk[0]) votes[rk[0][0]] = (votes[rk[0][0]] || 0) + 1; rk.forEach(([ch, f]) => (sum[ch] = (sum[ch] || 0) + f)); });
            const [win, nv] = Object.entries(votes).sort((a, b) => b[1] - a[1] || (sum[b[0]] || 0) - (sum[a[0]] || 0))[0];
            if (nv < row.items.length / 2) continue;   // no clear majority – leave each copy as it is
            for (const i of row.items) {
              const r = results[i]; if (r.target === win) continue;
              const mine = (r.ranked || []).find(x => x[0] === win), best = r.ranked && r.ranked[0];
              if (!mine || !best || mine[1] < best[1] - 0.05) continue;   // clearly a different character – keep it
              const c2 = r.crop; let r2;
              try { r2 = CSInk.check(c2.getContext("2d").getImageData(0, 0, c2.width, c2.height), win, pool, { among: r.ranked.map(x => x[0]) }); } catch (e) { r2 = null; }
              if (r2 && !r2.error) { r2.v = CSInk.verdict(r2) === "poor" ? "poor" : (r2.score >= 0.68 ? "good" : "close"); r2.crop = c2; results[i] = r2; }
            }
          }
        }
        paint(); prog.remove(); summarise();
      }
      function summarise() {
        out.innerHTML = "";
        const ok = results.map((r, i) => [r, i]).filter(([r]) => !r.error);
        if (!ok.length) { info.textContent = "Found marks, but couldn't read them as characters. Try a clearer photo."; return; }
        info.textContent = "Found " + ok.length + " character" + (ok.length > 1 ? "s" : "") + ". Tap a numbered box (or a copy below) to see its details.";
        // group by character
        const groups = new Map();
        ok.forEach(([r, i]) => { if (!groups.has(r.target)) groups.set(r.target, []); groups.get(r.target).push([r, i]); });
        const good = ok.filter(([r]) => r.v === "good").length, avg = ok.reduce((s, [r]) => s + r.score, 0) / ok.length;
        // overall card
        const card = el("div", "chk-sum");
        const big = el("div", "chk-big"); big.append(el("b", null, Math.round(good / ok.length * 100) + "%"), el("span", null, good + " of " + ok.length + " copies good"));
        const meter = el("div", "ck-meter"); const bar = el("span"); bar.style.width = Math.round(avg * 100) + "%"; bar.className = avg >= 0.78 ? "hi" : avg >= 0.68 ? "mid" : "lo"; meter.append(bar);
        card.append(big, el("p", "hint", "Average shape match " + Math.round(avg * 100) + "%. Green = good · gold = close · red = needs work."), meter);
        const overall = good / ok.length;
        card.append(el("p", "g-fb " + (overall >= 0.85 ? "good" : overall >= 0.6 ? "" : "bad"),
          overall >= 0.85 ? "Excellent work! 很好！ Almost every copy is clear and correct." : overall >= 0.6 ? "Good effort – most copies are right. Look at the gold and red ones and write them again." : "Keep practising – many copies don't match yet. Watch the stroke order in Write, then try again."));
        out.append(card);
        // per character
        const perChar = {};
        groups.forEach((list, c) => {
          const g = list.filter(([r]) => r.v === "good").length, a = list.reduce((s, [r]) => s + r.score, 0) / list.length;
          perChar[c] = { n: list.length, good: g, avg: a };
          const box = el("div", "chk-char");
          const h = el("div", "chk-ch"); h.append(el("span", "chk-cz", c), el("span", null, list.length + " cop" + (list.length > 1 ? "ies" : "y") + " · " + g + " good · avg " + Math.round(a * 100) + "%"));
          box.append(h);
          if (times && !many) box.append(el("p", list.length >= times ? "hint" : "g-fb bad", list.length >= times ? "✓ All " + times + " copies found." : "Only " + list.length + " of " + times + " copies found – write " + (times - list.length) + " more (or retake the photo so every copy is clear)."));
          // common problems across copies
          const zc = {}; list.forEach(([r]) => (r.zones || []).forEach(z => { const k = z.kind + "|" + z.where; zc[k] = (zc[k] || 0) + 1; }));
          const common = Object.entries(zc).filter(([, n]) => n >= Math.max(2, list.length * 0.3)).sort((a, b) => b[1] - a[1]).slice(0, 2);
          common.forEach(([k, n]) => { const [kind, where] = k.split("|"); box.append(el("p", "chk-tip", "In " + n + " of your " + c + ", " + (kind === "missing" ? "the " + where + " is missing or out of place." : "there are extra marks in the " + where + "."))); });
          const best = list.slice().sort((x, y) => y[0].score - x[0].score);
          if (list.length > 2) box.append(el("p", "hint", "Best copy: #" + (best[0][1] + 1) + " · needs most work: #" + (best[best.length - 1][1] + 1)));
          // runs: copies written one after another (one row of the page = one run)
          const runs = []; list.forEach(([r, i]) => { const last = runs[runs.length - 1]; if (last && i === last[last.length - 1][1] + 1) last.push([r, i]); else runs.push([[r, i]]); });
          runs.forEach(run => {
            const runBox = el("div", "chk-run");
            const hdr = el("div", "chk-runh"); hdr.append(el("span", "hint", runs.length > 1 ? "Copies #" + (run[0][1] + 1) + "–#" + (run[run.length - 1][1] + 1) : run.length + " cop" + (run.length > 1 ? "ies" : "y")));
            runBox.append(hdr);
            if (!forced) addFixers(runBox, hdr, run, c);
            const thumbs = el("div", "chk-thumbs");
            run.forEach(([r, i]) => {
              const t = el("button", "chk-th " + r.v); const im = el("img"); im.src = r.crop.toDataURL("image/jpeg", 0.7); im.alt = "Copy " + (i + 1);
              t.append(el("span", "chk-tn", "#" + (i + 1)), im, el("span", "chk-ts", Math.round(r.score * 100) + "%"));
              t.onclick = () => showDetail(i); thumbs.append(t);
            });
            runBox.append(thumbs); box.append(runBox);
          });
          out.append(box);
        });
        if (many && !forced) out.append(el("p", "hint", groups.size + " different homework character" + (groups.size > 1 ? "s" : "") + " found on this page."));
        out.append(el("p", "hint", "A photo can't show the order you wrote the strokes in – use Write → ✍ Write it 18 times for that."));
        summaryOut = { total: ok.length, good, avg, perChar, at: Date.now() };
      }
      // buttons to correct what the app read (per run of copies)
      function addFixers(runBox, hdr, list, c) {
          // the app may mix up look-alikes (天 / 太, 王 / 玉): let the student say what they wrote
          if (!forced) {
            const fix = el("button", "ghost chk-fix", "Not " + c + "? Change");
            fix.onclick = () => {
              if (runBox.querySelector(".chk-fixrow")) return;
              const row = el("div", "chk-fixrow"); const inp = el("input"); inp.placeholder = "Type the character you wrote"; inp.lang = "zh"; inp.maxLength = 2;
              const dl = el("datalist"); dl.id = "dl" + Math.random().toString(36).slice(2); (many ? targets : []).forEach(t => dl.append(new Option(t))); inp.setAttribute("list", dl.id);
              const okb = el("button", "primarybtn", "Re-check");
              okb.onclick = () => {
                const ch = [...inp.value.trim()].find(x => /[㐀-鿿]/.test(x));
                if (!ch || !pool(ch)) { inp.value = ""; inp.placeholder = "No stroke data for that – try another"; return; }
                recheck(list, ch);
              };
              row.append(inp, dl, okb); runBox.insertBefore(row, hdr.nextSibling); inp.focus();
            };
            hdr.append(fix);
            // look-alikes: other characters these copies were almost as close to – one tap to switch
            const alt = {};
            list.forEach(([r]) => (r.ranked || []).forEach(([ch, f]) => { if (ch !== c) (alt[ch] = alt[ch] || []).push(f); }));
            const own = list.reduce((s2, [r]) => s2 + ((r.ranked || []).find(x => x[0] === c) || [0, r.score])[1], 0) / list.length;
            const alts = Object.entries(alt).filter(([, v]) => v.length >= list.length * 0.6).map(([ch, v]) => [ch, v.reduce((a2, b2) => a2 + b2, 0) / v.length]).filter(([, m]) => m >= own - 0.09).sort((x, y) => y[1] - x[1]).slice(0, 3);
            if (alts.length) {
              const ar = el("div", "chk-alts"); ar.append(el("span", "hint", "Looks a bit like: "));
              alts.forEach(([ch]) => { const bt = el("button", "chk-alt", "It's " + ch); bt.onclick = () => recheck(list, ch); ar.append(bt); });
              runBox.insertBefore(ar, hdr.nextSibling);
            }
          }
      }
      // the student says these copies are character ch: check them against it
      function recheck(list, ch) {
        list.forEach(([r, i]) => {
          let r2; try { r2 = CSInk.check(r.crop.getContext("2d").getImageData(0, 0, r.crop.width, r.crop.height), ch, pool, { among: [ch].concat((r.ranked || []).map(x => x[0]).filter(x => x !== ch)) }); } catch (e) { r2 = null; }
          if (r2 && !r2.error) { r2.v = r2.score >= 0.68 ? "good" : r2.score >= 0.58 ? "close" : "poor"; r2.crop = r.crop; r2.userSaid = true; results[i] = r2; }
        });
        paint(); summarise();
      }
      function showDetail(i) {
        const r = results[i]; if (!r || r.error) return; sel = i; paint();
        let d = out.querySelector(".chk-detail"); if (d) d.remove();
        d = el("div", "chk-detail");
        const row = el("div", "ck-res");
        const ov2 = el("canvas", "ck-ov"); ov2.width = ov2.height = 192; CSInk.overlay(ov2, r);
        const f1 = el("figure"); const c2 = el("canvas", "ck-ov"); c2.width = c2.height = 192; c2.getContext("2d").drawImage(r.crop, 0, 0, 192, 192); f1.append(c2, el("figcaption", null, "Copy #" + (i + 1)));
        const f2 = el("figure"); f2.append(ov2, el("figcaption", null, "Compared with " + r.target)); row.append(f1, f2);
        d.append(el("h4", null, "Copy #" + (i + 1) + " – " + Math.round(r.score * 100) + "% · " + LABEL[r.v]), row, el("p", "ck-legend", "Grey = textbook shape · red = your strokes · gold = missing or out of place"));
        (r.zones || []).slice(0, 3).forEach(z => d.append(el("p", "chk-tip", z.kind === "missing" ? "Check the " + z.where + " – a stroke there is missing, too short or in the wrong place." : "Extra or misplaced marks in the " + z.where + ".")));
        const close2 = el("button", "ghost", "Close"); close2.onclick = () => { d.remove(); sel = -1; paint(); };
        d.append(close2);
        out.prepend(d); d.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      /* ---------- one character ---------- */
      function runOne() {
        runId++; mode = "one"; sel = -1; out.innerHTML = "";
        tOne.classList.add("on"); tPage.classList.remove("on");
        const smin = Math.min(SW, SH);
        if (!frame) frame = { s: smin * 0.4, x: (SW - smin * 0.4) / 2, y: (SH - smin * 0.4) / 2 };
        info.textContent = "Drag the red box onto one character (or tap it). Use the slider to resize.";
        const sz = el("label", "ck-size"); const rng = el("input"); rng.type = "range"; rng.min = "4"; rng.max = "100"; rng.value = Math.round(frame.s / smin * 100); sz.append("Box size ", rng);
        rng.oninput = () => { const c = { x: frame.x + frame.s / 2, y: frame.y + frame.s / 2 }; frame.s = smin * rng.value / 100; frame.x = c.x - frame.s / 2; frame.y = c.y - frame.s / 2; paint(); };
        const go = el("button", "primarybtn", "Check this character");
        const res = el("div", "chk-one");
        go.onclick = () => {
          const c = crop(src, frame, 200);
          const among = forced ? null : many ? targets : null;
          let r; try { r = CSInk.check(c.getContext("2d").getImageData(0, 0, 200, 200), forced || (many ? null : targets[0] || null), pool, among ? { among } : {}); } catch (e) { r = { error: "fail" }; }
          res.innerHTML = "";
          if (r.error) { res.append(el("p", "g-fb bad", r.error === "empty" ? "No writing in the red box – move it onto a character." : r.error === "dark" ? "Too dark, or too much ink in the box. Make the box fit just one character." : "Couldn't read this part.")); return; }
          r.v = CSInk.verdict(r); r.crop = c; results = [r]; showOneDetail(r, res);
        };
        out.append(sz, go, res); paint();
      }
      function showOneDetail(r, box) {
        const row = el("div", "ck-res");
        const f1 = el("figure"); const c2 = el("canvas", "ck-ov"); c2.width = c2.height = 192; c2.getContext("2d").drawImage(r.crop, 0, 0, 192, 192); f1.append(c2, el("figcaption", null, "Your writing"));
        const ov2 = el("canvas", "ck-ov"); ov2.width = ov2.height = 192; CSInk.overlay(ov2, r); const f2 = el("figure"); f2.append(ov2, el("figcaption", null, "Compared with " + r.target)); row.append(f1, f2);
        const meter = el("div", "ck-meter"); const bar = el("span"); bar.style.width = Math.round(r.score * 100) + "%"; bar.className = r.score >= 0.78 ? "hi" : r.score >= 0.68 ? "mid" : "lo"; meter.append(bar);
        box.append(row, el("p", "ck-score", "Shape match: " + Math.round(r.score * 100) + "% · " + LABEL[r.v]), meter);
        const read = el("p", "ck-read"); read.append(el("span", "hint", "Best guesses: ")); (r.ranked || []).slice(0, 3).forEach(([c]) => read.append(el("span", "ck-cand" + (c === r.target ? " me" : ""), c))); box.append(read);
        (r.zones || []).slice(0, 3).forEach(z => box.append(el("p", "chk-tip", z.kind === "missing" ? "Check the " + z.where + "." : "Extra marks in the " + z.where + ".")));
        summaryOut = { total: 1, good: r.v === "good" ? 1 : 0, avg: r.score, perChar: { [r.target]: { n: 1, good: r.v === "good" ? 1 : 0, avg: r.score } }, at: Date.now() };
      }

      // tapping / dragging on the photo
      let drag = null;
      const at = e => { const rc = cv.getBoundingClientRect(); return { x: (e.clientX - rc.left) / cv._z, y: (e.clientY - rc.top) / cv._z }; };
      cv.style.touchAction = "none";
      cv.addEventListener("pointerdown", e => { const q = at(e); drag = { q, f: frame && Object.assign({}, frame), moved: false }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => { if (!drag || mode !== "one") return; const q = at(e); const dx = q.x - drag.q.x, dy = q.y - drag.q.y; if (Math.abs(dx) + Math.abs(dy) > 4 / cv._z) drag.moved = true; if (drag.moved) { frame.x = drag.f.x + dx; frame.y = drag.f.y + dy; paint(); } });
      cv.addEventListener("pointerup", e => {
        if (drag && !drag.moved) {
          const q = at(e);
          if (mode === "page") { const i = boxes.findIndex(b => q.x >= b.x && q.x <= b.x + b.s && q.y >= b.y && q.y <= b.y + b.s); if (i >= 0) showDetail(i); }
          else { frame.x = q.x - frame.s / 2; frame.y = q.y - frame.s / 2; paint(); }
        }
        drag = null;
      });
      tPage.onclick = () => runPage(); tOne.onclick = () => runOne();
      window.addEventListener("resize", () => !closed && paint());
      runPage();
    });
  }
  window.CSChecker = { open };
})();
