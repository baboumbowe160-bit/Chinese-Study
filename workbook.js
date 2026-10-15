/* Workbook: the exercises of the HSK Standard Course 1 Workbook, lesson by lesson, made tappable.
   Data: WB (wb-data.js). Drawn inside the Basics tab by basics.js, which passes its helpers in K. */
(function () {
  "use strict";
  const AUDIO_SET = "https://soundcloud.com/user-682871665/sets/hsk-1-workbook-audio-2";
  const MV = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", v: "ǖǘǚǜ" };
  const UNMARK = {}; Object.keys(MV).forEach(v => [...MV[v]].forEach((c, i) => UNMARK[c] = [v, i + 1]));
  // put a tone mark on a plain syllable: mark("hao", 3) -> "hǎo"
  function mark(base, t) {
    base = base.replace(/v/g, "ü");
    if (!t || t > 4) return base;
    const w = base.replace(/ü/g, "v");
    let i = w.search(/[ae]/);
    if (i < 0) i = w.indexOf("ou");
    if (i < 0) { for (let k = w.length - 1; k >= 0; k--) if ("iuov".includes(w[k])) { i = k; break; } }
    if (i < 0) return base;
    return base.slice(0, i) + MV[w[i]][t - 1] + base.slice(i + 1);
  }
  const keyMark = k => mark(k.slice(0, -1), +k.slice(-1));
  // same pinyin with one or two tones changed (wrong answers for "which tones?")
  function toneVariant(py, rnd) {
    const pos = [...py].map((c, i) => (UNMARK[c] ? i : -1)).filter(i => i >= 0);
    if (!pos.length) return py;
    const a = [...py], n = pos.length > 1 && rnd() < 0.5 ? 2 : 1;
    for (const i of pos.slice().sort(() => rnd() - 0.5).slice(0, n)) {
      const [v, t] = UNMARK[a[i]]; let nt = t; while (nt === t) nt = 1 + Math.floor(rnd() * 4);
      a[i] = MV[v][nt - 1];
    }
    return a.join("");
  }

  let K = null, lesson = 1, tok = 0;
  const done = () => K.store.get("wbDone", {});
  function setDone(key, v) { const d = done(); d[key] = v; K.store.set("wbDone", d); }

  function play(py, btn) {
    const u = WB.say[py];
    if (!u || !window.CSAudio) { if (window.CSSay) CSSay(py, btn); return Promise.resolve(); }
    return CSAudio.playSeq(u.map(x => "audio/" + x + ".mp3"), { btn, gap: 0.035 });
  }
  function playKey(k, btn) { return window.CSAudio ? CSAudio.playSeq(["audio/py/" + k + ".mp3"], { btn }) : Promise.resolve(); }
  function sayB(fn, label) { return K.sayBtn(fn, label); }
  function listenBig(fn) { const b = K.el("button", "say wb-listen"); b.innerHTML = K.sayIcon + "Listen"; b.onclick = () => fn(b); return b; }

  // one question with answer buttons; onRight shows extra info
  function choice(box, opts, right, o) {
    o = o || {};
    const g = K.el("div", "wb-ch" + (o.cls ? " " + o.cls : ""));
    let tries = 0;
    opts.forEach(op => {
      const b = K.el("button", "wb-op", op.label != null ? op.label : op);
      if (op.title) b.title = op.title;
      b.onclick = () => {
        if (g.dataset.ok) return;
        const val = op.value != null ? op.value : op;
        if (val === right) {
          b.classList.add("ok"); g.dataset.ok = "1"; if (o.onRight) o.onRight(tries === 0);
        } else { tries++; b.classList.add("no"); b.disabled = true; if (o.onWrong) o.onWrong(); }
      };
      g.append(b);
    });
    box.append(g); return g;
  }
  // score line for a section
  function tracker(card, key, total) {
    const s = K.el("span", "wb-score"); card.querySelector("h3").append(s);
    let got = new Set(done()[key] || []);
    const show = () => { s.textContent = got.size + "/" + total + (got.size >= total ? " ✓" : ""); s.classList.toggle("full", got.size >= total); };
    show();
    return i => { got.add(i); setDone(key, [...got]); show(); paintChips(); };
  }
  function card(sec, n, si) {
    const c = K.el("div", "b-card wb-card");
    const h = K.el("h3", null, sec.title); c.append(h);
    if (sec.ref) c.append(K.el("p", "wb-ref", "Workbook · " + sec.ref));
    return c;
  }
  const hz = s => s.replace(/（ ）/g, "（　）");

  /* ---------- the exercise types ---------- */
  const R = {};
  R.read = (sec, c) => {
    const g = K.el("div", "wb-chips");
    sec.items.forEach(py => { const b = K.el("button", "wb-chip py", py); b.onclick = () => play(py, b); g.append(b); });
    const all = K.el("button", "ghost", "▶ Read them all");
    all.onclick = async () => {
      const my = ++tok; const bs = [...g.children];
      for (let i = 0; i < bs.length && my === tok && all.isConnected; i++) { bs[i].classList.add("hl"); await play(sec.items[i], bs[i]); bs[i].classList.remove("hl"); await new Promise(r => setTimeout(r, 450)); }
    };
    c.append(K.el("p", "hint", "Tap a word to hear it, then say it yourself."), all, g);
  };
  R.guess = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen to each word – it sounds like the English word. Tap the matching picture."));
    sec.items.forEach((it, i) => {
      const q = K.el("div", "wb-q");
      const top = K.el("div", "wb-qt"); top.append(sayB(b => play(it[1], b), "Listen"), K.el("span", "wb-py", it[1]));
      const ans = K.el("span", "wb-ans"); top.append(ans); q.append(top);
      choice(q, K.shuffle(sec.items.map(x => ({ label: x[0], value: x[0], title: x[2] }))), it[0], { cls: "emo", onRight: () => { ans.textContent = it[3] + " · " + it[2]; hit(i); } });
      c.append(q);
    });
  };
  R.initials = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose the first sound (the initial)."));
    sec.items.forEach((fin, i) => {
      const opts = sec.opts[i]; if (!opts || opts.length < 2) return;
      const target = opts[Math.floor(Math.random() * opts.length)];
      const plain = [...fin].map(ch => (UNMARK[ch] ? UNMARK[ch][0] : ch)).join("").replace(/ü/g, "v");
      const t = [...fin].map(ch => (UNMARK[ch] || [0, 0])[1]).find(x => x) || 5;
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => playKey(target + plain + t, b)), K.el("span", "wb-py", "__" + fin));
      choice(q, opts, target, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  R.finals = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose the syllable you hear."));
    sec.items.forEach((ini, i) => {
      const opts = sec.opts[i]; if (!opts || opts.length < 2) return;
      const target = opts[Math.floor(Math.random() * opts.length)];
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => playKey(target, b)));
      choice(q, opts.map(k => ({ label: keyMark(k), value: k })), target, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  R.tones = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose the tone."));
    sec.items.forEach((b0, i) => {
      const base = b0.replace(/ü/g, "v"), t = 1 + Math.floor(Math.random() * 4);
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => playKey(base + t, b)));
      choice(q, [1, 2, 3, 4].map(x => ({ label: mark(base, x), value: x })), t, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  R.dialogues = (sec, c) => {
    c.append(K.el("p", "hint", "Listen, then practise both parts with a classmate."));
    sec.items.forEach((d, i) => {
      const box = K.el("div", "wb-dlg");
      const pa = K.el("button", "ghost wb-mini", "▶ Dialogue " + (i + 1));
      pa.onclick = async () => { for (const [py] of d) { await play(py, pa); await new Promise(r => setTimeout(r, 500)); } };
      box.append(pa);
      d.forEach(([py, zh], k) => {
        const l = K.el("div", "wb-line"); l.append(K.el("b", "wb-who", k ? "B" : "A"));
        const t = K.el("div"); t.append(K.el("div", "u-zh", zh), K.el("div", "u-py", py));
        l.append(t, sayB(b => play(py, b), "Listen")); box.append(l);
      });
      c.append(box);
    });
  };
  R.strokes = (sec, c) => {
    c.append(K.el("p", "hint", "Each stroke appears in the two characters. Tap a character to watch the stroke order and trace it."));
    sec.items.forEach(([s, name, a, b]) => {
      const r = K.el("div", "wb-stk"); r.append(K.el("span", "wb-stk-s", s), K.el("span", "wb-py", name));
      [a, b].forEach(ch => { const t = K.el("button", "wb-tile", ch); t.onclick = () => K.openChar(ch); r.append(t); });
      c.append(r);
    });
  };
  R.write = (sec, c) => {
    c.append(K.el("p", "hint", "Watch the stroke order, trace it, then write each character 18 times in Write."));
    const g = K.el("div", "wb-chips");
    sec.items.forEach(ch => { const t = K.el("button", "wb-tile", ch); t.onclick = () => K.openChar(ch); g.append(t); });
    const w = K.el("button", "primarybtn", "✍ Write them 18× each"); w.onclick = () => window.CSWrite && CSWrite.open("WB", sec.items[0]);
    c.append(g, w);
  };
  R.tf = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Does the word match the picture? (The book's photos are described in words.)"));
    sec.items.forEach(([emo, cap, zh, py, ok], i) => {
      const q = K.el("div", "wb-tf");
      const pic = K.el("div", "wb-pic"); pic.append(K.el("span", "wb-emo", emo), K.el("span", "wb-cap", cap));
      const w = K.el("div", "wb-tfw"); w.append(K.el("span", "u-zh", zh), K.el("span", "u-py", py), sayB(b => play(py, b), "Listen"));
      const ch = K.el("div"); choice(ch, [{ label: "✓ Right", value: true }, { label: "✗ Wrong", value: false }], ok, { cls: "two", onRight: () => hit(i) });
      q.append(pic, w, ch); c.append(q);
    });
  };
  function optionList(c, sec, pics) {
    const ol = K.el("div", "wb-opts");
    sec.options.forEach(o => {
      const r = K.el("div", "wb-optrow"); r.append(K.el("b", "wb-letter", o[0]));
      if (pics) { const p = K.el("div", "wb-pic sm"); p.append(K.el("span", "wb-emo", o[1]), K.el("span", "wb-cap", o[2])); r.append(p); }
      else { const t = K.el("div"); t.append(K.el("div", "u-zh", o[1]), K.el("div", "u-py", o[2])); r.append(t, sayB(b => play(o[2], b), "Listen")); }
      ol.append(r);
    });
    c.append(ol);
  }
  function matchLike(sec, c, key, pics) {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", pics ? "Which picture goes with each sentence?" : "Choose the right answer for each question."));
    optionList(c, sec, pics);
    const ex = sec.example; const e = K.el("p", "wb-ex"); e.textContent = "Example: " + ex[0] + " → " + ex[2]; c.append(e);
    const letters = sec.options.map(o => o[0]);
    sec.items.forEach((it, i) => {
      const q = K.el("div", "wb-q");
      const t = K.el("div", "wb-qt"); const tx = K.el("div"); tx.append(K.el("div", "u-zh", it[0]), K.el("div", "u-py", it[1]));
      t.append(K.el("span", "wb-num", (i + 1) + "."), tx, sayB(b => play(it[1], b), "Listen")); q.append(t);
      choice(q, letters, it[2], { cls: "letters", onRight: () => { hit(i); if (!pics) { const o = sec.options.find(x => x[0] === it[2]); play(o[2]); } } });
      c.append(q);
    });
  }
  R.match = (sec, c, key) => matchLike(sec, c, key, false);
  R.picmatch = (sec, c, key) => matchLike(sec, c, key, true);
  R.fill = (sec, c, key) => {
    const total = sec.groups.reduce((s, g) => s + g.items.length, 0);
    const hit = tracker(c, key, total); let n = 0;
    c.append(K.el("p", "hint", "Choose the word that fills the gap. When you get it right, you hear the whole sentence."));
    sec.groups.forEach(g => {
      const bank = K.el("div", "wb-bank");
      g.bank.forEach(([l, w, p]) => { const b = K.el("button", "wb-bw"); b.append(K.el("b", null, l), " " + w + " ", K.el("small", null, p)); b.onclick = () => play(p, b); bank.append(b); });
      c.append(bank);
      const letters = g.bank.map(b => b[0]);
      g.items.forEach(it => {
        const i = n++; const q = K.el("div", "wb-q");
        const zh = K.el("div", "u-zh"); zh.textContent = hz(it[0]);
        const t = K.el("div", "wb-qt"); const pyd = K.el("div", "u-py", it[1]); const tx = K.el("div"); tx.append(zh, pyd);
        t.append(K.el("span", "wb-num", (i + 1) + "."), tx); q.append(t);
        choice(q, letters, it[2], { cls: "letters", onRight: () => { zh.textContent = it[4]; zh.classList.add("filled"); pyd.textContent = it[3]; hit(i); play(it[3]); t.append(sayB(b => play(it[3], b), "Listen")); } });
        c.append(q);
      });
    });
  };
  R.pairs = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose what you hear."));
    sec.items.forEach((opts, i) => {
      const target = opts[Math.floor(Math.random() * opts.length)];
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => play(target, b)));
      choice(q, opts, target, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  R.wtones = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose the right tone marks."));
    let seed = 7 + lesson; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    sec.items.forEach(([plain, ans], i) => {
      const set = new Set([ans]); let guard = 0;
      while (set.size < 4 && guard++ < 40) set.add(toneVariant(ans, rnd));
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => play(ans, b)), K.el("span", "wb-py plain", plain));
      choice(q, K.shuffle([...set]), ans, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  function sandhi(sec, c, key, ch) {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", ch === "不" ? "不 is bù, but before a 4th tone it changes to bú. Listen and choose." : "一 is yī alone, yì before tones 1–3 and yí before a 4th tone. Listen and choose."));
    sec.items.forEach(([zh, nxt, ans], i) => {
      const q = K.el("div", "wb-q row");
      q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => play(ans + " " + nxt, b)), K.el("span", "u-zh", zh), K.el("span", "wb-py", "__ " + nxt));
      choice(q, ch === "不" ? ["bù", "bú"] : ["yì", "yí"], ans, { onRight: () => hit(i) });
      c.append(q);
    });
  }
  R.bu = (sec, c, key) => sandhi(sec, c, key, "不");
  R.yi = (sec, c, key) => sandhi(sec, c, key, "一");
  R.tri = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Each sentence hides a word of three syllables. Listen, then tap its three syllables."));
    const clean = s => s.toLowerCase().replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, "");
    sec.items.forEach(([sen, ans, zh, en], i) => {
      const q = K.el("div", "wb-q");
      const t = K.el("div", "wb-qt"); t.append(K.el("span", "wb-num", (i + 1) + "."), sayB(b => play(sen, b), "Listen")); q.append(t);
      const want = ans.split(" ").map(clean), toks = sen.split(" ");
      const g = K.el("div", "wb-chips"); const info = K.el("p", "wb-ans"); let sel = [];
      toks.forEach((tk, k) => {
        const b = K.el("button", "wb-chip py", tk);
        b.onclick = () => {
          if (g.dataset.ok) return;
          b.classList.toggle("sel"); sel = [...g.children].map((x, j) => x.classList.contains("sel") ? j : -1).filter(j => j >= 0);
          if (sel.length === 3) {
            const ok = sel[2] - sel[0] === 2 && sel.every((j, m) => clean(toks[j]) === want[m]);
            if (ok) { g.dataset.ok = "1"; sel.forEach(j => g.children[j].classList.add("ok")); info.textContent = zh + " · " + ans + " · " + en; hit(i); play(ans); }
            else { sel.forEach(j => { g.children[j].classList.add("no"); setTimeout(() => g.children[j].classList.remove("no", "sel"), 700); }); sel = []; }
          }
        };
        g.append(b);
      });
      q.append(g, info); c.append(q);
    });
  };
  R.passage = (sec, c) => {
    const h = K.el("div", "wb-ph"); h.append(K.el("div", "u-zh", sec.head[1]), K.el("div", "u-py", sec.head[0] + " · " + sec.head[2])); c.append(h);
    const all = K.el("button", "ghost", "▶ Read it all");
    const lines = sec.lines.map(([py, zh, en]) => {
      const l = K.el("div", "wb-line"); const t = K.el("div"); t.append(K.el("div", "u-zh", zh), K.el("div", "u-py", py), K.el("div", "u-en", en));
      l.append(t, sayB(b => play(py, b), "Listen")); return l;
    });
    all.onclick = async () => { const my = ++tok; for (let i = 0; i < lines.length && my === tok; i++) { lines[i].classList.add("hl"); await play(sec.lines[i][0]); lines[i].classList.remove("hl"); await new Promise(r => setTimeout(r, 600)); } };
    c.append(K.el("p", "hint", "Watch the neutral tones (light, short syllables). Read along, then read it alone."), all, ...lines);
  };
  R.compare = (sec, c) => {
    c.append(K.el("p", "hint", "These characters look alike – spot the difference. Tap one to see its strokes."));
    const g = K.el("div", "wb-cmp");
    for (let i = 0; i < sec.items.length; i += 2) {
      const pair = K.el("div", "wb-pair");
      sec.items.slice(i, i + 2).forEach(([ch, py, m]) => { const t = K.el("button", "wb-big"); t.append(K.el("span", "c", ch), K.el("span", "u-py", py), K.el("span", "u-en", m)); t.onclick = () => K.openChar(ch); pair.append(t); });
      g.append(pair);
    }
    c.append(g);
  };
  R.radgroup = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Which radical (building block) does each character have? Radicals: " + sec.radicals.join("  ")));
    const g = K.el("div", "wb-rg");
    sec.items.forEach(([ch, r], i) => {
      const box = K.el("div", "wb-rc"); const t = K.el("button", "wb-tile", ch); t.onclick = () => K.openChar(ch); box.append(t);
      choice(box, sec.radicals, r, { cls: "rad", onRight: () => hit(i) });
      g.append(box);
    });
    c.append(g);
  };

  /* ---------- page ---------- */
  let chipsBox = null;
  function lessonDone(L) {
    const d = done(); let all = true;
    L.sections.forEach((sec, si) => {
      const tot = sec.type === "fill" ? sec.groups.reduce((s, g) => s + g.items.length, 0) : ["guess", "initials", "finals", "tones", "tf", "match", "picmatch", "pairs", "wtones", "bu", "yi", "tri", "radgroup"].includes(sec.type) ? sec.items.length : 0;
      if (tot && (d[L.n + ":" + si] || []).length < tot) all = false;
    });
    return all;
  }
  function paintChips() {
    if (!chipsBox) return;
    [...chipsBox.children].forEach(b => { const L = WB.lessons.find(x => x.n === +b.dataset.n); if (L) b.classList.toggle("done", lessonDone(L)); });
  }
  function render(p, kit) {
    K = kit; tok++;
    if (!window.WB) { p.append(K.el("p", "hint", "The workbook is loading – try again in a moment.")); return; }
    lesson = K.store.get("wbLesson", 1);
    p.append(K.el("p", "hint", "Exercises from the HSK Standard Course 1 Workbook, made tappable: listen, choose, and get instant feedback. Pick a lesson."));
    const chips = K.el("div", "bk-lessons wb-lessons"); chipsBox = chips;
    WB.lessons.forEach(L => {
      const b = K.el("button", "bk-l" + (L.n === lesson ? " on" : ""), L.test ? "Test" : String(L.n)); b.dataset.n = L.n;
      b.onclick = () => { K.store.set("wbLesson", L.n); K.go("wb"); };
      chips.append(b);
    });
    p.append(chips); paintChips();
    const L = WB.lessons.find(x => x.n === lesson) || WB.lessons[0];
    const head = K.el("div", "b-card wb-head");
    head.append(K.el("h3", null, L.test ? "HSK 1 Model Test – Reading" : "Lesson " + L.n), K.el("p", "hint", L.test ? "The reading half of the model test (questions 21–40). Do it in 15 minutes, like the real exam." : "Workbook page " + L.page + " onwards."));
    const au = K.el("p", "wb-audio");
    au.append(L.n <= 2 ? "🎧 Some sound exercises in your paper workbook use its recording. " : L.test ? "🎧 The listening half (questions 1–20) needs the test recording. " : "🎧 Part 一 (Listening) and some sound exercises need the workbook recording" + " – tracks " + L.n + "-1 and " + L.n + "-2. ");
    const a = K.el("a", null, "Open the HSK 1 Workbook audio ↗"); a.href = AUDIO_SET; a.target = "_blank"; a.rel = "noopener"; au.append(a, " Write those answers in your paper workbook.");
    head.append(au); p.append(head);
    L.sections.forEach((sec, si) => {
      const c = card(sec);
      try { (R[sec.type] || (() => {}))(sec, c, L.n + ":" + si); } catch (e) { console.error(e); }
      p.append(c);
    });
    if (L.newwords && L.newwords.length) {
      const c = K.el("div", "b-card wb-card"); c.append(K.el("h3", null, "New in this workbook lesson"), K.el("p", "hint", "Words and characters from these exercises that are not in your class lists. Tap to practise writing."));
      const list = K.el("div", "bk-list");
      L.newwords.forEach(([w, py, m]) => {
        const r = K.el("div", "u-line"); const t = K.el("button", "u-txt bk-w"); t.onclick = () => window.CSWrite && CSWrite.open("WB", w);
        t.append(K.el("div", "u-zh", w), K.el("div", "u-py", py), K.el("div", "u-en", m));
        r.append(t, sayB(b => window.CSSay && CSSay(w, b), "Listen: " + w)); list.append(r);
      });
      c.append(list); p.append(c);
    }
  }
  window.CSWorkbook = { render, mark };
})();
