/* Basics: sounds, numbers, strokes, radicals, picture characters and games. Uses BASICS, BSTROKES (basics-data.js). */
(function () {
  "use strict";
  const B = window.BASICS; if (!B) return;
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
    top.append(big, info); body.append(top);
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
    ["strokes", "笔", "Strokes", "The basic strokes & the order rules"],
    ["radicals", "部", "Radicals", "All 214 building blocks, with origins"],
    ["pictures", "象", "Picture characters", "How drawings became characters"],
    ["games", "玩", "Games", "Tones, numbers, radicals & pictures"],
  ];
  function hub() {
    const p = $("bpane"); p.innerHTML = "";
    const intro = el("div", "b-intro");
    intro.append(el("h2", null, "Chinese from zero"), el("p", null, "Chinese has no alphabet. Each character is a syllable with a meaning, built from strokes and smaller parts. Start with the sounds, then learn how characters are built."));
    p.append(intro);
    const g = el("div", "b-hub");
    SECTIONS.forEach(([id, ch, name, sub], i) => {
      const b = el("button", "b-tile t" + i);
      const s = el("span", "b-tch", ch); const t = el("span", "b-tname", name); const d = el("span", "b-tsub", sub);
      b.append(s, t, d); b.onclick = () => go(id); g.append(b);
    });
    p.append(g);
  }
  function header(title, zh) {
    const h = el("div", "b-head");
    const back = el("button", "ghost b-back", "‹ Back"); back.onclick = () => { if (!(window.CSNav && CSNav.done(secTok))) go("hub"); };
    const t = el("h2", null); t.innerHTML = '<span class="b-hz"></span>'; t.firstChild.textContent = zh; t.append(" " + title);
    h.append(back, t); return h;
  }
  let curSec = "hub", secTok = null;
  function go(id) {
    if (id !== curSec && window.CSNav && !CSNav.restoring) { const prev = curSec; secTok = CSNav.push(() => go(prev)); }
    curSec = id;
    store.set("bsec", id); seqToken++;
    const p = $("bpane"); p.innerHTML = "";
    ({ hub, sounds, numbers, strokes, radicals, pictures, games }[id] || hub)();
    $("paneB").scrollIntoView({ block: "start" });
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
    const play = el("button", "primarybtn", "Play Tone Detective"); play.onclick = () => go("games"); p.append(play);
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
    c3.append(el("p", "hint", "Lucky and unlucky: 8 八 bā sounds like 发 fā “get rich” – very lucky. 4 四 sì sounds like 死 sǐ “death”, so many buildings skip the 4th floor."));
    p.append(c3);
    const play = el("button", "primarybtn", "Play Number Match"); play.onclick = () => { go("games"); startGame("num"); }; p.append(play);
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
    c1.innerHTML = "<p>Chinese writing is over <b>3,000 years old</b>. The oldest characters were carved on turtle shells and animal bones (甲骨文, “oracle bones”) during the Shang dynasty. Many began as simple <b>drawings</b>. Over centuries the drawings became straighter and simpler, until they looked like today's characters.</p><p>Characters are built in three main ways:</p>";
    p.append(c1);
    const sec = (title, zh, note) => { const h = el("div", "b-sec"); const t = el("h3"); t.innerHTML = "<span class='b-hz'></span> "; t.firstChild.textContent = zh; t.append(title); h.append(t, el("p", "hint", note)); p.append(h); };
    sec("1. Pictures", "象形", "A drawing of the thing itself. Tap a card to see the character, hear it, and read its story.");
    const g = el("div", "picgrid");
    B.picto.forEach(([c, py, m, emo, story]) => {
      const b = el("button", "pic"); b.innerHTML = '<span class="pe"></span><span class="pc"></span><span class="pm"></span>';
      b.children[0].textContent = emo; b.children[1].textContent = c; b.children[2].textContent = m;
      b.onclick = () => openSheet({ c, py, mean: m, story: emo + "  " + story });
      g.append(b);
    });
    p.append(g);
    sec("2. Ideas", "会意", "Two or more pictures put together to make a new idea.");
    const g2 = el("div", "idealist");
    B.ideas.forEach(([c, py, m, parts, story]) => {
      const b = el("button", "idea"); b.innerHTML = '<span class="ic"></span><span class="it"><span class="ip"></span><span class="im"></span></span>';
      b.children[0].textContent = c; b.querySelector(".ip").textContent = parts; b.querySelector(".im").textContent = "= " + m;
      b.onclick = () => openSheet({ c, py, mean: m, forms: parts, story });
      g2.append(b);
    });
    p.append(g2);
    sec("3. Meaning + sound", "形声", "About 80% of characters work like this: one part (often the radical) shows the meaning, the other part shows the sound. This is your secret weapon for guessing new characters!");
    const g3 = el("div", "idealist");
    B.sounds.forEach(([c, py, m, parts]) => {
      const b = el("button", "idea"); b.innerHTML = '<span class="ic"></span><span class="it"><span class="ip"></span><span class="im"></span></span>';
      b.children[0].textContent = c; b.querySelector(".ip").textContent = parts; b.querySelector(".im").textContent = py + " = " + m;
      b.onclick = () => openSheet({ c, py, mean: m, forms: parts, story: "Look at the parts: the meaning part tells you what it is about, the sound part tells you roughly how to say it." });
      g3.append(b);
    });
    p.append(g3);
    const play = el("button", "primarybtn", "Play Picture Match"); play.onclick = () => { go("games"); startGame("pic"); }; p.append(play);
  }

  /* ---------- 6. Games ---------- */
  const GAMES = [
    ["tone", "Tone Detective", "Listen and pick the tone"],
    ["num", "Number Match", "Match numbers and characters"],
    ["rad", "Radical Quiz", "What does this radical mean?"],
    ["pic", "Picture Match", "Which character is the picture?"],
  ];
  let best = store.get("bBest", {}), gameId = null, streak = 0, score = 0, total = 0, current = null;
  function games() {
    const p = $("bpane"); p.append(header("Games", "玩"));
    const g = el("div", "b-hub");
    GAMES.forEach(([id, name, sub], i) => {
      const b = el("button", "b-tile t" + (i + 1));
      const s = el("span", "b-tch", ["声", "数", "部", "象"][i]); const t = el("span", "b-tname", name); const d = el("span", "b-tsub", sub + (best[id] ? " · best streak " + best[id] : ""));
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
    } else if (gameId === "rad") {
      const pool = B.radicals.filter(r => r.common && r.n > 6);
      const r = pool[Math.floor(Math.random() * pool.length)];
      const wrongs = pickN(pool, 3, r);
      q.append(el("p", null, "What does this radical mean?"), el("div", "g-big", r.v && r.v !== r.r ? r.v : (r.s || r.r)));
      if (r.ex.length) q.append(el("p", "hint", "Found in: " + r.ex.slice(0, 3).map(e => e[0]).join(" ")));
      options = shuffle([r, ...wrongs]); correct = r; label = x => x.m;
    } else {
      const pic = B.picto[Math.floor(Math.random() * B.picto.length)];
      const wrongs = pickN(B.picto, 3, pic);
      q.append(el("p", null, "Which character comes from this picture?"), el("div", "g-big emo", pic[3]), el("p", "hint", pic[2]));
      options = shuffle([pic, ...wrongs]); correct = pic; label = x => x[0];
    }
    options.forEach(o => {
      const b = el("button", "g-opt" + (gameId === "num" || gameId === "pic" ? " zh" : ""), label(o));
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
        if (gameId === "rad") fb.textContent += " " + (correct.o || "");
        const nx = el("button", "primarybtn", "Next ›"); nx.onclick = nextQ; box.append(nx); nx.focus();
        box.querySelector(".g-score").textContent = "Score " + score + "/" + total + " · streak " + streak + " · best " + (best[gameId] || 0);
      };
      opts.append(b);
    });
    if (onShow) setTimeout(onShow, 250);
  }

  /* ---------- init ---------- */
  window.CSBasics = { go };
  go(store.get("bsec", "hub"));
})();
