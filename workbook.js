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
  const REAL = new Set((window.WB && WB.real) || []);
  // pick a target from the options, preferring real recordings over made-up ones
  const pickReal = (opts, key) => { const r = opts.filter(o => REAL.has(key(o))); const pool = r.length ? r : opts; return pool[Math.floor(Math.random() * pool.length)]; };
  const done = () => K.store.get("wbDone", {});
  function setDone(key, v) { const d = done(); d[key] = v; K.store.set("wbDone", d); }

  // the phone's own Chinese voice reads whole sentences smoothly; the recordings are best for single sounds
  let zhVoice = null;
  function pickVoice() { try { const vs = speechSynthesis.getVoices(); zhVoice = vs.find(v => /^zh[-_]CN/i.test(v.lang)) || vs.find(v => /^cmn/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang) && !/HK|TW|yue/i.test(v.lang)) || null; } catch (e) {} }
  if (window.speechSynthesis) { pickVoice(); try { speechSynthesis.addEventListener("voiceschanged", pickVoice); } catch (e) {} }
  const usePhone = () => !!zhVoice && K.store.get("wbVoice", "rec") === "phone";
  function phoneSay(zh, btn) {
    return new Promise(res => {
      try {
        if (window.CSAudio) CSAudio.stop(); speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(zh.replace(/（\s*）|\( \)/g, "，")); u.lang = "zh-CN"; u.voice = zhVoice; u.rate = 0.8;
        if (btn) btn.classList.add("playing");
        u.onend = u.onerror = () => { if (btn) btn.classList.remove("playing"); res(); };
        speechSynthesis.speak(u);
      } catch (e) { res(); }
    });
  }
  function play(py, btn, zh) {
    if (zh && usePhone()) return phoneSay(zh, btn);
    try { speechSynthesis.cancel(); } catch (e) {}
    const u = WB.say[py];
    if (!u || !window.CSAudio) { if (window.CSSay) CSSay(zh || py, btn); return Promise.resolve(); }
    return CSAudio.playSeq((typeof u === "string" ? [u] : u).map(x => "audio/" + x + ".mp3"), { btn, gap: 0.035 });
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
      const top = K.el("div", "wb-qt"); top.append(sayB(b => play(it[1], b, it[3]), "Listen"), K.el("span", "wb-py", it[1]));
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
      const plain0 = [...fin].map(ch => (UNMARK[ch] ? UNMARK[ch][0] : ch)).join("").replace(/ü/g, "v"), t0 = [...fin].map(ch => (UNMARK[ch] || [0, 0])[1]).find(x => x) || 5;
      const target = pickReal(opts, o => o + plain0 + t0);
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
      const target = pickReal(opts, o => o);
      const q = K.el("div", "wb-q row"); q.append(K.el("span", "wb-num", (i + 1) + "."), listenBig(b => playKey(target, b)));
      choice(q, opts.map(k => ({ label: keyMark(k), value: k })), target, { onRight: () => hit(i) });
      c.append(q);
    });
  };
  R.tones = (sec, c, key) => {
    const hit = tracker(c, key, sec.items.length);
    c.append(K.el("p", "hint", "Listen and choose the tone."));
    sec.items.forEach((b0, i) => {
      const base = b0.replace(/ü/g, "v"), t = pickReal([1, 2, 3, 4], x => base + x);
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
      pa.onclick = async () => { for (const [py, zh] of d) { await play(py, pa, zh); await new Promise(r => setTimeout(r, 500)); } };
      box.append(pa);
      d.forEach(([py, zh], k) => {
        const l = K.el("div", "wb-line"); l.append(K.el("b", "wb-who", k ? "B" : "A"));
        const t = K.el("div"); t.append(K.el("div", "u-zh", zh), K.el("div", "u-py", py));
        l.append(t, sayB(b => play(py, b, zh), "Listen")); box.append(l);
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
      const w = K.el("div", "wb-tfw"); w.append(K.el("span", "u-zh", zh), K.el("span", "u-py", py), sayB(b => play(py, b, zh), "Listen"));
      const ch = K.el("div"); choice(ch, [{ label: "✓ Right", value: true }, { label: "✗ Wrong", value: false }], ok, { cls: "two", onRight: () => hit(i) });
      q.append(pic, w, ch); c.append(q);
    });
  };
  function optionList(c, sec, pics) {
    const ol = K.el("div", "wb-opts");
    sec.options.forEach(o => {
      const r = K.el("div", "wb-optrow"); r.append(K.el("b", "wb-letter", o[0]));
      if (pics) { const p = K.el("div", "wb-pic sm"); p.append(K.el("span", "wb-emo", o[1]), K.el("span", "wb-cap", o[2])); r.append(p); }
      else { const t = K.el("div"); t.append(K.el("div", "u-zh", o[1]), K.el("div", "u-py", o[2])); r.append(t, sayB(b => play(o[2], b, o[1]), "Listen")); }
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
      t.append(K.el("span", "wb-num", (i + 1) + "."), tx, sayB(b => play(it[1], b, it[0]), "Listen")); q.append(t);
      choice(q, letters, it[2], { cls: "letters", onRight: () => { hit(i); if (!pics) { const o = sec.options.find(x => x[0] === it[2]); play(o[2], null, o[1]); } } });
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
      g.bank.forEach(([l, w, p]) => { const b = K.el("button", "wb-bw"); b.append(K.el("b", null, l), " " + w + " ", K.el("small", null, p)); b.onclick = () => play(p, b, w.replace(/……/g, "")); bank.append(b); });
      c.append(bank);
      const letters = g.bank.map(b => b[0]);
      g.items.forEach(it => {
        const i = n++; const q = K.el("div", "wb-q");
        const zh = K.el("div", "u-zh"); zh.textContent = hz(it[0]);
        const t = K.el("div", "wb-qt"); const pyd = K.el("div", "u-py", it[1]); const tx = K.el("div"); tx.append(zh, pyd);
        t.append(K.el("span", "wb-num", (i + 1) + "."), tx); q.append(t);
        choice(q, letters, it[2], { cls: "letters", onRight: () => { zh.textContent = it[4]; zh.classList.add("filled"); pyd.textContent = it[3]; hit(i); play(it[3], null, it[4]); t.append(sayB(b => play(it[3], b, it[4]), "Listen")); } });
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
      const t = K.el("div", "wb-qt"); t.append(K.el("span", "wb-num", (i + 1) + "."), sayB(b => play(sen, b, sec.items[i][4]), "Listen")); q.append(t);
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
      l.append(t, sayB(b => play(py, b, zh), "Listen")); return l;
    });
    all.onclick = async () => { const my = ++tok; for (let i = 0; i < lines.length && my === tok; i++) { lines[i].classList.add("hl"); await play(sec.lines[i][0], null, sec.lines[i][1]); lines[i].classList.remove("hl"); await new Promise(r => setTimeout(r, 600)); } };
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
  // plain-English name and "what to do" for every kind of exercise
  const HOW = {
    read: ["Listen and repeat", "Tap a word to hear it, then say it out loud yourself. “Read them all” plays every word in order."],
    guess: ["Guess the borrowed word", "These Chinese words sound like English words. Tap 🔊, listen, then tap the picture that matches."],
    initials: ["Which first sound?", "Tap Listen. The end of the syllable is shown (for example __āi). Tap the letter it starts with."],
    finals: ["Which syllable?", "Tap Listen, then tap the syllable you heard."],
    tones: ["Which tone?", "Tap Listen, then tap the tone you heard: ā = high and flat · á = rising · ǎ = low, dipping · à = falling."],
    dialogues: ["Mini dialogues", "Tap 🔊 to hear each line. Then practise with a partner: one person is A, the other is B."],
    strokes: ["Learn the strokes", "Each row shows one stroke and its name. Tap a character to watch it being written and find that stroke."],
    write: ["Write the characters", "Tap a character to watch its stroke order and trace it. Then tap “Write them 18× each”."],
    tf: ["Right or wrong?", "Each picture from the book is shown with emoji and a short description. Is the Chinese word the right name for it? Tap ✓ Right or ✗ Wrong."],
    match: ["Question and answer", "The box shows answers A–F. Read each question below, then tap the letter of its answer."],
    picmatch: ["Sentence and picture", "Read each sentence, then tap the letter of the picture that matches it."],
    fill: ["Fill the gap", "Each sentence has a gap (　). The yellow box shows the words. Tap the letter of the word that fits the gap."],
    pairs: ["What did you hear?", "Tap Listen, then tap the word you heard."],
    wtones: ["Add the tone marks", "The word is shown without tone marks. Tap Listen, then tap the spelling with the right tone marks."],
    bu: ["不 bù or bú?", "不 is said bù, but before a 4th-tone word (like 是 shì) it becomes bú. Listen and tap the right one."],
    yi: ["一 yì or yí?", "Before a 4th tone 一 is said yí; before tones 1, 2 and 3 it is said yì. Listen and tap the right one."],
    tri: ["Find the 3-syllable word", "Tap 🔊 to hear the sentence. One word in it has three syllables (like xīng qī wǔ, Friday). Tap those three syllables."],
    passage: ["Read along", "Tap ▶ on a line to hear it. Read along with it, then try reading the whole text alone."],
    compare: ["Spot the difference", "These characters look alike. Tap each one to see how it is written and what it means."],
    radgroup: ["Find the building block", "Most characters are built from parts. Look at each character and tap the part (radical) you can see in it."],
  };
  const scored = sec => sec.type === "fill" ? sec.groups.reduce((s, g) => s + g.items.length, 0) : ["guess", "initials", "finals", "tones", "tf", "match", "picmatch", "pairs", "wtones", "bu", "yi", "tri", "radgroup"].includes(sec.type) ? sec.items.length : 0;
  function render(p, kit) {
    K = kit; tok++;
    if (!window.WB) { p.append(K.el("p", "hint", "The workbook is loading – try again in a moment.")); return; }
    lesson = K.store.get("wbLesson", 1);
    const L = WB.lessons.find(x => x.n === lesson) || WB.lessons[0];
    const ex = K.store.get("wbEx", -1);   // -1: the lesson's list of exercises; otherwise one exercise
    const goEx = i => { K.store.set("wbEx", i); K.go("wb"); };
    if (ex < 0) {
      const intro = K.el("div", "b-card wb-intro");
      intro.append(K.el("h3", null, "How it works"));
      const ol = K.el("ol", "wb-steps");
      ["Choose your lesson number.", "Tap an exercise. It opens on its own page with simple instructions.", "Answer by tapping. Green = right, red = try again. Your score is saved."].forEach(t => ol.append(K.el("li", null, t)));
      intro.append(ol); p.append(intro);
      p.append(K.el("p", "label", "Lesson"));
      const chips = K.el("div", "bk-lessons wb-lessons"); chipsBox = chips;
      WB.lessons.forEach(x => {
        const b = K.el("button", "bk-l" + (x.n === lesson ? " on" : ""), x.test ? "Test" : String(x.n)); b.dataset.n = x.n;
        b.onclick = () => { K.store.set("wbLesson", x.n); K.store.set("wbEx", -1); K.go("wb"); };
        chips.append(b);
      });
      p.append(chips); paintChips();
      const head = K.el("div", "b-card wb-head");
      head.append(K.el("h3", null, L.test ? "HSK 1 Model Test – Reading" : "Lesson " + L.n + " · " + L.sections.length + " exercises"),
        K.el("p", "hint", L.test ? "The reading half of the model test (questions 21–40). Try to finish in 15 minutes, like the real exam." : "From workbook page " + L.page + "."));
      const list = K.el("div", "wb-toc"); const d = done();
      L.sections.forEach((sec, si) => {
        const tot = scored(sec), got = (d[L.n + ":" + si] || []).length;
        const b = K.el("button", "wb-tocb" + (tot && got >= tot ? " full" : ""));
        b.append(K.el("span", "wb-tocn", String(si + 1)));
        const t = K.el("span", "wb-toct"); t.append(K.el("b", null, (HOW[sec.type] || [sec.title])[0]), K.el("small", null, sec.title));
        b.append(t, K.el("span", "wb-tocs", tot ? (got >= tot ? "✓ " : "") + got + "/" + tot : "›"));
        b.onclick = () => goEx(si); list.append(b);
      });
      if (L.newwords && L.newwords.length) {
        const b = K.el("button", "wb-tocb"); b.append(K.el("span", "wb-tocn", "+"));
        const t = K.el("span", "wb-toct"); t.append(K.el("b", null, "New words"), K.el("small", null, L.newwords.length + " words from these exercises that are not in your class lists"));
        b.append(t, K.el("span", "wb-tocs", "›")); b.onclick = () => goEx(L.sections.length); list.append(b);
      }
      head.append(list);
      const au = K.el("p", "wb-audio");
      au.append(L.test ? "🎧 Questions 1–20 (listening) need the test recording. " : L.n <= 2 ? "🎧 A few exercises in your paper workbook need its recording. " : "🎧 Part 一 (Listening) in your paper workbook needs its recording – tracks " + L.n + "-1 and " + L.n + "-2. ");
      const a = K.el("a", null, "Open the workbook audio ↗"); a.href = AUDIO_SET; a.target = "_blank"; a.rel = "noopener"; au.append(a);
      head.append(au); p.append(head);
      return;
    }
    // one exercise on its own page
    const nav = K.el("div", "wb-nav");
    const back = K.el("button", "ghost", "‹ Lesson " + (L.test ? "Test" : L.n) + " exercises"); back.onclick = () => goEx(-1);
    nav.append(back, K.el("span", "wb-pos", "Exercise " + Math.min(ex + 1, L.sections.length + 1) + " of " + (L.sections.length + (L.newwords && L.newwords.length ? 1 : 0))));
    p.append(nav);
    if (ex >= L.sections.length) {
      const c = K.el("div", "b-card wb-card"); c.append(K.el("h3", null, "New words"), K.el("p", "wb-how", "These words come from the exercises but are not in your class word lists. Tap 🔊 to hear one, tap the word to practise writing it."));
      const list = K.el("div", "bk-list");
      (L.newwords || []).forEach(([w, py, m]) => {
        const r = K.el("div", "u-line"); const t = K.el("button", "u-txt bk-w"); t.onclick = () => window.CSWrite && CSWrite.open("WB", w);
        t.append(K.el("div", "u-zh", w), K.el("div", "u-py", py), K.el("div", "u-en", m));
        r.append(t, sayB(b => window.CSSay && CSSay(w, b), "Listen: " + w)); list.append(r);
      });
      c.append(list); p.append(c);
    } else {
      const sec = L.sections[ex], how = HOW[sec.type] || [sec.title, ""];
      const c = K.el("div", "b-card wb-card");
      c.append(K.el("h3", null, how[0]));
      const hw = K.el("div", "wb-how"); hw.append(K.el("b", null, "What to do: "), how[1]); c.append(hw);
      c.append(K.el("p", "wb-ref", "Workbook: " + sec.title + (sec.ref ? " · " + sec.ref : "")));
      if (zhVoice && ["dialogues", "match", "fill", "tf", "passage", "tri", "picmatch", "guess"].includes(sec.type)) {
        const vt = K.el("div", "wb-voice"); vt.append(K.el("span", null, "Voice for sentences:"));
        [["rec", "🎙 Recorded voice"], ["phone", "📱 My phone’s voice"]].forEach(([v, t]) => {
          const b = K.el("button", "wb-vb" + (K.store.get("wbVoice", "rec") === v ? " on" : ""), t);
          b.onclick = () => { K.store.set("wbVoice", v); [...vt.querySelectorAll("button")].forEach(x => x.classList.toggle("on", x === b)); };
          vt.append(b);
        });
        c.append(vt);
      }
      try { (R[sec.type] || (() => {}))(sec, c, L.n + ":" + ex); } catch (e) { console.error(e); }
      c.querySelectorAll(":scope > .hint").forEach(h => h.remove());   // the "What to do" box replaces the old one-line hints
      p.append(c);
    }
    const nx = K.el("div", "wb-nav bottom");
    const pv = K.el("button", "ghost", "‹ Previous"); pv.disabled = ex === 0; pv.onclick = () => goEx(ex - 1);
    const last = L.sections.length - (L.newwords && L.newwords.length ? 0 : 1);
    const nn = K.el("button", "primarybtn", ex >= last ? "Back to the list" : "Next exercise ›"); nn.onclick = () => goEx(ex >= last ? -1 : ex + 1);
    nx.append(pv, nn); p.append(nx);
  }
  window.CSWorkbook = { render, mark };
})();
