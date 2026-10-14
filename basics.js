/* Basics: sounds, numbers, strokes, radicals, picture characters and games. Uses BASICS, BSTROKES (basics-data.js). */
(function () {
  "use strict";
  const B = window.BASICS; if (!B) return;
  if (window.BPLUS) {
    B.picto = BPLUS.picto; B.point = BPLUS.point; B.ideas = B.ideas.concat(BPLUS.ideasMore);
    Object.assign(B.audio, BPLUS.audio); window.BSTROKES = Object.assign(window.BSTROKES || {}, BPLUS.strokes);
  }
  // Hand-drawn sketch of the picture behind a character (paths in a 100×100 box; "F:" = filled shape).
  function sketch(paths, cls) {
    const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 100 100"); s.setAttribute("class", "sketch" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true");
    (paths || []).forEach(d => { const p = document.createElementNS(ns, "path"); const fill = d.startsWith("F:"); p.setAttribute("d", fill ? d.slice(2) : d); if (fill) p.setAttribute("class", "f"); s.appendChild(p); });
    return s;
  }
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const strokeData = c => (window.BSTROKES && BSTROKES[c]) || (window.DATA && DATA[c]) || null;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickN = (arr, n, not) => shuffle(arr.filter(x => x !== not)).slice(0, n);

  /* ---------- audio ---------- */
  const player = new Audio();
  let seqToken = 0;
  function clip(key) { const r = B.audio[key]; return r ? "audio/" + r + ".mp3" : null; }
  function playSrc(src, btn) {
    return new Promise(res => {
      if (!src) return res(false);
      player.src = src; player.playbackRate = 1;
      if (btn) btn.classList.add("playing");
      const done = ok => { if (btn) btn.classList.remove("playing"); res(ok); };
      player.onended = () => done(true); player.onerror = () => done(false);
      const p = player.play(); if (p && p.catch) p.catch(() => done(false));
    });
  }
  function ttsSay(text) {
    try {
      const s = window.speechSynthesis; if (!s) return;
      s.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.85; s.speak(u);
    } catch (e) {}
  }
  async function sayChar(c, btn) {
    const src = clip(c);
    if (src) { if (!(await playSrc(src, btn))) ttsSay(c); } else ttsSay(c);
  }
  async function saySeq(chars, btn) {
    const my = ++seqToken;
    if (btn) btn.classList.add("playing");
    for (const c of chars) {
      if (my !== seqToken) break;
      const src = clip(c);
      if (!src) { ttsSay(chars.join("")); break; }
      await playSrc(src);
    }
    if (btn) btn.classList.remove("playing");
  }
  const sayIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
  function sayBtn(onclick, label) {
    const b = el("button", "say mini"); b.innerHTML = sayIcon; b.setAttribute("aria-label", label || "Listen");
    b.onclick = e => { e.stopPropagation(); onclick(b); }; return b;
  }

  /* ---------- character sheet (bottom panel) ---------- */
  let sheetWriter = null;
  function openSheet(o) {
    // o: {c, py, mean, story, extra(Node), forms}
    const sh = $("bsheet"), body = $("bsheetBody"); body.innerHTML = "";
    const top = el("div", "sh-top");
    const big = el("div", "sh-big"); const grid = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    grid.setAttribute("viewBox", "0 0 100 100"); grid.setAttribute("class", "grid"); grid.setAttribute("preserveAspectRatio", "none");
    grid.innerHTML = '<line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/>';
    const w = el("div", "sh-w"); big.append(grid, w);
    const info = el("div", "sh-info");
    info.append(el("div", "sh-py", o.py || ""), el("div", "sh-mean", o.mean || ""));
    if (o.forms) info.append(el("div", "sh-forms", o.forms));
    const row = el("div", "sh-btns");
    const bS = el("button", "say"); bS.innerHTML = sayIcon + "Listen"; bS.onclick = () => (o.sayChars ? saySeq(o.sayChars, bS) : sayChar(o.c, bS));
    row.append(bS);
    const data = strokeData(o.c);
    if (data && window.HanziWriter) {
      const bW = el("button", "ghost", "▶ Watch"), bT = el("button", "ghost", "✍ Trace");
      row.append(bW, bT);
      const size = Math.min(200, Math.round(window.innerWidth * 0.42));
      big.style.width = big.style.height = size + "px";
      sheetWriter = HanziWriter.create(w, o.c, {
        width: size, height: size, padding: 10, strokeColor: tok("--ink"), radicalColor: tok("--seal"), outlineColor: tok("--outline"),
        highlightColor: tok("--seal"), drawingColor: tok("--seal"), drawingWidth: 8, strokeAnimationSpeed: 0.9, delayBetweenStrokes: 350,
        leniency: 1.4, showHintAfterMisses: 2, charDataLoader: (ch, done) => done(strokeData(ch))
      });
      bW.onclick = () => { sheetWriter.cancelQuiz(); sheetWriter.showOutline(); sheetWriter.animateCharacter(); };
      bT.onclick = () => { sheetWriter.hideCharacter(); sheetWriter.showOutline(); sheetWriter.quiz({ onComplete: d => { bT.textContent = d.totalMistakes ? "✍ Again (" + d.totalMistakes + " mistakes)" : "✓ Perfect!"; } }); };
      setTimeout(() => sheetWriter && sheetWriter.animateCharacter(), 350);
    } else {
      big.classList.add("plain"); w.textContent = o.c; sheetWriter = null;
    }
    info.append(row);
    if (o.art) {
      const pair = el("div", "sh-pair"); const a = el("div", "sh-art"); a.append(sketch(o.art)); if (o.emo) a.append(el("span", "emo-badge", o.emo));
      a.append(el("span", "sh-cap", "the picture"));
      pair.append(a, el("span", "sh-arrow", "→"), big); top.append(pair, info);
    } else top.append(big, info);
    body.append(top);
    if (o.story) { const s = el("p", "sh-story"); s.textContent = o.story; body.append(s); }
    if (o.extra) body.append(o.extra);
    if (sh.hidden && window.CSNav) sheetTok = CSNav.push(closeSheet);
    sh.hidden = false; document.body.classList.add("noscroll");
    $("bsheetClose").focus();
  }
  let sheetTok = null;
  const userCloseSheet = () => { if (!(window.CSNav && CSNav.done(sheetTok))) closeSheet(); };
  function closeSheet() { $("bsheet").hidden = true; document.body.classList.remove("noscroll"); sheetWriter = null; $("bsheetBody").innerHTML = ""; }
  $("bsheetClose").onclick = userCloseSheet;
  $("bsheet").addEventListener("click", e => { if (e.target === $("bsheet")) userCloseSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("bsheet").hidden) userCloseSheet(); });

  /* ---------- hub & navigation ---------- */
  const SECTIONS = [
    ["sounds", "拼", "Sounds", "Pinyin letters & the 4 tones"],
    ["numbers", "数", "Numbers", "零 to 万 – and how to say any number"],
    ["lucky", "吉", "Numbers with meaning", "520 = I love you · lucky 8 · red envelopes 🧧"],
    ["strokes", "笔", "Strokes", "The basic strokes & the order rules"],
    ["radicals", "部", "Radicals", "All 214 building blocks, with origins"],
    ["pictures", "象", "Picture characters", B.picto.length + " drawings that became characters"],
    ["phrases", "说", "Useful phrases", "Classroom and everyday sentences"],
    ["qwords", "问", "Question & measure words", "什么, 谁, 哪儿, 几 … and 个, 本, 口"],
    ["rhymes", "诗", "Rhymes & poems", "Famous children's rhymes, poems 🎵 and tongue twisters"],
    ["games", "玩", "Games", "6 games: tones, numbers, codes, radicals, pictures"],
  ];
  function hub() {
    const p = $("bpane"); p.innerHTML = "";
    const intro = el("div", "b-intro");
    intro.append(el("h2", null, "Chinese from zero"), el("p", null, "Chinese has no alphabet. Each character is a syllable with a meaning, built from strokes and smaller parts. Start with the sounds, then learn how characters are built."));
    p.append(intro);
    // character of the day – a picture character that changes every day
    const now = new Date(), day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const [c, py, m, emo, story, art] = B.picto[day % B.picto.length];
    const cod = el("button", "cod"); cod.setAttribute("aria-label", "Character of the day: " + c + " " + py + ", " + m);
    const left = el("div", "cod-art"); left.append(sketch(art), el("span", "emo-badge", emo));
    const mid = el("div", "cod-t"); mid.append(el("span", "cod-l", "Character of the day"), el("span", "cod-c", c), el("span", "cod-m", py + " · " + m));
    cod.append(left, mid); cod.onclick = () => openSheet({ c, py, mean: m + "  " + emo, story, art, emo });
    p.append(cod);
    const g = el("div", "b-hub");
    SECTIONS.forEach(([id, ch, name, sub], i) => {
      const b = el("button", "b-tile t" + i);
      const s = el("span", "b-tch", ch); const t = el("span", "b-tname", name); const d = el("span", "b-tsub", sub);
      b.append(s, t, d); b.onclick = () => go(id); g.append(b);
    });
    p.append(g);
  }
  const SHORT = { sounds: "Sounds", numbers: "Numbers", lucky: "Lucky numbers", strokes: "Strokes", radicals: "Radicals", pictures: "Pictures", phrases: "Phrases", qwords: "Questions", rhymes: "Rhymes", games: "Games" };
  function header(title, zh) {
    const wrap = el("div", "b-head");
    const h = el("div", "b-headrow");
    const back = el("button", "ghost b-back", "‹ All topics"); back.onclick = () => go("hub");
    const t = el("h2", null); t.innerHTML = '<span class="b-hz"></span>'; t.firstChild.textContent = zh; t.append(" " + title);
    h.append(back, t);
    // jump straight to any other topic
    const bar = el("div", "topicbar"); bar.setAttribute("role", "navigation"); bar.setAttribute("aria-label", "Topics");
    SECTIONS.forEach(([id, ch]) => {
      const b = el("button", "tb" + (id === curSec ? " on" : "")); b.append(el("span", "tb-z", ch), " " + (SHORT[id] || id));
      if (id === curSec) b.setAttribute("aria-current", "page");
      b.onclick = () => go(id); bar.append(b);
    });
    wrap.append(h, bar);
    setTimeout(() => { const on = bar.querySelector(".on"); if (on) bar.scrollLeft = on.offsetLeft - bar.clientWidth / 2 + on.clientWidth / 2; }, 0);
    return wrap;
  }
  // previous / next topic at the bottom of every page
  function footer(id) {
    const i = SECTIONS.findIndex(s => s[0] === id); if (i < 0) return;
    const f = el("div", "b-foot");
    const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
    const pb = el("button", "ghost"); pb.innerHTML = "<small>‹ Previous</small>"; pb.append(el("b", null, prev ? prev[1] + " " + SHORT[prev[0]] : "All topics")); pb.onclick = () => go(prev ? prev[0] : "hub");
    const nb = el("button", "ghost next"); nb.innerHTML = "<small>Next ›</small>"; nb.append(el("b", null, next ? next[1] + " " + SHORT[next[0]] : "All topics")); nb.onclick = () => go(next ? next[0] : "hub");
    f.append(pb, nb); $("bpane").append(f);
  }
  let curSec = "hub", secTok = null;
  function go(id) {
    // Back from any topic goes straight to the topic list (no retracing every step)
    if (id !== curSec && window.CSNav && !CSNav.restoring) {
      if (id === "hub") { if (CSNav.done(secTok)) return; }
      else secTok = CSNav.push(() => go("hub"), "bsec");
    }
    curSec = id; if (typeof chantStop === "function") chantStop();
    store.set("bsec", id); seqToken++;
    const p = $("bpane"); p.innerHTML = "";
    ({ hub, sounds, numbers, lucky, strokes, radicals, pictures, phrases, qwords, rhymes, games }[id] || hub)();
    if (id !== "hub") footer(id);
    window.scrollTo(0, 0);
  }

  /* ---------- 1. Sounds ---------- */
  function toneSvg(t) {
    const paths = { 1: "M8 12 H52", 2: "M8 34 L52 10", 3: "M8 22 L28 40 L52 14", 4: "M8 8 L52 40" };
    return '<svg viewBox="0 0 60 48" class="tsvg" aria-hidden="true"><line x1="4" y1="8" x2="56" y2="8"/><line x1="4" y1="24" x2="56" y2="24"/><line x1="4" y1="40" x2="56" y2="40"/>' + (paths[t] ? '<path d="' + paths[t] + '"/>' : '<circle cx="30" cy="30" r="4"/>') + "</svg>";
  }
  function sounds() {
    const p = $("bpane"); p.append(header("Sounds (pinyin)", "拼"));
    const intro = el("div", "b-card");
    intro.innerHTML = "<p><b>Pinyin</b> (拼音, “spelled sounds”) uses Latin letters to show how characters are pronounced. It was created in China in the 1950s by a team led by Zhou Youguang, so that everyone could learn to read faster. Chinese children learn it first – and so will you.</p><p>Every syllable has 3 parts: <b>initial</b> (start sound) + <b>final</b> (end sound) + <b>tone</b>. Example: <b>m</b> + <b>a</b> + <b>ˇ</b> = <b>mǎ</b> 马 (horse).</p>";
    p.append(intro);
    // tones
    const tc = el("div", "b-card"); tc.append(el("h3", null, "The 4 tones – tap to hear"));
    tc.append(el("p", "hint", "The tone changes the meaning! Same sound “ma”, four different words:"));
    const tg = el("div", "tones");
    [[1, "mā", "妈", "mother", "high & flat – like singing a long note"], [2, "má", "麻", "hemp", "rising – like asking “what?”"], [3, "mǎ", "马", "horse", "low, dips then rises"], [4, "mà", "骂", "to scold", "sharp fall – like “Stop!”"], [5, "ma", "吗", "question word", "neutral: short and light"]].forEach(([t, py, c, m, how]) => {
      const b = el("button", "tone t" + t);
      b.innerHTML = toneSvg(t) + '<span class="tpy"></span><span class="tzh"></span><span class="tm"></span><span class="thow"></span>';
      b.querySelector(".tpy").textContent = py; b.querySelector(".tzh").textContent = c; b.querySelector(".tm").textContent = m; b.querySelector(".thow").textContent = how;
      b.onclick = () => { tg.querySelectorAll(".on").forEach(x => x.classList.remove("on")); b.classList.add("on"); t === 5 ? sayChar("吗", b) : playSrc(clip("@ma" + t), b); };
      tg.append(b);
    });
    tc.append(tg);
    tc.append(el("p", "hint", "Tip: draw the tone shape in the air with your hand while you say it."));
    p.append(tc);
    // initials & finals
    [["Initials – the start sounds", B.initials, "21 initials, plus y and w. Tap each to hear it with a vowel (the way Chinese children learn: bō pō mō fō…)."],
     ["Finals – the end sounds", B.finals, "Finals are the vowel part. Tap to hear each one."]].forEach(([title, list, note]) => {
      const c = el("div", "b-card"); c.append(el("h3", null, title), el("p", "hint", note));
      const g = el("div", "letters"); const tip = el("p", "lettertip", "Tap a letter to hear it.");
      list.forEach(([l, syl, py, how]) => {
        const b = el("button", "letter"); b.innerHTML = '<span class="ll"></span><span class="lp"></span>';
        b.firstChild.textContent = l; b.lastChild.textContent = py;
        b.onclick = () => { g.querySelectorAll(".on").forEach(x => x.classList.remove("on")); b.classList.add("on"); tip.innerHTML = "<b></b> – "; tip.firstChild.textContent = l + " (" + py + ")"; tip.append(how); playSrc(clip("@" + syl), b); };
        g.append(b);
      });
      c.append(g, tip); p.append(c);
    });
    const rules = el("div", "b-card");
    rules.innerHTML = "<h3>Tone changes to remember</h3><ul><li><b>3rd + 3rd → 2nd + 3rd.</b> 你好 is written nǐ hǎo but said <b>ní hǎo</b>.</li><li><b>不 bù → bú</b> before a 4th tone: 不是 bú shì, 不客气 bú kèqi.</li><li><b>一 yī → yí</b> before a 4th tone (一个 yí ge), <b>yì</b> before tones 1–3 (一本 yì běn). When counting, just yī.</li></ul><h3>Spelling rules</h3><ul><li>The tone mark goes on <b>a</b> or <b>e</b> if there is one; in <b>ou</b> on the o; otherwise on the last vowel: duì, liù.</li><li>After j, q, x and y, ü is written as u: 去 qù, 学 xué. After n and l it keeps the dots: 女 nǚ.</li></ul>";
    p.append(rules);
    const play = el("button", "primarybtn", "🎮 Play Tone Detective"); play.onclick = () => go("games"); p.append(play);
  }

  /* ---------- 2. Numbers ---------- */
  const NPY = { "零": "líng", "一": "yī", "二": "èr", "三": "sān", "四": "sì", "五": "wǔ", "六": "liù", "七": "qī", "八": "bā", "九": "jiǔ", "十": "shí", "百": "bǎi", "千": "qiān", "万": "wàn", "两": "liǎng" };
  const DIG = "零一二三四五六七八九";
  function under10k(n, lead) {
    // n: 0..9999 ; lead: true if this is the very first group
    const d = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10], u = ["千", "百", "十", ""];
    let s = "", zero = false;
    for (let i = 0; i < 4; i++) {
      if (d[i] === 0) { if (s) zero = true; continue; }
      if (zero) { s += "零"; zero = false; }
      if (i === 2 && d[i] === 1 && !s && lead) s += "十";
      else if (d[i] === 2 && i === 0) s += "两" + u[i];
      else s += DIG[d[i]] + u[i];
    }
    return s;
  }
  function toZh(n) {
    if (n === 0) return "零";
    const hi = Math.floor(n / 10000), lo = n % 10000;
    let s = "";
    if (hi) s += (hi === 2 ? "两" : under10k(hi, true)) + "万";
    if (lo) { if (hi && lo < 1000) s += "零"; s += under10k(lo, !hi); }
    return s;
  }
  function pyOf(s) {
    const a = [...s];
    return a.map((c, i) => {
      if (c === "一" && i < a.length - 1) { const nx = a[i + 1]; if (nx === "万") return "yí"; if (nx === "百" || nx === "千") return "yì"; }
      return NPY[c] || c;
    }).join(" ");
  }
  function numbers() {
    const p = $("bpane"); p.append(header("Numbers", "数"));
    const c1 = el("div", "b-card");
    c1.innerHTML = "<p>Chinese numbers are very logical. Learn 0–10 and you can say every number up to 99: <b>十一</b> = ten-one = 11, <b>二十</b> = two-ten = 20, <b>二十五</b> = 25.</p><p class=\"hint\">Tap a number to see how it is written, hear it, and read its story.</p>";
    p.append(c1);
    const g = el("div", "numgrid");
    B.numbers.forEach(([c, py, v, story]) => {
      const b = el("button", "num"); b.innerHTML = '<span class="nz"></span><span class="nv"></span><span class="np"></span>';
      b.children[0].textContent = c; b.children[1].textContent = v.toLocaleString(); b.children[2].textContent = py;
      b.onclick = () => openSheet({ c, py, mean: (c === "两" ? "two (before a measure word)" : "the number " + v.toLocaleString()), story });
      g.append(b);
    });
    p.append(g);
    // builder
    const c2 = el("div", "b-card"); c2.append(el("h3", null, "Number builder"), el("p", "hint", "Type any number from 0 to 99,999,999 and see how to say it in Chinese."));
    const row = el("div", "arow");
    const inp = el("input"); inp.type = "number"; inp.inputMode = "numeric"; inp.min = 0; inp.max = 99999999; inp.id = "nbIn"; inp.value = "2026"; inp.setAttribute("aria-label", "Number");
    const res = el("div", "nb-out"); const zhEl = el("div", "nb-zh"); const pyEl = el("div", "nb-py"); const note = el("p", "hint");
    const sb = sayBtn(b => saySeq([...zhEl.textContent], b), "Listen to the number");
    row.append(inp, sb);
    const upd = () => {
      let n = parseInt(inp.value, 10);
      if (isNaN(n) || n < 0) { zhEl.textContent = ""; pyEl.textContent = ""; note.textContent = ""; return; }
      if (n > 99999999) { n = 99999999; inp.value = n; }
      const z = toZh(n); zhEl.textContent = z; pyEl.textContent = pyOf(z);
      const tips = [];
      if (/两/.test(z)) tips.push("两 (liǎng) is used for “two” before 千 and 万. 二千 is also understood.");
      if (/^二百|[^十]二百/.test(z) || n % 1000 >= 200 && n % 1000 < 300) tips.push("For 200 people say 二百 or 两百 – both are correct.");
      if (/零/.test(z) && n) tips.push("零 fills a gap: 105 = 一百零五 (one hundred zero five).");
      if (n >= 10000) tips.push("Chinese counts in groups of 10,000 (万): 100,000 = 十万 (ten 万).");
      if (n >= 10 && n < 20) tips.push("10–19 start with 十 – no 一 in front: 十二 = 12.");
      note.textContent = tips.join(" ");
    };
    inp.addEventListener("input", upd); upd();
    res.append(zhEl, pyEl, note); c2.append(row, res); p.append(c2);
    const c3 = el("div", "b-card"); c3.append(el("h3", null, "Fun: Chinese hand numbers"), el("p", "hint", "In markets, people show numbers with ONE hand. 1–5 are like ours; 6–10 are special:"));
    const ul = el("ul"); B.hands.forEach(([n, how]) => { const li = el("li"); li.innerHTML = "<b></b> – "; li.firstChild.textContent = n + " " + toZh(n); li.append(how); ul.append(li); });
    c3.append(ul);
    p.append(c3);
    const lk = el("button", "b-link"); lk.innerHTML = "<span>🧧</span><span><b>Numbers with meaning</b><br>Why 8 is lucky, 4 is avoided, and 520 means “I love you”</span><span>›</span>"; lk.onclick = () => go("lucky"); p.append(lk);
    const play = el("button", "primarybtn", "🎮 Play Number Match"); play.onclick = () => { go("games"); startGame("num"); }; p.append(play);
  }


  /* ---------- 2b. Numbers with meaning ---------- */
  const L = window.LUCKY || { digits: [], codes: [], occasions: [], etiquette: [] };
  const codeMap = {};
  L.codes.forEach(c => (codeMap[c[0]] = codeMap[c[0]] || []).push(c));
  const DIGZH = "零一二三四五六七八九";
  // ¥13.14 → 十三块一毛四 (two before 块/毛 is 两)
  function moneyZh(str) {
    const m = /^(\d+)(?:\.(\d)(\d)?)?$/.exec(str); if (!m) return "";
    const n = parseInt(m[1], 10), d1 = +(m[2] || 0), d2 = +(m[3] || 0);
    if (n > 99999999) return "";
    let s = n ? (n === 2 ? "两" : toZh(n)) + "块" : "";
    if (d1 && !d2 && n) s += DIGZH[d1];                       // 13.1 → 十三块一
    else if (d1) s += (d1 === 2 && !n ? "两" : DIGZH[d1]) + "毛"; // 0.2 → 两毛
    if (d2) s += (d1 ? "" : (n ? "零" : "")) + DIGZH[d2] + (d1 ? "" : "分");
    return s || "零";
  }
  // split the digits into the biggest known codes, single digits otherwise
  function segment(d) {
    const best = [[]];
    for (let i = 1; i <= d.length; i++) {
      let pick = null;
      for (let j = Math.max(0, i - 7); j < i; j++) {
        const piece = d.slice(j, i), known = i - j > 1 && codeMap[piece];
        if (!known && i - j > 1) continue;
        const cand = best[j] && best[j].concat([piece]);
        if (cand && (!pick || cand.length < pick.length)) pick = cand;
      }
      best[i] = pick;
    }
    return best[d.length];
  }
  function decode(raw, out) {
    out.innerHTML = "";
    const clean = String(raw).replace(/[¥￥元,\s]/g, "");
    // for money, a leading 0 (¥0.88) is not part of the message
    const digits = clean.replace(/^0+(?=\.)/, "").replace(/\D/g, "").replace(/^0+(?=\d)/, /\./.test(clean) ? "" : "$&");
    if (!digits) return;
    if (digits.length > 14) { out.append(el("p", "hint", "That's a very long number – try one up to 14 digits.")); return; }
    const big = el("div", "lk-big"); big.textContent = (/\./.test(clean) ? "¥" : "") + clean; out.append(big);
    const read = [...digits].map(c => DIGZH[c]).join("");
    const rd = el("div", "lk-read"); rd.append(el("span", "lk-zh", read), el("span", "lk-py", [...digits].map(c => L.digits[c][2].split(" / ")[0]).join(" ")));
    out.append(rd);
    const money = /^\d+(\.\d{1,2})?$/.test(clean) && /\./.test(clean) ? moneyZh(clean) : "";
    if (money) out.append(el("p", "hint", "As money you say: ¥" + clean + " = " + money + ". As a code you read it digit by digit: " + read + "."));
    const segs = segment(digits) || [...digits];
    const whole = codeMap[digits];
    const list = el("div", "lk-segs");
    const shown = whole ? [digits] : segs;
    let bad = false, good = 0;
    shown.forEach(s => {
      if (codeMap[s]) codeMap[s].forEach(c => {
        const r = el("div", "lk-seg " + c[8]);
        r.append(el("span", "lk-emo", c[7]));
        const t = el("div"); const h = el("div", "lk-segh"); h.append(el("b", null, c[0]), " → ", el("span", "lk-zh", c[3]), " ", el("span", "lk-py", c[4]));
        const d = el("div", null, c[5] + (c[6] ? " – " + c[6] : "")); d.append(srcTag(c[9]));
        t.append(h, d);
        r.append(t, sayBtn(btn => window.CSSay && CSSay(c[1] + "，" + c[3], btn), "Listen"));
        list.append(r);
        if (c[8] === "warn") bad = true; else good++;
      });
      else {
        const dg = L.digits[+s]; const r = el("div", "lk-seg " + dg[6]);
        r.append(el("span", "lk-emo", dg[7]));
        const t = el("div"); const h = el("div", "lk-segh"); h.append(el("b", null, s), " " + dg[1] + " " + dg[2] + " ~ ", el("span", "lk-zh", dg[3]), " ", el("span", "lk-py", dg[4]));
        const d = el("div", null, dg[5]); d.append(srcTag(dg[8]));
        t.append(h, d);
        r.append(t); list.append(r);
        if (dg[6] === "bad") bad = true; if (dg[6] === "good") good++;
      }
    });
    out.append(list);
    const v = el("p", "g-fb " + (bad ? "bad" : good ? "good" : ""));
    v.textContent = bad ? "⚠️ Careful – this number has an unlucky or rude meaning. Don't use it for a gift." : whole ? "✨ This is a well-known code – people will understand your message!" : good ? "👍 A friendly number with good meanings." : "A neutral number – no special message.";
    out.append(v);
  }
  // little [1][2] links that jump to the Sources card
  function srcTag(arr) {
    const s = el("span", "lk-src");
    (arr || []).forEach(n => { const a = el("a", null, String(n)); a.href = "#lksrc" + n; a.title = L.sources[n - 1] ? L.sources[n - 1][1] : ""; a.onclick = e => { e.preventDefault(); e.stopPropagation(); const t = $("lksrc" + n); if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); } }; s.append(a); });
    return s;
  }
  function lucky() {
    const p = $("bpane"); p.append(header("Numbers with meaning", "吉"));
    const c0 = el("div", "b-card");
    c0.innerHTML = "<p>Many Chinese numbers <b>sound like other words</b>. 8 (bā) sounds like 发 (fā, “get rich”), and 5-2-0 (wǔ èr líng) sounds a bit like 我爱你 (wǒ ài nǐ, “I love you”).</p><p>So numbers become secret messages – in chats, phone numbers, prices and especially <b>money gifts</b>. A friend who sends you ¥13.14 is saying 一生一世, “for my whole life”. 🧧</p>";
    p.append(c0);
    // decoder
    const c1 = el("div", "b-card lk-dec"); c1.append(el("h3", null, "🔍 Number decoder"), el("p", "hint", "Got a strange amount or number? Type it to see what it says."));
    const row = el("div", "arow"); const inp = el("input"); inp.id = "lkIn"; inp.inputMode = "decimal"; inp.placeholder = "e.g. 13.14 or 520"; inp.setAttribute("aria-label", "Number or amount");
    const out = el("div", "lk-out");
    const sb = sayBtn(btn => { const d = inp.value.replace(/\D/g, ""); if (d) { const segs = codeMap[d] ? [d] : segment(d) || []; const meanings = segs.filter(s => codeMap[s]).map(s => codeMap[s][0][3]).join("，"); window.CSSay && CSSay([...d].map(c => DIGZH[c]).join("") + (meanings ? "，" + meanings : ""), btn); } }, "Listen");
    row.append(inp, sb); c1.append(row);
    const ex = el("div", "lk-chips");
    ["520", "13.14", "168", "666", "8.88", "250"].forEach(n => { const b = el("button", "chip", n); b.onclick = () => { inp.value = n; decode(n, out); }; ex.append(b); });
    c1.append(ex, out);
    inp.addEventListener("input", () => decode(inp.value, out));
    p.append(c1);
    // digits
    const c2 = el("div", "b-card"); c2.append(el("h3", null, "What each digit says"), el("p", "hint", "Green = lucky · gold = it depends · red = avoid. Tap to hear."));
    const g = el("div", "lk-digits");
    L.digits.forEach(([d, zh, py, sl, slpy, mean, mood, emo, src]) => {
      const b = el("button", "lk-d " + mood);
      b.append(el("span", "lk-demo", emo), el("span", "lk-dn", d), el("span", "lk-dz", zh + " " + py.split(" / ")[0]), el("span", "lk-ds", "≈ " + sl.split(" / ")[0] + " " + slpy.split(" / ")[0]));
      b.setAttribute("aria-label", d + " " + zh + " sounds like " + sl + ": " + mean);
      b.onclick = () => { g.querySelectorAll(".on").forEach(x => x.classList.remove("on")); b.classList.add("on"); dtip.textContent = emo + " " + d + " " + zh + " (" + py + ") sounds like " + sl + " (" + slpy + "): " + mean + ". "; dtip.append(srcTag(src)); window.CSSay && CSSay(zh + "，" + sl.split(" / ")[0], b); };
      g.append(b);
    });
    const dtip = el("p", "lk-dtip", "Tap a digit.");
    c2.append(g, dtip); p.append(c2);
    // codes by kind
    const c3 = el("div", "b-card"); c3.append(el("h3", null, "Number codes"));
    const tabs = el("div", "lk-tabs"), list = el("div", "lk-list");
    const KINDS = [["love", "❤️ Love"], ["luck", "🍀 Luck"], ["chat", "💬 Chat"], ["warn", "⚠️ Avoid"]];
    const showKind = k => {
      tabs.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      list.innerHTML = "";
      L.codes.filter(c => c[8] === k).forEach(c => {
        const r = el("div", "lk-row " + k);
        const n = el("div", "lk-n"); n.append(el("span", "lk-emo", c[7]), el("b", null, c[0]));
        const t = el("div", "lk-t");
        const h = el("div", "lk-segh"); h.append(el("span", "lk-zh", c[3]), " ", el("span", "lk-py", c[4]));
        t.append(h, el("div", "lk-en", c[5]));
        const tp = el("div", "lk-tip", c[6] ? c[6] + " " : ""); tp.append(srcTag(c[9])); t.append(tp);
        r.append(n, t, sayBtn(btn => window.CSSay && CSSay(c[1] + "，" + c[3], btn), "Listen: " + c[0]));
        list.append(r);
      });
      store.set("lkKind", k);
    };
    KINDS.forEach(([k, name]) => { const b = el("button", "chip", name); b.dataset.k = k; b.onclick = () => showKind(k); tabs.append(b); });
    c3.append(tabs, list); p.append(c3); showKind(store.get("lkKind", "love"));
    // red envelopes
    const c4 = el("div", "b-card lk-hb"); c4.append(el("h3", null, "🧧 Send a feeling with a red envelope"), el("p", "hint", "Pick the occasion – the app suggests amounts with a good message. Tap an envelope to see what it says."));
    const occ = el("div", "lk-chips"), env = el("div", "lk-envs"), etip = el("p", "hint"), eout = el("div", "lk-out");
    const showOcc = o => {
      occ.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.o === o[0]));
      env.innerHTML = ""; eout.innerHTML = "";
      o[3].forEach(a => { const b = el("button", "lk-env"); b.append(el("span", "lk-envt", "福"), el("span", "lk-enva", "¥" + a)); b.onclick = () => { env.querySelectorAll(".on").forEach(x => x.classList.remove("on")); b.classList.add("on"); decode(a, eout); }; env.append(b); });
      etip.textContent = o[2] + " " + o[4];
    };
    L.occasions.forEach(o => { const b = el("button", "chip", o[2] + " " + o[1]); b.dataset.o = o[0]; b.onclick = () => showOcc(o); occ.append(b); });
    c4.append(occ, etip, env, eout); p.append(c4); if (L.occasions[0]) showOcc(L.occasions[0]);
    // manners
    const c5 = el("div", "b-card"); c5.append(el("h3", null, "Red envelope manners"));
    const ul = el("div", "lk-man"); L.etiquette.forEach(([e, t, src]) => { const r = el("div", "lk-manr"); const s = el("span", null, t + " "); s.append(srcTag(src)); r.append(el("span", "lk-emo", e), s); ul.append(r); });
    c5.append(ul); p.append(c5);
    // rhymes with numbers (the full collection is in Rhymes & poems)
    const c6 = el("div", "b-card"); c6.append(el("h3", null, "🎵 Number rhymes"), el("p", "hint", "Rhymes make numbers stick. Tap one to open it – the rhyming sounds are in gold."));
    RH.filter(r => r.cat === "num").forEach(r => c6.append(rhymeItem(r, false)));
    const more = el("button", "b-link"); more.innerHTML = "<span>📜</span><span><b>More rhymes & poems</b><br>静夜思, 春晓, children's rhymes and tongue twisters</span><span>›</span>"; more.onclick = () => go("rhymes");
    c6.append(more); p.append(c6);
    // idioms
    const c7 = el("div", "b-card"); c7.append(el("h3", null, "🧩 Sayings with numbers (成语)"), el("p", "hint", "Four-character sayings that use numbers. Read the literal words, then the real meaning."));
    L.idioms.forEach(([zh, py, lit, mean]) => {
      const row = el("div", "u-line"); const t = el("div", "u-txt");
      t.append(el("div", "u-zh", zh), el("div", "u-py", py), el("div", "u-en", "“" + lit + "” → " + mean));
      row.append(t, sayBtn(btn => window.CSSay && CSSay(zh, btn), "Listen")); c7.append(row);
    });
    p.append(c7);
    const play = el("button", "primarybtn", "🎮 Play Number Codes"); play.onclick = () => { go("games"); startGame("code"); }; p.append(play);
    // sources
    const c8 = el("div", "b-card lk-sources"); c8.append(el("h3", null, "📚 Sources"), el("p", "hint", "Where these meanings come from. The small numbers next to each meaning point here. Number slang is informal internet language – it changes, and not everyone uses every code."));
    const ol = el("ol");
    L.sources.forEach(([title, who, url], i) => { const li = el("li"); li.id = "lksrc" + (i + 1); const a = el("a", null, title); a.href = url; a.target = "_blank"; a.rel = "noopener"; li.append(a, " – " + who); ol.append(li); });
    c8.append(ol, el("p", "hint", "Rhymes: 上山打老虎 is a traditional children's rhyme; 一去二三里 is by the Song-dynasty poet 邵雍 Shào Yōng (1011–1077). Number words follow HSK Standard Course 1 (HSK标准教程1)."));
    p.append(c8);
  }


  /* ---------- Rhymes & poems ---------- */
  const RH = window.RHYMES || [];
  const PUNCT = /[，。！？、；：,.!?]/;
  // one shared player for the chants (voice + music), with characters lighting up as they are sung
  const chant = { audio: null, item: null, raf: 0, seg: null, loop: false };
  function chantStop() {
    if (chant.audio) { try { chant.audio.pause(); } catch (e) {} }
    cancelAnimationFrame(chant.raf);
    if (chant.item) { chant.item.classList.remove("playing"); chant.item.querySelectorAll(".sing,.now").forEach(x => x.classList.remove("sing", "now")); const pb = chant.item.querySelector(".rh-play"); if (pb) pb.innerHTML = "▶ <b>Play with music</b>"; }
    chant.item = null; chant.seg = null;
  }
  function chantPlay(item, info, seg) {
    const same = chant.item === item && !seg && !chant.seg && chant.audio && !chant.audio.paused;
    chantStop(); if (same) return;
    if (window.CSStopAll) try { CSStopAll(); } catch (e) {}
    if (!chant.audio) { chant.audio = new Audio(); chant.audio.preload = "auto"; }
    const a = chant.audio;
    if (!a.src.endsWith(info.src)) a.src = info.src;
    chant.item = item; chant.seg = seg || null; item.classList.add("playing");
    const pb = item.querySelector(".rh-play"); if (pb && !seg) pb.innerHTML = "❚❚ <b>Pause</b>";
    const spans = item.querySelectorAll(".rh-c"), rows = item.querySelectorAll(".rh-row");
    const bar = item.querySelector(".rh-prog span");
    const startAt = seg ? Math.max(0, seg[0]) : 0;
    const go = () => {
      a.currentTime = startAt;
      a.play().catch(() => { chantStop(); });
      const tick = () => {
        if (chant.item !== item) return;
        const t = a.currentTime;
        if (bar) bar.style.width = Math.min(100, t / info.dur * 100) + "%";
        let cur = null;
        for (const e of info.t) { if (e[3] <= t + 0.03 && t < e[4] + 0.12) cur = e; }
        spans.forEach(s => s.classList.toggle("sing", !!cur && +s.dataset.l === cur[1] && +s.dataset.c === cur[2]));
        rows.forEach((r, i) => r.classList.toggle("now", !!cur && i === cur[1]));
        if (seg && t >= seg[1]) { a.pause(); chantStop(); return; }
        if (a.ended || (a.paused && a.currentTime > 0)) {
          if (!seg && chant.loop && a.ended) { a.currentTime = 0; a.play(); }
          else { chantStop(); return; }
        }
        chant.raf = requestAnimationFrame(tick);
      };
      chant.raf = requestAnimationFrame(tick);
    };
    if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
  }
  // the time window of one line (first round), for tap-a-line
  function lineSeg(info, li) {
    const ev = info.t.filter(e => e[0] === 0 && e[1] === li); if (!ev.length) return null;
    return [ev[0][3] - 0.25, ev[ev.length - 1][4] + 0.5];
  }
  function rhymeItem(r, open) {
    const info = window.RHAUDIO && RHAUDIO[r.id];
    const box = el("details", "rh-item"); if (open) box.open = true;
    const sum = el("summary"); const st = el("span", "rh-t");
    st.append(el("span", "rh-zh", r.t), el("span", "rh-en", r.py + " · " + r.en));
    sum.append(st); box.append(sum);
    const body = el("div", "rh-body");
    body.append(el("p", "rh-by", r.by), el("p", "hint", r.note));
    if (info) {
      const player = el("div", "rh-player");
      const play = el("button", "primarybtn rh-play"); play.innerHTML = "▶ <b>Play with music</b>";
      play.onclick = () => chantPlay(box, info);
      const loop = el("button", "ghost rh-loop", "🔁"); loop.title = "Repeat"; loop.setAttribute("aria-label", "Repeat"); loop.setAttribute("aria-pressed", "false");
      loop.onclick = () => { chant.loop = !chant.loop; document.querySelectorAll(".rh-loop").forEach(x => { x.classList.toggle("on", chant.loop); x.setAttribute("aria-pressed", String(chant.loop)); }); };
      if (chant.loop) loop.classList.add("on");
      const prog = el("div", "rh-prog"); prog.append(el("span"));
      player.append(play, loop, prog);
      body.append(player);
    }
    const tools = el("div", "frow");
    const hide = el("button", "ghost", "Hide pinyin & English");
    hide.onclick = () => { const h = body.classList.toggle("memo"); hide.textContent = h ? "Show pinyin & English" : "Hide pinyin & English"; };
    const slow = el("button", "ghost", "🐢 Say it slowly"); slow.onclick = () => { chantStop(); window.CSSay && CSSay(r.lines.map(l => l[0]).join(""), slow); };
    tools.append(hide, slow); body.append(tools);
    r.lines.forEach(([zh, py, en], li) => {
      const row = el("div", "u-line rh-row"); const t = el("div", "u-txt"); const z = el("div", "u-zh rh-line");
      const chars = [...zh];
      chars.forEach((ch, i) => {
        const isHan = /[一-鿿]/.test(ch);
        const rhy = r.rhyme.includes(ch) && (i === chars.length - 1 || PUNCT.test(chars[i + 1]));
        const s = el("span", (isHan ? "rh-c" : "") + (rhy ? " lk-rhy" : ""), ch);
        s.dataset.l = li; s.dataset.c = i; z.append(s);
      });
      t.append(z, el("div", "u-py", py), el("div", "u-en", en));
      t.onclick = () => body.classList.contains("memo") && row.classList.toggle("peek");
      const seg = info && lineSeg(info, li);
      row.append(t, sayBtn(btn => seg ? chantPlay(box, info, seg) : window.CSSay && CSSay(zh, btn), "Listen to this line"));
      body.append(row);
    });
    box.append(body);
    box.addEventListener("toggle", () => {
      if (box.open) box.parentElement.querySelectorAll("details[open]").forEach(d => d !== box && (d.open = false));
      else if (chant.item === box) chantStop();
    });
    return box;
  }
  function rhymes() {
    const p = $("bpane"); p.append(header("Rhymes & poems", "诗"));
    const c0 = el("div", "b-card");
    c0.innerHTML = "<p>Chinese children learn thousands of characters by <b>chanting rhymes and short poems</b>. The rhythm and the rhyme help words stick. Rhyming sounds are in <span class='lk-rhy'>gold</span>.</p><p class='hint'>Tip: open a rhyme, listen, then tap “Hide pinyin & English” and try to say it from memory. Tap a line to peek.</p>";
    p.append(c0);
    const CATS = [["kids", "🧸 Children's rhymes", "儿歌"], ["poem", "📜 Classic poems", "古诗"], ["twist", "👅 Tongue twisters", "绕口令"], ["num", "🔢 Number rhymes", "数字"]];
    const tabs = el("div", "lk-tabs"), list = el("div", "rh-list");
    const show = k => {
      tabs.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      list.innerHTML = "";
      const c = CATS.find(x => x[0] === k);
      list.append(el("p", "hint", c[2] + " – " + RH.filter(r => r.cat === k).length + " to learn. Tap one to open it."));
      RH.filter(r => r.cat === k).forEach(r => list.append(rhymeItem(r, false)));
      store.set("rhCat", k);
    };
    CATS.forEach(([k, n]) => { const b = el("button", "chip", n); b.dataset.k = k; b.onclick = () => show(k); tabs.append(b); });
    const c1 = el("div", "b-card"); c1.append(tabs, list); p.append(c1);
    show(store.get("rhCat", "kids"));
    p.append(el("p", "hint", "All rhymes here are traditional folk rhymes or classical poems (Han, Tang and Song dynasties). Translations are simple learner versions."));
  }

  /* ---------- 3. Strokes ---------- */
  function strokes() {
    const p = $("bpane"); p.append(header("Strokes", "笔"));
    const c1 = el("div", "b-card");
    c1.innerHTML = "<p>Every character is made of <b>strokes</b> (笔画 bǐhuà) – lines you draw without lifting the pen. There are only about 30 stroke types, and these 12 cover almost everything you will write. Tap an example to watch it being written.</p>";
    p.append(c1);
    const list = el("div", "strokelist");
    B.strokes.forEach(([s, zh, py, en, how, ex]) => {
      const r = el("div", "stroke");
      const sym = el("div", "s-sym", s);
      const t = el("div", "s-txt");
      const name = el("div", "s-name"); name.innerHTML = "<b></b> <span class='s-py'></span> · "; name.firstChild.textContent = zh; name.children[1].textContent = py; name.append(en);
      t.append(name, el("div", "s-how", how));
      const exs = el("div", "s-ex");
      ex.split(" ").forEach(c => { const b = el("button", "chip", c); b.onclick = () => openSheet({ c, py: "", mean: "Example of the " + en + " stroke", story: "Watch for the " + zh + " (" + en + ") stroke. The order of strokes is shown in the animation." }); exs.append(b); });
      t.append(exs); r.append(sym, t); list.append(r);
    });
    p.append(list);
    const c2 = el("div", "b-card"); c2.append(el("h3", null, "The 7 stroke-order rules"), el("p", "hint", "Tap to watch a character that follows each rule."));
    const rl = el("div", "rules");
    B.rules.forEach(([rule, c], i) => {
      const b = el("button", "rule"); b.innerHTML = '<span class="rn"></span><span class="rt"></span><span class="rc"></span>';
      b.children[0].textContent = i + 1; b.children[1].textContent = rule; b.children[2].textContent = c;
      b.onclick = () => openSheet({ c, py: "", mean: "Rule " + (i + 1) + ": " + rule });
      rl.append(b);
    });
    c2.append(rl);
    c2.append(el("p", "hint", "Why does order matter? It makes your characters look balanced, helps you remember them, and lets you read fast handwriting. Phones and dictionaries also recognise handwriting by stroke order."));
    p.append(c2);
  }

  /* ---------- 4. Radicals ---------- */
  let radFilter = store.get("radFilter", "common"), radQ = "";
  function radicals() {
    const p = $("bpane"); p.append(header("Radicals", "部"));
    const c1 = el("div", "b-card");
    c1.innerHTML = "<p>A <b>radical</b> (部首 bùshǒu) is the part of a character that usually hints at its <b>meaning</b>. Chinese dictionaries have sorted characters by radical for centuries; the famous <b>Kangxi Dictionary</b> of 1716 used <b>214 radicals</b>, and that list is still the standard.</p><p>Example: 氵(water) appears in 汉, 没, 渴 (thirsty), 洗 (wash). 讠(speech) appears in 说, 语, 请, 谢, 读. Learn the common radicals and new characters become much easier to guess.</p><p class=\"hint\">Many radicals change shape when they sit beside other parts: 人 → 亻, 水 → 氵, 手 → 扌, 心 → 忄. Simplified Chinese also shortened some: 言 → 讠, 金 → 钅, 食 → 饣.</p>";
    p.append(c1);
    const ctl = el("div", "radctl");
    const q = el("input"); q.type = "search"; q.placeholder = "Search: water, 氵, shui, 85…"; q.id = "radQ"; q.value = radQ; q.setAttribute("aria-label", "Search radicals");
    const seg = el("div", "voices");
    [["common", "Most useful (60)"], ["all", "All 214"]].forEach(([v, l]) => { const b = el("button", null, l); b.setAttribute("aria-pressed", String(radFilter === v)); b.onclick = () => { radFilter = v; store.set("radFilter", v); draw(); seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); }; seg.append(b); });
    ctl.append(q, seg); p.append(ctl);
    const out = el("div", "radlist"); p.append(out);
    const plainPy = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    function draw() {
      out.innerHTML = "";
      const qq = radQ.trim().toLowerCase();
      const list = B.radicals.filter(r => (radFilter === "all" || r.common || qq) && (!qq ||
        r.r === qq || r.s === qq || r.v === qq || String(r.n) === qq || r.m.includes(qq) || (plainPy(r.py) && plainPy(r.py) === plainPy(qq)) || r.o.toLowerCase().includes(qq) || r.ex.some(e => e[0] === qq)));
      if (!list.length) { out.append(el("p", "empty", "No radical found.")); return; }
      let lastSt = 0;
      list.forEach(r => {
        if (r.st !== lastSt) { lastSt = r.st; out.append(el("div", "radgroup", r.st + " stroke" + (r.st > 1 ? "s" : ""))); }
        const b = el("button", "rad");
        const f = el("span", "rf"); f.textContent = r.r + (r.v && r.v !== r.r ? " " + r.v : "") + (r.s ? " " + r.s : "");
        const t = el("span", "rt"); const m = el("span", "rm", r.m); const n = el("span", "rnum", "#" + r.n + (r.py ? " · " + r.py : ""));
        t.append(m, n); b.append(f, t);
        b.onclick = () => showRad(r);
        out.append(b);
      });
    }
    q.addEventListener("input", () => { radQ = q.value; draw(); });
    draw();
  }
  function showRad(r) {
    const extra = el("div");
    if (r.ex.length) {
      extra.append(el("p", "label", "Characters with this radical (HSK 1–3)"));
      const g = el("div", "exgrid");
      r.ex.forEach(([c, py, d]) => {
        const b = el("button", "exc"); b.innerHTML = '<span class="ez"></span><span class="ep"></span><span class="ed"></span>';
        b.children[0].textContent = c; b.children[1].textContent = py; b.children[2].textContent = d;
        b.onclick = () => sayChar(c, b);
        g.append(b);
      });
      extra.append(g, el("p", "hint", "Tap a character to hear it."));
    }
    const forms = [r.v && r.v !== r.r ? "Side form: " + r.v : "", r.s ? "Simplified: " + r.s : ""].filter(Boolean).join(" · ");
    openSheet({ c: r.s || r.r, py: r.py, mean: "Radical " + r.n + ": " + r.m, forms: (r.s ? "Traditional: " + r.r + " · " : "") + forms, story: r.o || "", extra });
  }

  /* ---------- 5. Picture characters ---------- */
  function pictures() {
    const p = $("bpane"); p.append(header("Picture characters", "象"));
    const c1 = el("div", "b-card");
    c1.innerHTML = "<p>Chinese writing is more than <b>3,000 years old</b>. The oldest characters were carved on turtle shells and ox bones (甲骨文, “oracle bones”) to ask questions about the future. Many began as simple <b>drawings</b>; over the centuries the drawings became straighter and simpler until they looked like today's characters.</p>";
    p.append(c1);
    const tl = el("div", "b-card timeline"); tl.append(el("h3", null, "How the shapes changed"));
    [["甲骨文","Oracle bones","about 1200 BC","scratched with a knife on bones – very picture-like"],
     ["金文","Bronze script","about 1000 BC","cast on bronze bells and pots – rounder shapes"],
     ["小篆","Seal script","221 BC","the first emperor, Qin Shi Huang, made one standard script"],
     ["隶书","Clerical script","about 200 BC – 200 AD","flatter and straighter – easier to write with a brush"],
     ["楷书","Regular script","from about 300 AD","the clear printed form you are learning"],
     ["简体字","Simplified","1956","fewer strokes, used in China today: 馬 → 马, 門 → 门"]].forEach(([z, n, y, d]) => {
      const r = el("div", "tl-row"); r.append(el("span", "tl-zh", z)); const t = el("div", "tl-t"); t.append(el("b", null, n + " "), el("span", "tl-y", y), el("div", "tl-d", d)); r.append(t); tl.append(r);
    });
    p.append(tl);
    p.append(el("p", "hint", "Characters are built in four main ways. Tap any card to see the picture next to the real character, watch it being written and hear it."));
    const sec = (title, zh, note) => { const h = el("div", "b-sec"); const t = el("h3"); t.innerHTML = "<span class='b-hz'></span> "; t.firstChild.textContent = zh; t.append(title); h.append(t, el("p", "hint", note)); p.append(h); };
    sec("1. Pictures", "象形", "A drawing of the thing itself. These are the oldest characters – " + B.picto.length + " of them here.");
    const g = el("div", "picgrid");
    B.picto.forEach(pc => {
      const [c, py, m, emo, story, art] = pc;
      const btn = el("button", "pic"); btn.append(el("span", "pe", emo), sketch(art), el("span", "pc", c), el("span", "pm", m));
      btn.setAttribute("aria-label", c + " " + py + ", " + m);
      btn.onclick = () => openSheet({ c, py, mean: m + "  " + emo, story, art, emo });
      g.append(btn);
    });
    p.append(g);
    sec("2. Pointing", "指事", "A simple picture plus a mark that points to the meaning.");
    const g4 = el("div", "idealist");
    B.point.forEach(([c, py, m, story]) => {
      const btn = el("button", "idea"); btn.innerHTML = '<span class="ic"></span><span class="it"><span class="ip"></span><span class="im"></span></span>';
      btn.children[0].textContent = c; btn.querySelector(".ip").textContent = py + " – " + m; btn.querySelector(".im").textContent = story;
      btn.onclick = () => openSheet({ c, py, mean: m, story });
      g4.append(btn);
    });
    p.append(g4);
    sec("3. Ideas", "会意", "Two or more pictures put together to make a new idea. It is like a little riddle.");
    const g2 = el("div", "idealist");
    B.ideas.forEach(([c, py, m, parts, story]) => {
      const btn = el("button", "idea"); btn.innerHTML = '<span class="ic"></span><span class="it"><span class="ip"></span><span class="im"></span></span>';
      btn.children[0].textContent = c; btn.querySelector(".ip").textContent = parts; btn.querySelector(".im").textContent = "= " + m;
      btn.onclick = () => openSheet({ c, py, mean: m, forms: parts, story });
      g2.append(btn);
    });
    p.append(g2);
    sec("4. Meaning + sound", "形声", "About 80% of characters work like this: one part (often the radical) shows the meaning, the other part shows the sound. This is your secret weapon for guessing new characters!");
    const g3 = el("div", "idealist");
    B.sounds.forEach(([c, py, m, parts]) => {
      const btn = el("button", "idea"); btn.innerHTML = '<span class="ic"></span><span class="it"><span class="ip"></span><span class="im"></span></span>';
      btn.children[0].textContent = c; btn.querySelector(".ip").textContent = parts; btn.querySelector(".im").textContent = py + " = " + m;
      btn.onclick = () => openSheet({ c, py, mean: m, forms: parts, story: "Look at the parts: the meaning part tells you what it is about, the sound part tells you roughly how to say it." });
      g3.append(btn);
    });
    p.append(g3);
    const row = el("div", "frow");
    const p1 = el("button", "primarybtn", "🎮 Play Picture Match"); p1.onclick = () => { go("games"); startGame("pic"); };
    const p2 = el("button", "ghost", "🧩 Play Make a Character"); p2.onclick = () => { go("games"); startGame("idea"); };
    row.append(p1, p2); p.append(row);
  }

  /* ---------- 7. Useful phrases ---------- */
  const PHRASES = [
    ["In class", [
      ["老师好！", "Lǎoshī hǎo!", "Hello, teacher!"], ["同学们好！", "Tóngxuémen hǎo!", "Hello, classmates!"],
      ["我不懂。", "Wǒ bù dǒng.", "I don't understand."], ["请再说一遍。", "Qǐng zài shuō yí biàn.", "Please say it again."],
      ["请说慢一点儿。", "Qǐng shuō màn yìdiǎnr.", "Please speak more slowly."], ["这个字怎么读？", "Zhège zì zěnme dú?", "How do you read this character?"],
      ["这个字怎么写？", "Zhège zì zěnme xiě?", "How do you write this character?"], ["“book”用汉语怎么说？", "“book” yòng Hànyǔ zěnme shuō?", "How do you say “book” in Chinese?"],
      ["我有一个问题。", "Wǒ yǒu yí ge wèntí.", "I have a question."], ["我知道。", "Wǒ zhīdào.", "I know."], ["我不知道。", "Wǒ bù zhīdào.", "I don't know."],
      ["对！", "Duì!", "Correct!"], ["不对。", "Bú duì.", "That's not right."]]],
    ["Meeting people", [
      ["你好！", "Nǐ hǎo!", "Hello!"], ["你好吗？", "Nǐ hǎo ma?", "How are you?"], ["我很好，谢谢！", "Wǒ hěn hǎo, xièxie!", "I'm fine, thank you!"],
      ["你叫什么名字？", "Nǐ jiào shénme míngzi?", "What's your name?"], ["认识你很高兴。", "Rènshi nǐ hěn gāoxìng.", "Nice to meet you."],
      ["我是学生。", "Wǒ shì xuésheng.", "I am a student."], ["再见！", "Zàijiàn!", "Goodbye!"], ["明天见！", "Míngtiān jiàn!", "See you tomorrow!"]]],
    ["Polite words", [
      ["谢谢！", "Xièxie!", "Thank you!"], ["不客气。", "Bú kèqi.", "You're welcome."], ["对不起。", "Duìbuqǐ.", "Sorry."],
      ["没关系。", "Méi guānxi.", "It doesn't matter."], ["请坐。", "Qǐng zuò.", "Please sit down."], ["没问题。", "Méi wèntí.", "No problem."]]],
    ["Everyday", [
      ["多少钱？", "Duōshao qián?", "How much is it?"], ["太贵了！", "Tài guì le!", "Too expensive!"], ["我想喝水。", "Wǒ xiǎng hē shuǐ.", "I'd like some water."],
      ["厕所在哪儿？", "Cèsuǒ zài nǎr?", "Where is the toilet?"], ["现在几点？", "Xiànzài jǐ diǎn?", "What time is it?"],
      ["我饿了。", "Wǒ è le.", "I'm hungry."], ["我累了。", "Wǒ lèi le.", "I'm tired."], ["加油！", "Jiāyóu!", "You can do it! / Keep going!"]]],
  ];
  function phrases() {
    const p = $("bpane"); p.append(header("Useful phrases", "说"));
    p.append(el("p", "hint", "Tap the speaker to hear each sentence. Say it out loud three times – speaking is the fastest way to remember."));
    PHRASES.forEach(([title, list]) => {
      const c = el("div", "b-card"); c.append(el("h3", null, title));
      list.forEach(([zh, py, en]) => {
        const r = el("div", "u-line"); const t = el("div", "u-txt");
        t.append(el("div", "u-zh", zh), el("div", "u-py", py), el("div", "u-en", en));
        r.append(t, sayBtn(btn => (window.CSSay ? CSSay(zh, btn) : null), "Listen: " + en));
        c.append(r);
      });
      p.append(c);
    });
  }

  /* ---------- 8. Question & measure words ---------- */
  function qwords() {
    const p = $("bpane"); p.append(header("Question & measure words", "问"));
    const c1 = el("div", "b-card"); c1.append(el("h3", null, "Question words"));
    c1.append(el("p", "hint", "Big rule: put the question word where the answer will go. 你叫什么？ → 我叫马丁。 No need to change the word order!"));
    [["什么", "shénme", "what", "你叫什么名字？", "Nǐ jiào shénme míngzi?"], ["谁", "shéi", "who", "她是谁？", "Tā shì shéi?"],
     ["哪", "nǎ", "which", "你是哪国人？", "Nǐ shì nǎ guó rén?"], ["哪儿", "nǎr", "where", "你在哪儿工作？", "Nǐ zài nǎr gōngzuò?"],
     ["几", "jǐ", "how many (small numbers)", "你家有几口人？", "Nǐ jiā yǒu jǐ kǒu rén?"], ["多少", "duōshao", "how many / how much", "多少钱？", "Duōshao qián?"],
     ["多大", "duō dà", "how old", "你多大了？", "Nǐ duō dà le?"], ["怎么", "zěnme", "how (to do)", "汉字怎么写？", "Hànzì zěnme xiě?"],
     ["怎么样", "zěnmeyàng", "how is it", "天气怎么样？", "Tiānqì zěnmeyàng?"], ["什么时候", "shénme shíhou", "when", "你什么时候回家？", "Nǐ shénme shíhou huí jiā?"],
     ["吗", "ma", "yes/no question", "你是学生吗？", "Nǐ shì xuésheng ma?"], ["呢", "ne", "and you? / what about…?", "我很好，你呢？", "Wǒ hěn hǎo, nǐ ne?"]].forEach(([w, py, en, ex, expy]) => {
      const r = el("div", "u-line"); const t = el("div", "u-txt");
      const head = el("div", "u-zh"); head.append(el("b", "qw", w), " " + ex);
      t.append(head, el("div", "u-py", py + " – " + en), el("div", "u-en", expy));
      r.append(t, sayBtn(btn => (window.CSSay ? CSSay(ex, btn) : null), "Listen")); c1.append(r);
    });
    p.append(c1);
    const c2 = el("div", "b-card"); c2.append(el("h3", null, "Measure words"));
    c2.append(el("p", "hint", "In Chinese you can't say “three book”. You need a measure word between the number and the thing: 三本书 (three [volume] books). Before a measure word, “two” is 两: 两个人."));
    [["个", "gè", "people and most things – use it when unsure", "一个人 · 三个杯子"], ["口", "kǒu", "family members", "我家有四口人"],
     ["本", "běn", "books", "两本书"], ["块", "kuài", "money (yuan)", "十块钱"], ["杯", "bēi", "a cup of …", "一杯茶"],
     ["岁", "suì", "years of age", "五岁"], ["些", "xiē", "some", "这些 · 一些水果"], ["点", "diǎn", "o'clock", "八点"], ["分钟", "fēnzhōng", "minutes", "十分钟"]].forEach(([w, py, use, ex]) => {
      const r = el("div", "u-line"); const t = el("div", "u-txt");
      const head = el("div", "u-zh"); head.append(el("b", "qw", w), " " + ex);
      t.append(head, el("div", "u-py", py), el("div", "u-en", use));
      r.append(t, sayBtn(btn => (window.CSSay ? CSSay(ex.split(" · ")[0], btn) : null), "Listen")); c2.append(r);
    });
    p.append(c2);
  }

  /* ---------- 6. Games ---------- */
  const GAMES = [
    ["tone", "Tone Detective", "Listen and pick the tone"],
    ["num", "Number Match", "Match numbers and characters"],
    ["code", "Number Codes", "520, 1314, 888 … what do they say?"],
    ["rad", "Radical Quiz", "What does this radical mean?"],
    ["pic", "Picture Match", "Which character is the picture?"],
    ["idea", "Make a Character", "Put two pictures together"],
  ];
  let best = store.get("bBest", {}), gameId = null, streak = 0, score = 0, total = 0, current = null;
  function games() {
    const p = $("bpane"); p.append(header("Games", "玩"));
    const g = el("div", "b-hub");
    GAMES.forEach(([id, name, sub], i) => {
      const b = el("button", "b-tile t" + (i + 1));
      const s = el("span", "b-tch", ["声", "数", "吉", "部", "象", "明"][i]); const t = el("span", "b-tname", name); const d = el("span", "b-tsub", sub + (best[id] ? " · best streak " + best[id] : ""));
      b.append(s, t, d); b.onclick = () => startGame(id); g.append(b);
    });
    const area = el("div"); area.id = "gameArea"; p.append(g, area);
  }
  function startGame(id) {
    gameId = id; streak = 0; score = 0; total = 0;
    const area = $("gameArea"); if (!area) return;
    area.innerHTML = "";
    const box = el("div", "b-card game"); box.id = "gameBox"; area.append(box);
    nextQ(); box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function nextQ() {
    const box = $("gameBox"); if (!box) return; box.innerHTML = "";
    const name = GAMES.find(g => g[0] === gameId)[1];
    const top = el("div", "g-top"); top.append(el("b", null, name), el("span", "g-score", "Score " + score + "/" + total + " · streak " + streak + (best[gameId] ? " · best " + best[gameId] : "")));
    box.append(top);
    const q = el("div", "g-q"), opts = el("div", "g-opts"), fb = el("p", "g-fb");
    box.append(q, opts, fb);
    let correct, options, label = x => x, onShow = null;
    if (gameId === "tone") {
      const base = B.toneBases[Math.floor(Math.random() * B.toneBases.length)], t = 1 + Math.floor(Math.random() * 4);
      const src = clip("@" + base + t);
      const marks = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù" };
      const mark = (b, tt) => { const v = /a|e/.exec(b) || /ou/.exec(b) || /[aeiou](?!.*[aeiou])/.exec(b); if (!v) return b; const ch = v[0][0], i = v.index; return b.slice(0, i) + marks[ch][tt - 1] + b.slice(i + 1); };
      const play = el("button", "say big"); play.innerHTML = sayIcon + "Play again"; play.onclick = () => playSrc(src, play);
      q.append(el("p", null, "Listen. Which tone do you hear?"), play);
      options = [1, 2, 3, 4]; correct = t; label = x => mark(base, x) + "  (" + ["1st", "2nd", "3rd", "4th"][x - 1] + ")";
      onShow = () => playSrc(src, play);
    } else if (gameId === "num") {
      const n = Math.random() < 0.5 ? Math.floor(Math.random() * 11) : 11 + Math.floor(Math.random() * 89);
      const wrong = new Set(); while (wrong.size < 3) { const w = Math.max(0, n + [-10, -1, 1, 10, 9, -9, 11, 20][Math.floor(Math.random() * 8)]); if (w !== n && w < 100) wrong.add(w); }
      const flip = Math.random() < 0.5;
      if (flip) { q.append(el("p", null, "Which number is this?"), el("div", "g-big", toZh(n))); options = shuffle([n, ...wrong]); label = x => String(x); }
      else { q.append(el("p", null, "How do you write this in Chinese?"), el("div", "g-big num", String(n))); options = shuffle([n, ...wrong]); label = x => toZh(x); }
      correct = n; onShow = null;
    } else if (gameId === "code") {
      const uniq = []; const seen = new Set(); L.codes.forEach(c => { const k = c[0] + c[5]; if (!seen.has(c[0]) && c[0].length > 1) { seen.add(c[0]); uniq.push(c); } });
      const it = uniq[Math.floor(Math.random() * uniq.length)];
      const wrongs = pickN(uniq.filter(c => c[5] !== it[5]), 3, it);
      if (Math.random() < 0.6) { q.append(el("p", null, "Your friend sends you this number. What does it mean?"), el("div", "g-big num", it[0])); label = x => x[7] + " " + x[5]; }
      else { q.append(el("p", null, "Which number says this?"), el("div", "g-big lk-gq", it[7] + " " + it[3]), el("p", "hint", it[4] + " – " + it[5])); label = x => x[0]; }
      options = shuffle([it, ...wrongs]); correct = it;
    } else if (gameId === "rad") {
      const pool = B.radicals.filter(r => r.common && r.n > 6);
      const r = pool[Math.floor(Math.random() * pool.length)];
      const wrongs = pickN(pool, 3, r);
      q.append(el("p", null, "What does this radical mean?"), el("div", "g-big", r.v && r.v !== r.r ? r.v : (r.s || r.r)));
      if (r.ex.length) q.append(el("p", "hint", "Found in: " + r.ex.slice(0, 3).map(e => e[0]).join(" ")));
      options = shuffle([r, ...wrongs]); correct = r; label = x => x.m;
    } else if (gameId === "idea") {
      const it = B.ideas[Math.floor(Math.random() * B.ideas.length)];
      const wrongs = pickN(B.ideas, 3, it);
      q.append(el("p", null, "Which character do these make?"), el("div", "g-parts", it[3]), el("p", "hint", "Meaning: " + it[2]));
      options = shuffle([it, ...wrongs]); correct = it; label = x => x[0];
    } else {
      const pic = B.picto[Math.floor(Math.random() * B.picto.length)];
      const wrongs = pickN(B.picto, 3, pic);
      const art = el("div", "g-art"); art.append(sketch(pic[5]), el("span", "emo-badge", pic[3]));
      q.append(el("p", null, "Which character comes from this picture?"), art, el("p", "hint", pic[2]));
      options = shuffle([pic, ...wrongs]); correct = pic; label = x => x[0];
    }
    options.forEach(o => {
      const b = el("button", "g-opt" + (gameId === "num" || gameId === "pic" || gameId === "idea" ? " zh" : ""), label(o));
      b.onclick = () => {
        if (opts.dataset.done) return; opts.dataset.done = "1"; total++;
        const ok = o === correct;
        if (ok) { score++; streak++; if (streak > (best[gameId] || 0)) { best[gameId] = streak; store.set("bBest", best); } b.classList.add("right"); fb.textContent = ["Correct! 对了！", "Great! 很好！", "Yes! 太好了！"][Math.floor(Math.random() * 3)]; fb.className = "g-fb good"; box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); }
        else {
          streak = 0; b.classList.add("wrong"); fb.className = "g-fb bad";
          [...opts.children].forEach((x, i) => { if (options[i] === correct) x.classList.add("right"); });
          fb.textContent = "Not quite – the answer is " + label(correct) + ".";
        }
        if (gameId === "pic") { sayChar(correct[0]); fb.textContent += " " + correct[0] + " " + correct[1] + ": " + correct[4]; }
        if (gameId === "num") saySeq([...toZh(correct)]);
        if (gameId === "code") { fb.textContent += " " + correct[0] + " → " + correct[3] + " (" + correct[4] + ")" + (correct[6] ? ". " + correct[6] : ""); window.CSSay && CSSay(correct[1] + "，" + correct[3]); }
        if (gameId === "rad") fb.textContent += " " + (correct.o || "");
        if (gameId === "idea") { sayChar(correct[0]); fb.textContent += " " + correct[0] + " " + correct[1] + " – " + correct[4]; }
        const nx = el("button", "primarybtn", "Next ›"); nx.onclick = nextQ; box.append(nx); nx.focus();
        box.querySelector(".g-score").textContent = "Score " + score + "/" + total + " · streak " + streak + " · best " + (best[gameId] || 0);
      };
      opts.append(b);
    });
    if (onShow) setTimeout(onShow, 250);
  }

  /* ---------- init ---------- */
  window.CSBasics = { go, stop: () => chantStop(), home: () => { if (curSec !== "hub") go("hub"); else window.scrollTo({ top: 0, behavior: "smooth" }); } };
  go(store.get("bsec", "hub"));
})();
