/* Stroke Trainer – uses SETS and DATA from data.js, HanziWriter from hanzi-writer.min.js */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const DATA_URL = c => "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/" + encodeURIComponent(c) + ".json";

  // Remove words from the old personal list if they were copied into this phone's Added words.
  (function cleanOld() {
    if (store.get("cleaned10", false)) return;
    const drop = ["马博", "冈比亚", "冈比亚大学", "法拉巴"];
    const cw = store.get("customWords", []).filter(w => !drop.includes(w[0]));
    store.set("customWords", cw); store.set("cleaned10", true);
  })();
  let passed = new Set(store.get("passed", []));
  let customWords = store.get("customWords", []);
  let customData = store.get("customData", {});
  const ADDED = ["A", "Added", "Words you added", customWords];
  const ALL = SETS.concat([ADDED]);

  let setIdx = Math.min(store.get("set", 0), ALL.length - 1);
  let wordIdx = 0, charIdx = 0, writer = null, step = 0;

  const isHan = c => /[㐀-鿿]/.test(c);
  const charData = c => DATA[c] || customData[c];
  const hanChars = w => [...w].filter(c => charData(c));
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const words = () => ALL[setIdx][3];
  const wordDone = w => { const cs = hanChars(w); return cs.length > 0 && cs.every(c => passed.has(c)); };
  function say(t, cls) { const s = $("status"); s.textContent = t; s.className = "status" + (cls ? " " + cls : ""); }

  function renderSets() {
    const strip = $("sets"); strip.innerHTML = "";
    ALL.forEach((s, i) => {
      const b = document.createElement("button");
      b.textContent = s[0][0] === "C" ? "Class " + (s[0].slice(1) || "1") : s[0][0] === "H" ? "Homework " + s[0].slice(1) : s[0] === "M" ? "Mine" : s[0] === "A" ? "＋ Added" : "L" + s[0];
      b.setAttribute("aria-pressed", String(i === setIdx));
      b.onclick = () => { setIdx = i; wordIdx = 0; charIdx = 0; store.set("set", i); renderAll(); };
      strip.appendChild(b);
    });
    const s = ALL[setIdx];
    $("settitle").innerHTML = "";
    const b = document.createElement("b"); b.textContent = s[0] === "A" ? "我的新词" : s[1];
    $("settitle").append(b, document.createTextNode(s[2]));
    const PAGES = { 1: 2, 2: 8, 3: 14, 4: 22, 5: 30, 6: 40, 7: 48, 8: 56, 9: 64, 10: 72, 11: 82, 12: 90, 13: 98, 14: 104, 15: 112 };
    if (PAGES[s[0]]) $("settitle").append(el("span", "bookref", "Textbook p. " + PAGES[s[0]]));
    if (s[0][0] === "C") $("settitle").append(el("span", "bookref", "From the class board"));
    if (s[0][0] === "H") $("settitle").append(el("span", "bookref", "Chinese 3 homework · write each character 18 times"));
    $("addcard").hidden = s[0] !== "A";
  }

  function renderWords() {
    const W = words(), box = $("words"); box.innerHTML = "";
    if (!W.length) { box.innerHTML = '<span class="empty">No words yet. Add one below.</span>'; }
    W.forEach((w, i) => {
      const b = document.createElement("button");
      b.textContent = w[0];
      b.title = w[1] + " – " + w[2];
      b.setAttribute("aria-label", w[0] + ", " + w[1] + ", " + w[2]);
      b.setAttribute("aria-pressed", String(i === wordIdx));
      if (wordDone(w[0])) b.classList.add("done");
      b.onclick = () => { wordIdx = i; charIdx = 0; renderWords(); renderWord(); };
      box.appendChild(b);
    });
    const total = ALL.reduce((n, s) => n + s[3].length, 0);
    const done = ALL.reduce((n, s) => n + s[3].filter(w => wordDone(w[0])).length, 0);
    $("count").textContent = done + " / " + total + " words passed";
  }

  function renderWord() {
    if (typeof repStop === "function") repStop(true);
    setTimeout(() => { try { prefetchNear(); } catch (e) {} }, 0);
    // a new word starts fresh on the writing grid – close Type it / Paper so they don't follow you around
    if ($("ppanel") && !$("ppanel").hidden) closePanel();
    const W = words();
    $("practice").hidden = !W.length;
    if (!W.length) { writer = null; return; }
    const w = W[wordIdx];
    $("py").textContent = w[1];
    $("mn").textContent = w[2];
    $("bDel").hidden = ALL[setIdx][0] !== "A";
    const cs = hanChars(w[0]);
    const row = $("chars"); row.innerHTML = "";
    cs.forEach((c, i) => {
      const b = document.createElement("button");
      b.textContent = c;
      b.setAttribute("aria-pressed", String(i === charIdx));
      b.setAttribute("aria-label", "Character " + c);
      if (passed.has(c)) b.classList.add("done");
      b.onclick = () => { charIdx = i; renderWord(); };
      row.appendChild(b);
    });
    row.hidden = cs.length < 2;
    loadChar(cs[charIdx]);
  }

  function loadChar(c) {
    if (typeof HanziWriter === "undefined" || !c) { say("Could not load this character.", "bad"); return; }
    step = 0;
    const el = $("writer"); el.innerHTML = "";
    const size = $("box").clientWidth;
    writer = HanziWriter.create(el, c, {
      width: size, height: size, padding: Math.round(size * 0.06),
      strokeColor: tok("--ink"), radicalColor: tok("--seal"), outlineColor: tok("--outline"),
      highlightColor: tok("--seal"), drawingColor: tok("--seal"), drawingWidth: Math.max(6, size / 40),
      strokeAnimationSpeed: 0.9, delayBetweenStrokes: 450, showOutline: true, showCharacter: true,
      leniency: 1.0, showHintAfterMisses: 2,
      charDataLoader: (ch, done) => done(charData(ch))
    });
    const n = charData(c).strokes.length;
    say(c + " has " + n + " stroke" + (n > 1 ? "s" : "") + ". The red part is the radical.");
  }
  const cur = () => hanChars(words()[wordIdx][0])[charIdx];

  $("bWatch").onclick = () => {
    if (!writer) return; writer.cancelQuiz(); step = 0;
    writer.showOutline(); say("Watch the order…");
    const w = writer;
    writer.animateCharacter({ onComplete: () => { if (w === writer) say("Now try Next stroke or Trace."); } });
  };
  $("bStep").onclick = () => {
    if (!writer) return; writer.cancelQuiz();
    const n = charData(cur()).strokes.length;
    if (step === 0) { writer.hideCharacter(); writer.showOutline(); }
    if (step >= n) { step = 0; writer.hideCharacter(); say("Starting again from stroke 1."); return; }
    writer.animateStroke(step);
    step++;
    say("Stroke " + step + " of " + n + (step === n ? " – done! Tap again to restart." : ""));
  };
  function quiz(withOutline) {
    if (!writer) return;
    closePanel();
    step = 0;
    const c = cur(), n = charData(c).strokes.length;
    writer.hideCharacter();
    withOutline ? writer.showOutline() : writer.hideOutline();
    const w = writer, sayIf = (t, k) => { if (w === writer) say(t, k); };
    say(withOutline ? "Trace stroke 1 of " + n + ". Follow the order and direction." : "Strict test: write " + c + " from memory. No outline, no hints – stroke 1 of " + n);
    let failed = false;
    writer.quiz({
      leniency: withOutline ? 1.0 : 0.8,
      showHintAfterMisses: withOutline ? 2 : false,
      markStrokeCorrectAfterMisses: withOutline ? 4 : false,
      onCorrectStroke: d => { if (d.strokesRemaining) sayIf((d.mistakesOnStroke ? "OK. " : "Good. ") + "Stroke " + (d.strokeNum + 2) + " of " + n, "good"); },
      onMistake: d => {
        if (!withOutline && d.mistakesOnStroke >= 3 && !failed) {
          failed = true; w.cancelQuiz();
          sayIf("Not passed – stroke " + (d.strokeNum + 1) + " was wrong 3 times. Watch it, then try again.", "bad");
          w.showOutline(); w.animateStroke(d.strokeNum);
          return;
        }
        sayIf(withOutline ? (d.mistakesOnStroke >= 2 ? "Follow the flashing hint" : "Wrong stroke – check the order and direction") : "Wrong – " + (3 - d.mistakesOnStroke) + " tries left for this stroke", "bad");
      },
      onComplete: d => {
        if (w !== writer) return;
        const m = d.totalMistakes, s = m === 1 ? "" : "s";
        if (!withOutline && m <= 1) {
          passed.add(c); store.set("passed", [...passed]);
          say(m === 0 ? "Perfect! Passed ✓" : "Passed ✓ with 1 mistake", "good");
          renderWords();
          [...$("chars").children].forEach(b => { if (passed.has(b.textContent)) b.classList.add("done"); });
        } else if (!withOutline) {
          say(m + " mistakes – not passed yet. A pass needs 1 mistake or fewer. Trace again, then retry.", "bad");
        } else {
          say(m === 0 ? "Clean trace! Now try the strict Test." : "Finished with " + m + " mistake" + s + ". Trace again until it is clean.", m ? "" : "good");
        }
      }
    });
  }
  /* ---- Homework mode: write each character N times (default 18) ---- */
  const REP_N = 18;
  var rep = null;   // { char, n, timer }  (var: renderWord may run before this line)
  const repCounts = () => store.get("repCount", {});
  function repTarget() {
    const s = ALL[setIdx]; const A = (window.CLASS_ASSIGNMENTS || []).find(x => x.set === s[0]);
    return (A && A.times) || REP_N;
  }
  function repShow() {
    const rc = $("repcount"); if (!rep) { rc.hidden = true; return; }
    const n = repCounts()[rep.char] || 0, N = repTarget();
    rc.hidden = false; rc.innerHTML = "<b></b><span></span>"; rc.firstChild.textContent = n + " / " + N; rc.lastChild.textContent = n < 3 ? "trace" : "from memory";
  }
  function repStop(silent) {
    if (!rep) return;
    clearTimeout(rep.timer); rep = null;
    const b = $("bRep"); b.classList.remove("on"); b.innerHTML = "✍ Write it " + repTarget() + " times<small>homework mode – counts every clean copy</small>";
    $("repcount").hidden = true;
    if (writer && !silent) { try { writer.cancelQuiz(); writer.showCharacter(); writer.showOutline(); } catch (e) {} }
  }
  function tickHomework(c) {
    const s = ALL[setIdx]; const cs = store.get("classState", {});
    (window.CLASS_ASSIGNMENTS || []).forEach(A => {
      if (A.set !== s[0] || !A.chars || !A.chars.some(x => x[0] === c)) return;
      const st = cs[A.id] = Object.assign({}, cs[A.id]); const t = new Set(st.ticks || []); t.add(c); st.ticks = [...t];
    });
    store.set("classState", cs);
  }
  function repGo() {
    if (!rep || !writer) return;
    const c = cur(); if (c !== rep.char) { rep.char = c; }
    const counts = repCounts(), n = counts[c] || 0, N = repTarget();
    repShow();
    if (n >= N) return repFinished();
    const trace = n < 3, total = charData(c).strokes.length, w = writer;
    w.hideCharacter(); trace ? w.showOutline() : w.hideOutline();
    say((trace ? "Trace " : "Write from memory – ") + c + ": copy " + (n + 1) + " of " + N + ". " + total + " strokes.");
    let mistakes = 0;
    w.quiz({
      leniency: 1.0, showHintAfterMisses: trace ? 2 : 3, markStrokeCorrectAfterMisses: 5,
      onMistake: () => { mistakes++; if (w === writer && rep) say("Check the stroke order and direction", "bad"); },
      onCorrectStroke: d => { if (w === writer && rep && d.strokesRemaining) say("Stroke " + (d.strokeNum + 2) + " of " + total, "good"); },
      onComplete: d => {
        if (w !== writer || !rep) return;
        const clean = d.totalMistakes <= 2;
        if (clean) { const k = repCounts(); k[c] = (k[c] || 0) + 1; store.set("repCount", k); }
        const now = repCounts()[c] || 0;
        say(clean ? "✓ " + now + " of " + N + (now >= N ? "" : " – again!") : d.totalMistakes + " mistakes – that copy doesn't count. Again, slowly.", clean ? "good" : "bad");
        repShow(); $("repcount").classList.remove("pop"); void $("repcount").offsetWidth; $("repcount").classList.add("pop");
        rep.timer = setTimeout(repGo, clean ? 700 : 1400);
      }
    });
  }
  function repFinished() {
    const c = rep.char, N = repTarget();
    tickHomework(c); passed.add(c); store.set("passed", [...passed]); renderWordsKeep();
    say("🎉 " + c + " written " + N + " times! Ticked in your homework.", "good");
    if (writer) { writer.showCharacter(); writer.hideOutline(); }
    // go on to the next character automatically
    rep.timer = setTimeout(() => {
      if (!rep) return;
      const W = words(), hc = hanChars(W[wordIdx][0]);
      const keep = rep;
      if (charIdx < hc.length - 1) { charIdx++; renderWord(); }
      else if (wordIdx < W.length - 1) { wordIdx++; charIdx = 0; renderAll(); }
      else { say("🏆 You finished every character in this list!", "good"); return repStop(true); }
      rep = keep; rep.char = cur();
      const b = $("bRep"); b.classList.add("on"); b.innerHTML = "■ Stop<small>your count is saved – continue any time</small>";
      setTimeout(repGo, 400);
    }, 1800);
  }
  function renderWordsKeep() { try { renderWords(); } catch (e) {} }
  $("bRep").onclick = () => {
    if (rep) return repStop();
    closePanel();
    rep = { char: cur(), timer: 0 };
    const b = $("bRep"); b.classList.add("on"); b.innerHTML = "■ Stop<small>your count is saved – continue any time</small>";
    $("box").scrollIntoView({ behavior: "smooth", block: "center" });
    repGo();
  };
  /* ---- extra practice panels ---- */
  function closePanel() { const p = $("ppanel"); p.hidden = true; p.innerHTML = ""; }
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  function typePanel() {
    const w = words()[wordIdx]; if (!w) return;
    const p = $("ppanel"); p.innerHTML = ""; p.hidden = false;
    p.append(mk("h3", null, "Type it with a Chinese keyboard"));
    const hide = store.get("typeHide", false);
    const cue = mk("div", "tp-cue");
    const showCue = () => { cue.innerHTML = ""; cue.append(mk("b", null, w[2] || "(no meaning)")); if (!store.get("typeHide", false)) cue.append(" · ", mk("span", "tp-py", w[1])); };
    showCue();
    const row = mk("div", "arow");
    const inp = mk("input"); inp.id = "typeIn"; inp.lang = "zh"; inp.autocomplete = "off"; inp.placeholder = "Type the characters…"; inp.setAttribute("aria-label", "Type the word in Chinese");
    const chk = mk("button", "primarybtn small", "Check");
    row.append(inp, chk);
    const lis = mk("button", "ghost", "Listen"); lis.onclick = () => play(w[0], false, lis);
    const hid = mk("button", "ghost", hide ? "Show pinyin" : "Hide pinyin (harder)");
    hid.onclick = () => { store.set("typeHide", !store.get("typeHide", false)); hid.textContent = store.get("typeHide", false) ? "Show pinyin" : "Hide pinyin (harder)"; showCue(); };
    const res = mk("div", "tp-res");
    const tools = mk("div", "frow"); tools.append(lis, hid);
    p.append(mk("p", "hint", "Listen, then type the word using your phone's Chinese keyboard (pinyin or handwriting). The app checks every character."), cue, row, tools, res);
    const check = () => {
      const got = [...inp.value.replace(/\s+/g, "")], want = [...w[0].replace(/\s+/g, "")];
      res.innerHTML = "";
      if (!got.length) { res.append(mk("p", "hint", "Type something first.")); return; }
      const line = mk("div", "tp-line");
      const n = Math.max(got.length, want.length); let ok = 0;
      for (let i = 0; i < n; i++) { const g = got[i] || "＿", good = got[i] === want[i]; if (good) ok++; line.append(mk("span", "tp-c " + (good ? "ok" : "no"), g)); }
      res.append(line);
      if (ok === want.length && got.length === want.length) { res.append(mk("p", "g-fb good", "Correct! 对了！ " + w[0] + " (" + w[1] + ")")); play(w[0], false, lis); }
      else res.append(mk("p", "g-fb bad", ok + " of " + want.length + " correct. The answer is " + w[0] + " (" + w[1] + "). Look closely and try again."));
    };
    chk.onclick = check; inp.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    const help = mk("details", "help"); help.innerHTML = "<summary>How to add a Chinese keyboard</summary><ol><li>Open <b>Settings → System → Languages &amp; input → On-screen keyboard → Gboard → Languages</b>.</li><li>Tap <b>Add keyboard</b>, choose <b>中文（中国）Chinese (Simplified, China)</b>.</li><li>Pick <b>Pinyin</b> (type sounds like “xiexie”) and/or <b>Handwriting</b> (draw characters with your finger – great practice!).</li><li>In any text box, hold the 🌐 key to switch keyboards.</li></ol>";
    p.append(help);
    setTimeout(() => inp.focus(), 50);
  }
  /* photos of paper practice, stored with the word (same photo store as Homework) */
  let pdb = null;
  function photoDb() {
    if (pdb) return pdb;
    pdb = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open("chinese-study", 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true }); s.createIndex("aid", "aid"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return pdb;
  }
  async function wordPhotos(key) {
    try { const d = await photoDb(); return await new Promise((res, rej) => { const q = d.transaction("photos").objectStore("photos").index("aid").getAll(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return []; }
  }
  async function savePhoto(key, blob) { const d = await photoDb(); return new Promise((res, rej) => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").add({ aid: key, blob, t: Date.now() }); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  async function delPhoto(id) { const d = await photoDb(); return new Promise(res => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").delete(id); t.oncomplete = res; }); }
  function shrink(file) {
    return new Promise(res => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => res(b || file), "image/jpeg", 0.82); };
      img.onerror = () => { URL.revokeObjectURL(url); res(file); }; img.src = url;
    });
  }
  async function updatePhoto(rec) { const d = await photoDb(); return new Promise(res => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").put(rec); t.oncomplete = res; t.onerror = res; }); }
  // every character the app has stroke data for = what the checker can recognise
  const pool = c => DATA[c] || customData[c] || (window.BPLUS && BPLUS.strokes[c]) || (window.BSTROKES && BSTROKES[c]);
  pool.all = () => [...new Set([...Object.keys(DATA), ...Object.keys(customData), ...Object.keys((window.BPLUS && BPLUS.strokes) || {}), ...Object.keys(window.BSTROKES || {})])].filter(c => /[㐀-鿿]/.test(c));
  function loadImg(blob) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(blob), img = new Image(); img.onload = () => res({ img, url }); img.onerror = rej; img.src = url; });
  }
  function paperPanel() {
    const w = words()[wordIdx]; if (!w) return;
    const key = "practice:" + w[0];
    const p = $("ppanel"); p.innerHTML = ""; p.hidden = false;
    p.append(mk("h3", null, "Practise on paper or in your book"));
    const steps = mk("ol", "pp-steps");
    ["Watch the stroke order above.", "Write " + w[0] + " in your book several times, saying it aloud each time. Use dark pen or pencil.", "Take a clear photo from straight above, in good light.", "Tap the photo – the app reads your writing and marks it."].forEach(s => steps.append(mk("li", null, s)));
    p.append(steps);
    const gal = mk("div", "photos"), ck = mk("div", "ck"); ck.hidden = true;
    p.append(gal, ck);
    const review = mk("div", "pp-review");
    const saved = store.get("paperReview", {})[w[0]] || {};
    review.append(mk("p", "label", "Your own checklist"));
    const boxes = {};
    [["count", "Right number of strokes"], ["order", "Strokes in the correct order"], ["shape", "Shape matches the model"], ["box", "Fits neatly in the square"]].forEach(([k, label]) => {
      const l = mk("label", "pp-chk"); const cb = mk("input"); cb.type = "checkbox"; cb.checked = !!saved[k]; boxes[k] = cb;
      cb.onchange = () => { const all = store.get("paperReview", {}); all[w[0]] = Object.assign({}, all[w[0]], { [k]: cb.checked, t: Date.now() }); store.set("paperReview", all); score(); };
      l.append(cb, " " + label); review.append(l);
    });
    const sc = mk("p", "g-fb"); review.append(sc);
    function score() { const r = store.get("paperReview", {})[w[0]] || {}; const n = ["count", "order", "shape", "box"].filter(k => r[k]).length; sc.textContent = n === 4 ? "Excellent – all four checks! 很好！" : n + " of 4 checks."; sc.className = "g-fb " + (n === 4 ? "good" : ""); }
    score();
    p.append(review);
    p.append(mk("p", "hint", "The app checks the shape of each character in your photo. A photo can't show the order you wrote the strokes in – use the strict Test above for stroke order."));

    async function draw() {
      gal.innerHTML = "";
      const list = await wordPhotos(key);
      list.forEach(ph => {
        const f = mk("figure"); const img = mk("img"); const url = URL.createObjectURL(ph.blob); img.src = url; img.alt = "My handwriting of " + w[0];
        img.onclick = () => openCheck(ph);
        const del = mk("button", "pdel", "×"); del.setAttribute("aria-label", "Remove photo");
        del.onclick = async () => { if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Remove?"; return; } await delPhoto(ph.id); draw(); };
        const best = ph.checks ? Object.values(ph.checks) : [];
        const tag = mk("button", "pp-tag", best.length ? "✓ " + Math.round(Math.max(...best) * 100) + "%" : "Check ✓");
        tag.onclick = () => openCheck(ph);
        f.append(img, del, tag); gal.append(f);
      });
      const saveFiles = async (files, btn) => {
        const sp = btn.querySelector("span"); sp.textContent = "Saving…";
        try { for (const f of files) { await savePhoto(key, await shrink(f)); } } catch (err) { sp.textContent = "Couldn't save photo"; return; }
        await draw(); const l = await wordPhotos(key); const last = l[l.length - 1]; if (last) openCheck(last);
      };
      const add = mk("button", "padd"); add.innerHTML = "<span>📷 Take photo</span>";
      add.onclick = async () => { const b = window.CSCamera ? await CSCamera.take({ hint: "Fit one or more characters in the picture, straight from above" }) : null; if (b) saveFiles([b], add); };
      const pick = mk("label", "padd"); pick.innerHTML = '<input type="file" accept="image/*" multiple hidden><span>🖼 From gallery</span>';
      pick.querySelector("input").onchange = e => saveFiles([...e.target.files], pick);
      gal.append(add, pick);
    }

    /* ---- the checker ---- */
    let navTok = null;
    function closeCheck() { ck.hidden = true; ck.innerHTML = ""; gal.hidden = false; draw(); if (navTok && window.CSNav) { const t = navTok; navTok = null; CSNav.done(t); } }
    async function openCheck(ph) {
      ck.innerHTML = ""; ck.hidden = false; gal.hidden = true;
      if (window.CSNav && !navTok) navTok = CSNav.push(() => { navTok = null; ck.hidden = true; ck.innerHTML = ""; gal.hidden = false; draw(); });
      const head = mk("div", "ck-head");
      const back = mk("button", "ghost", "‹ Photos"); back.onclick = closeCheck;
      head.append(back, mk("b", null, "Check my writing"));
      ck.append(head);
      const targets = [...new Set(hanChars(w[0]))];
      let target = targets[charIdx] || targets[0];
      const chips = mk("div", "ck-chips");
      if (targets.length > 1) {
        chips.append(mk("span", "hint", "Which character? "));
        targets.forEach(c => { const b = mk("button", "ck-chip" + (c === target ? " on" : ""), c); b.onclick = () => { target = c; chips.querySelectorAll(".ck-chip").forEach(x => x.classList.toggle("on", x === b)); }; chips.append(b); });
        ck.append(chips);
      }
      const tip = mk("p", "hint", "Finding your characters…"); ck.append(tip);
      const stage = mk("div", "ck-stage"); const cv = mk("canvas"); stage.append(cv); ck.append(stage);
      const sizeRow = mk("label", "ck-size"); const rng = mk("input"); rng.type = "range"; rng.min = "5"; rng.max = "100"; rng.value = "45"; sizeRow.append("Box size ", rng); ck.append(sizeRow);
      const go = mk("button", "primarybtn", "Check this character"); ck.append(go);
      const out = mk("div", "ck-out"); ck.append(out);
      const tools = mk("div", "frow");
      const full = mk("button", "ghost", "View full photo");
      tools.append(full); ck.append(tools);
      let img, url;
      try { ({ img, url } = await loadImg(ph.blob)); } catch (e) { tip.textContent = "Couldn't open this photo."; return; }
      full.onclick = () => { $("viewerImg").src = url; $("viewer").hidden = false; };
      if (navigator.canShare) {
        try {
          const file = new File([ph.blob], "handwriting-" + w[0] + ".jpg", { type: "image/jpeg" });
          if (navigator.canShare({ files: [file] })) {
            const sh = mk("button", "ghost", "Send to teacher");
            sh.onclick = () => navigator.share({ files: [file], title: "My handwriting: " + w[0], text: "My handwriting practice: " + w[0] + " (" + w[1] + ")" + (ph.checks ? " – app score " + Math.round(Math.max(...Object.values(ph.checks)) * 100) + "%" : "") }).catch(() => {});
            tools.append(sh);
          }
        } catch (e) {}
      }
      // working copy (max 1000px) for speed
      const k0 = Math.min(1, 1000 / Math.max(img.width, img.height));
      const src = mk("canvas"); src.width = Math.round(img.width * k0); src.height = Math.round(img.height * k0);
      src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
      const SW = src.width, SH = src.height;
      // find characters on a small copy
      const k1 = Math.min(1, 380 / Math.max(SW, SH)), sm = mk("canvas"); sm.width = Math.round(SW * k1); sm.height = Math.round(SH * k1);
      sm.getContext("2d").drawImage(src, 0, 0, sm.width, sm.height);
      let found = [];
      try { found = CSInk.findBoxes(sm.getContext("2d").getImageData(0, 0, sm.width, sm.height)).map(b => ({ x: b.x / k1, y: b.y / k1, s: b.s / k1 })); } catch (e) { found = []; }
      let frame = found[0] ? Object.assign({}, found[0]) : { s: Math.min(SW, SH) * 0.45, x: 0, y: 0 };
      if (!found[0]) { frame.x = (SW - frame.s) / 2; frame.y = (SH - frame.s) / 2; }
      tip.textContent = found.length ? "Found " + found.length + " character" + (found.length > 1 ? "s" : "") + " (gold boxes). Tap one, or drag the red box onto the character you want checked." : "Drag the red box onto one character, and resize it so the whole character fits inside.";
      const smin = Math.min(SW, SH);
      rng.value = Math.round(frame.s / smin * 100);
      // display
      const dpr = window.devicePixelRatio || 1;
      function paint() {
        const cw = stage.clientWidth || 300, sc = cw / SW, ch = Math.min(SH * sc, 460);
        const s2 = Math.min(sc, ch / SH);
        cv.style.width = SW * s2 + "px"; cv.style.height = SH * s2 + "px";
        cv.width = Math.round(SW * s2 * dpr); cv.height = Math.round(SH * s2 * dpr);
        const x = cv.getContext("2d"), z = s2 * dpr; x.drawImage(src, 0, 0, cv.width, cv.height);
        x.lineWidth = 2 * dpr; x.setLineDash([5 * dpr, 4 * dpr]); x.strokeStyle = "#d9a521";
        found.forEach(b => x.strokeRect(b.x * z, b.y * z, b.s * z, b.s * z));
        x.setLineDash([]); x.lineWidth = 3 * dpr; x.strokeStyle = "#c8161d"; x.strokeRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
        x.fillStyle = "rgba(200,22,29,.08)"; x.fillRect(frame.x * z, frame.y * z, frame.s * z, frame.s * z);
        cv._z = s2;
      }
      paint();
      const clamp = () => { frame.s = Math.max(12, Math.min(frame.s, Math.max(SW, SH))); frame.x = Math.max(-frame.s * 0.3, Math.min(frame.x, SW - frame.s * 0.7)); frame.y = Math.max(-frame.s * 0.3, Math.min(frame.y, SH - frame.s * 0.7)); };
      rng.oninput = () => { const c = { x: frame.x + frame.s / 2, y: frame.y + frame.s / 2 }; frame.s = smin * rng.value / 100; frame.x = c.x - frame.s / 2; frame.y = c.y - frame.s / 2; clamp(); paint(); };
      let drag = null;
      const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / cv._z, y: (e.clientY - r.top) / cv._z }; };
      cv.addEventListener("pointerdown", e => { const q = at(e); drag = { q, f: Object.assign({}, frame), moved: false }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => { if (!drag) return; const q = at(e); const dx = q.x - drag.q.x, dy = q.y - drag.q.y; if (Math.abs(dx) + Math.abs(dy) > 4 / cv._z) drag.moved = true; if (drag.moved) { frame.x = drag.f.x + dx; frame.y = drag.f.y + dy; clamp(); paint(); } });
      cv.addEventListener("pointerup", e => {
        if (drag && !drag.moved) {
          const q = at(e), hit = found.find(b => q.x >= b.x && q.x <= b.x + b.s && q.y >= b.y && q.y <= b.y + b.s);
          if (hit) frame = Object.assign({}, hit); else { frame.x = q.x - frame.s / 2; frame.y = q.y - frame.s / 2; }
          clamp(); rng.value = Math.round(frame.s / smin * 100); paint();
          if (hit) run();
        }
        drag = null;
      });
      cv.style.touchAction = "none";
      window.addEventListener("resize", paint, { once: true });
      function run() {
        const c = mk("canvas"); c.width = c.height = 200; const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, 200, 200);
        x.drawImage(src, frame.x, frame.y, frame.s, frame.s, 0, 0, 200, 200);
        out.innerHTML = ""; out.append(mk("p", "hint", "Reading your writing…"));
        setTimeout(async () => {
          let r;
          try { r = CSInk.check(x.getImageData(0, 0, 200, 200), target, pool); } catch (e) { r = { error: "fail" }; }
          out.innerHTML = "";
          if (r.error) {
            out.append(mk("p", "g-fb bad", { empty: "No writing found in the red box. Move it onto a character.", dark: "The photo is too dark or the box has too much ink. Try a brighter photo, or a smaller box around one character.", nodata: "No stroke data for " + target + "." }[r.error] || "Couldn't read this part of the photo."));
            return;
          }
          const pct = Math.round(r.score * 100), top = r.ranked[0][0], isTop = top === target;
          const good = r.score >= 0.68 && r.rank <= 3;
          const row = mk("div", "ck-res");
          const ov = mk("canvas"); ov.width = ov.height = 192; ov.className = "ck-ov"; CSInk.overlay(ov, r);
          const mine = mk("canvas"); mine.width = mine.height = 192; mine.className = "ck-ov"; mine.getContext("2d").drawImage(c, 0, 0, 192, 192);
          const fig1 = mk("figure"); fig1.append(mine, mk("figcaption", null, "Your writing"));
          const fig2 = mk("figure"); fig2.append(ov, mk("figcaption", null, "Compared with " + target));
          row.append(fig1, fig2); out.append(row);
          out.append(mk("p", "ck-legend", "Grey = textbook shape · red = your strokes · gold = parts that are missing or out of place"));
          const meter = mk("div", "ck-meter"); const bar = mk("span"); bar.style.width = pct + "%"; bar.className = r.score >= 0.78 ? "hi" : r.score >= 0.68 ? "mid" : "lo"; meter.append(bar);
          out.append(mk("p", "ck-score", "Shape match: " + pct + "%"), meter);
          let verdict;
          if (r.score >= 0.78 && isTop) verdict = ["Excellent! 很好！ The app reads this as " + target + ".", "good"];
          else if (good && isTop) verdict = ["Good – it reads as " + target + ". Tidy the gold parts to make it neater.", "good"];
          else if (good) verdict = ["Close. It's recognisable as " + target + ", but it also looks like " + top + ". Make the gold parts clearer.", ""];
          else if (r.score >= 0.58) verdict = ["Getting there. The shape is partly right – compare the gold parts with the model and write it again.", ""];
          else verdict = ["This doesn't match " + target + " yet. Check that the red box holds only this character, then compare with the model and try again.", "bad"];
          out.append(mk("p", "g-fb " + verdict[1], verdict[0]));
          const read = mk("p", "ck-read"); read.append(mk("span", "hint", "Best guesses: "));
          r.ranked.slice(0, 3).forEach(([cc, f], i) => { const s = mk("span", "ck-cand" + (cc === target ? " me" : ""), cc); s.title = Math.round(f * 100) + "%"; read.append(s); });
          out.append(read);
          if (r.zones.length) {
            const ul = mk("ul", "ck-tips");
            r.zones.slice(0, 3).forEach(z => ul.append(mk("li", null, z.kind === "missing" ? "Check the " + z.where + " – a stroke there is missing, too short or in the wrong place." : "Extra or misplaced marks in the " + z.where + ".")));
            out.append(ul);
          }
          const strokesN = (pool(target).strokes || []).length;
          out.append(mk("p", "hint", target + " has " + strokesN + " strokes. Count yours – a photo can't show stroke order, so do the strict Test above for that."));
          // remember the best score on the photo, and tick "shape" in the checklist when it is good
          ph.checks = Object.assign({}, ph.checks, { [target]: Math.max(r.score, (ph.checks && ph.checks[target]) || 0) });
          updatePhoto(ph);
          if (good && isTop && !boxes.shape.checked) { boxes.shape.checked = true; boxes.shape.onchange(); }
          out.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 30);
      }
      go.onclick = run;
    }
    draw();
  }
  $("bType").onclick = () => { if ($("ppanel").dataset.mode === "type" && !$("ppanel").hidden) return closePanel(); $("ppanel").dataset.mode = "type"; typePanel(); };
  $("bPaper").onclick = () => { if ($("ppanel").dataset.mode === "paper" && !$("ppanel").hidden) return closePanel(); $("ppanel").dataset.mode = "paper"; paperPanel(); };
  ["bWatch", "bStep", "bTrace", "bTest", "bType", "bPaper"].forEach(id => $(id).addEventListener("click", () => repStop(true), true));
  $("bTrace").onclick = () => quiz(true);
  $("bTest").onclick = () => quiz(false);

  function move(d) {
    const W = words(); if (!W.length) return;
    const cs = hanChars(W[wordIdx][0]);
    if (d > 0 && charIdx < cs.length - 1) { charIdx++; return renderWord(); }
    if (d < 0 && charIdx > 0) { charIdx--; return renderWord(); }
    wordIdx = (wordIdx + d + W.length) % W.length;
    charIdx = d > 0 ? 0 : Math.max(0, hanChars(W[wordIdx][0]).length - 1);
    renderWords(); renderWord();
  }
  $("bNext").onclick = () => move(1);
  $("bPrev").onclick = () => move(-1);

  /* ---- Pronunciation: two recorded native speakers + the phone's own voice ---- */
  const synth = window.speechSynthesis;
  let zhVoice = null, voice = store.get("voice", "v1");
  const player = new Audio(); player.preload = "auto";
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    zhVoice = vs.find(v => /^zh[-_]CN/i.test(v.lang)) || vs.find(v => /^cmn/i.test(v.lang)) ||
              vs.find(v => /^zh/i.test(v.lang) && !/HK|yue/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); try { synth.addEventListener("voiceschanged", pickVoice); } catch (e) { synth.onvoiceschanged = pickVoice; } }
  function note(t) { const m = $("voicemsg"); m.hidden = !t; m.textContent = t || ""; }
  function renderVoices() {
    document.querySelectorAll(".voices button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === voice)));
  }
  function stopAll() {
    try { player.pause(); } catch (e) {}
    if (window.CSAudio) CSAudio.stop();
    if (synth) synth.cancel();
    document.querySelectorAll(".say.playing").forEach(b => b.classList.remove("playing"));
  }
  function ttsSpeak(text, rate, btn) {
    if (!synth) { note("This phone can't read text aloud. Try Voice 1 or Voice 2."); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; u.rate = rate; if (zhVoice) u.voice = zhVoice;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = u.onerror = () => btn.classList.remove("playing");
    btn.classList.add("playing"); synth.speak(u);
    setTimeout(() => {
      if (!started && !synth.speaking) {
        btn.classList.remove("playing");
        note("No Chinese voice on this phone. Settings → Accessibility → Text-to-speech → Google (⚙️) → Install voice data → Chinese (Mandarin).");
      }
    }, 2500);
  }
  function play(text, slow, btn) {
    stopAll();
    const a = (typeof AUDIO !== "undefined") && AUDIO[text];
    const order = voice === "v2" ? ["v2", "v1"] : voice === "v1" ? ["v1", "v2"] : [];
    const pick = a ? order.find(v => a[v === "v1" ? 1 : 2]) : null;
    if (!pick) {
      if (voice !== "tts") note(a ? "" : "No recording for this word yet, so your phone's voice is reading it.");
      return ttsSpeak(text, slow ? 0.5 : 0.85, btn);
    }
    note(pick !== voice ? "Voice " + voice.slice(1) + " has no recording of this word, so Voice " + pick.slice(1) + " is playing." : "");
    const url = "audio/" + pick + "/" + a[0] + ".mp3";
    // normal speed: the instant Web Audio engine; slow: the phone player (it can slow down without changing the pitch)
    if (!slow && window.CSAudio) {
      CSAudio.play(url, { btn }).then(ok => { if (ok === null) ttsSpeak(text, 0.85, btn); });
      return;
    }
    player.src = url;
    player.playbackRate = slow ? 0.65 : 1;
    try { player.preservesPitch = true; player.mozPreservesPitch = true; player.webkitPreservesPitch = true; } catch (e) {}
    btn.classList.add("playing");
    player.onended = player.onerror = () => btn.classList.remove("playing");
    const p = player.play();
    if (p && p.catch) p.catch(() => { btn.classList.remove("playing"); ttsSpeak(text, slow ? 0.5 : 0.85, btn); });
  }
  const curWord = () => words()[wordIdx] && words()[wordIdx][0];
  // get the next sounds ready before they are tapped
  function urlFor(text) {
    const a = (typeof AUDIO !== "undefined") && AUDIO[text]; if (!a) return null;
    const v = voice === "v2" ? (a[2] ? "v2" : a[1] ? "v1" : null) : (a[1] ? "v1" : a[2] ? "v2" : null);
    return v ? "audio/" + v + "/" + a[0] + ".mp3" : null;
  }
  function prefetchNear() {
    if (!window.CSAudio) return;
    const W = words(); if (!W.length) return;
    CSAudio.prefetch([W[wordIdx], W[wordIdx + 1], W[wordIdx - 1]].filter(Boolean).map(w => urlFor(w[0])));
  }
  $("bSay").onclick = () => { const w = curWord(); if (w) play(w, false, $("bSay")); };
  $("bSlow").onclick = () => { const w = curWord(); if (w) play(w, true, $("bSlow")); };
  document.querySelectorAll(".voices button").forEach(b => b.onclick = () => {
    voice = b.dataset.v; store.set("voice", voice); renderVoices();
    $("bSay").click();
    if (voice === "tts") note("Phone voice uses your phone's text-to-speech. For a male voice: Settings → Accessibility → Text-to-speech → Google (⚙️) → Chinese, then pick a male voice.");
  });
  renderVoices();

  /* ---- Search across every lesson ---- */
  const plain = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ü/g, "v").replace(/[\s'’·-]/g, "");
  function setName(s) { return s[0][0] === "H" ? "Homework" : s[0][0] === "C" ? "Class" : s[0] === "M" ? "Mine" : s[0] === "A" ? "Added" : "L" + s[0]; }
  function doSearch() {
    const raw = $("q").value.trim(), box = $("results");
    if (!raw) { box.hidden = true; box.innerHTML = ""; return; }
    const isZh = /[㐀-鿿]/.test(raw), q = plain(raw), ql = raw.toLowerCase();
    const hits = [];
    ALL.forEach((s, si) => s[3].forEach((w, wi) => {
      let score = 0;
      if (isZh) { if (w[0] === raw) score = 3; else if (w[0].includes(raw)) score = 2; }
      else {
        const p = plain(w[1]), m = (w[2] || "").toLowerCase();
        if (p === q) score = 3; else if (p.startsWith(q)) score = 2.5; else if (p.includes(q)) score = 1.5;
        if (new RegExp("(^|[^a-z])" + ql.replace(/[^a-z0-9 ]/g, "")).test(m)) score = Math.max(score, 2.2);
        else if (m.includes(ql)) score = Math.max(score, 1);
      }
      if (score) hits.push({ score, si, wi, w });
    }));
    hits.sort((a, b) => b.score - a.score || a.w[0].length - b.w[0].length);
    box.innerHTML = ""; box.hidden = false;
    // lesson titles too (e.g. "nihao" or "hello" finds Lesson 1 你好)
    ALL.forEach((s, si) => {
      if (s[0] === "A") return;
      const hit = isZh ? s[1].includes(raw) : (plain(s[1]) === q || (q.length > 2 && s[2].toLowerCase().includes(ql)) || ALL[si][3].map(w => plain(w[1])).join("").startsWith(q) && q.length > 3);
      if (!hit) return;
      const b = document.createElement("button"); b.className = "hit lesson";
      b.innerHTML = '<span class="hz"></span><span class="hp"></span><span class="hm"></span><span class="hl"></span>';
      b.children[0].textContent = s[0][0] === "H" ? "作" : s[0][0] === "C" || s[0] === "M" ? "课" : s[0];
      b.children[1].textContent = s[1]; b.children[2].textContent = s[2]; b.children[3].textContent = "Lesson";
      b.onclick = () => { setIdx = si; wordIdx = 0; charIdx = 0; store.set("set", si); $("q").value = ""; box.hidden = true; renderAll(); };
      box.appendChild(b);
    });
    if (!hits.length && box.children.length) return;
    if (!hits.length) { box.innerHTML = '<p class="empty">No word found. You can add it in the ＋ Added tab.</p>'; return; }
    hits.slice(0, 30).forEach(h => {
      const b = document.createElement("button");
      b.className = "hit";
      b.innerHTML = '<span class="hz"></span><span class="hp"></span><span class="hm"></span><span class="hl"></span>';
      b.children[0].textContent = h.w[0]; b.children[1].textContent = h.w[1];
      b.children[2].textContent = h.w[2]; b.children[3].textContent = setName(ALL[h.si]);
      b.onclick = () => {
        setIdx = h.si; wordIdx = h.wi; charIdx = 0; store.set("set", h.si);
        $("q").value = ""; box.hidden = true; renderAll();
        $("practice").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      box.appendChild(b);
    });
  }
  $("q").addEventListener("input", doSearch);
  $("q").addEventListener("keydown", e => { if (e.key === "Escape") { $("q").value = ""; doSearch(); } });

  /* ---- Tabs ---- */
  function showTab(t) {
    curTab = t;
    store.set("tab", t);
    const map = { b: ["tBasics", "paneB"], p: ["tPractice", "paneP"], u: ["tUse", "paneU"], a: ["tAssign", "paneA"] };
    Object.entries(map).forEach(([k, [tab, pane]]) => { $(tab).setAttribute("aria-selected", String(k === t)); $(pane).hidden = k !== t; });
    $("tipsP").hidden = t !== "p";
    window.scrollTo(0, 0);
    if (t !== "b" && window.CSBasics && CSBasics.stop) CSBasics.stop();
    if (t === "a" && window.CSAssign) try { CSAssign.render(); } catch (e) {}
    if (t !== "p" && typeof repStop === "function") repStop(true);
    if (t === "p" && writer) loadChar(cur());
  }
  let curTab = null;
  function userTab(t) {
    const prev = curTab;
    // tapping the tab you are already on takes you to its start
    if (prev === t) {
      if (t === "b" && window.CSBasics) return CSBasics.home();
      if (t === "u" && window.CSUse) return CSUse.home();
      return window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (prev && prev !== t && window.CSNav) CSNav.push(() => showTab(prev), "tab");
    showTab(t);
  }
  $("tPractice").onclick = () => userTab("p");
  $("tAssign").onclick = () => userTab("a");
  $("tBasics").onclick = () => userTab("b");
  $("tUse").onclick = () => userTab("u");
  window.CS = { say: (text, btn) => play(text, false, btn) };
  // open a list (and a word in it) in the Write tab – used by Homework
  window.CSWrite = {
    open(setId, word) {
      const si = ALL.findIndex(s => s[0] === setId); if (si < 0) return false;
      setIdx = si; store.set("set", si);
      const wi = word ? ALL[si][3].findIndex(w => w[0] === word) : 0; wordIdx = Math.max(0, wi); charIdx = 0;
      userTab("p"); renderAll();
      setTimeout(() => { const pr = $("practice"); if (pr) pr.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
      return true;
    }
  };

  /* ---- Add your own words ---- */
  function saveCustom() { store.set("customWords", customWords); store.set("customData", customData); }
  function msg(t, cls) { const m = $("addmsg"); m.textContent = t; m.className = "hint" + (cls ? " " + cls : ""); }
  // Download stroke data for any missing characters, then add the word to Added.
  async function addWord(z, p, m, say2) {
    const han = [...new Set([...z].filter(isHan))];
    if (!han.length) { say2("Type at least one Chinese character.", "bad"); return false; }
    const need = han.filter(c => !charData(c));
    if (need.length) {
      say2("Downloading strokes for " + need.join(" ") + "…");
      const failed = [];
      for (const c of need) {
        try {
          const r = await fetch(DATA_URL(c));
          if (!r.ok) throw new Error(r.status);
          const d = await r.json();
          customData[c] = { strokes: d.strokes, medians: d.medians, radStrokes: d.radStrokes || [] };
        } catch (err) { failed.push(c); }
      }
      if (failed.length) {
        say2(navigator.onLine === false ? "You're offline. Connect to the internet once to add new characters." :
          "No stroke data found for " + failed.join(" ") + ". Check the characters and try again.", "bad");
        return false;
      }
    }
    let i = customWords.findIndex(w => w[0] === z);
    if (i < 0) { customWords.push([z, p || "", m || ""]); i = customWords.length - 1; }
    saveCustom();
    setIdx = ALL.length - 1; wordIdx = i; charIdx = 0; store.set("set", setIdx);
    renderAll();
    return true;
  }
  $("addform").addEventListener("submit", async e => {
    e.preventDefault();
    const z = $("fz").value.trim();
    if (await addWord(z, $("fp").value.trim(), $("fm").value.trim(), msg)) { $("addform").reset(); msg("Added " + z + ".", "good"); }
  });
  $("anyForm").addEventListener("submit", async e => {
    e.preventDefault();
    const z = $("anyIn").value.replace(/\s+/g, "");
    const m = (t, cls) => { $("anyMsg").textContent = t; $("anyMsg").className = "hint" + (cls ? " " + cls : ""); };
    // already in a lesson? jump there
    for (let si = 0; si < ALL.length; si++) { const wi = ALL[si][3].findIndex(w => w[0] === z); if (wi >= 0) { setIdx = si; wordIdx = wi; charIdx = 0; renderAll(); m("Found in " + (ALL[si][0] === "A" ? "your Added words" : "Lesson " + ALL[si][0]) + ".", "good"); $("practice").scrollIntoView({ behavior: "smooth" }); return; } }
    if (await addWord(z, "", "", m)) { m("Ready – " + z + " is saved in ＋ Added.", "good"); $("anyIn").value = ""; $("practice").scrollIntoView({ behavior: "smooth" }); }
  });
  $("bDel").onclick = () => {
    if (ALL[setIdx][0] !== "A" || !customWords.length) return;
    const b = $("bDel");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap again to remove"; setTimeout(() => { b.dataset.confirm = ""; b.textContent = "Remove this word"; }, 3000); return; }
    b.dataset.confirm = ""; b.textContent = "Remove this word";
    customWords.splice(wordIdx, 1);
    saveCustom();
    wordIdx = Math.max(0, wordIdx - 1); charIdx = 0;
    renderWords(); renderWord();
  };

  /* ---- Resize / theme ---- */
  let lastW = 0;
  window.addEventListener("resize", () => {
    const w = $("box").clientWidth;
    if (Math.abs(w - lastW) > 8 && writer) { lastW = w; loadChar(cur()); }
  });
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (writer) loadChar(cur()); }); } catch (e) {}

  /* ---- Install as app ---- */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("bInstall").hidden = false; });
  $("bInstall").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("bInstall").hidden = true; };
  if (window.matchMedia("(display-mode: standalone)").matches) $("installtip").hidden = true;
  if ("serviceWorker" in navigator) {
    // when a new version arrives, switch to it at once (so new homework shows for everyone)
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => {}));
  }

  function renderAll() { renderSets(); renderWords(); renderWord(); }
  renderAll();
  lastW = $("box").clientWidth;
  showTab(["a", "b", "u", "p"].includes(store.get("tab", "b")) ? store.get("tab", "b") : "b");
})();
