/* Use tab: Chinese name maker, dates & time & birthday, word lab (recipes + sentence builder) */
(function () {
  "use strict";
  const T = window.TOOLS; if (!T) return;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const sayIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ---------- smart speaker: recorded words first, then recorded characters, else phone voice ---------- */
  const player = new Audio(); let tokn = 0;
  function srcFor(seg) {
    const A = window.AUDIO && AUDIO[seg];
    if (A && (A[1] || A[2])) return "audio/" + (A[1] ? "v1" : "v2") + "/" + A[0] + ".mp3";
    const r = (window.BASICS && BASICS.audio[seg]) || (window.TAUDIO && TAUDIO[seg]);
    return r ? "audio/" + r + ".mp3" : null;
  }
  function segment(text) {
    const s = [...text.replace(/〇/g, "零").replace(/[，。！？、：；,.!?\s·]/g, "")], out = [];
    let i = 0;
    while (i < s.length) {
      let done = false;
      for (let L = Math.min(5, s.length - i); L >= 1; L--) {
        const w = s.slice(i, i + L).join(""), src = srcFor(w);
        if (src) { out.push(src); i += L; done = true; break; }
      }
      if (!done) return null;
    }
    return out;
  }
  function tts(text, btn) {
    try {
      const sy = window.speechSynthesis; if (!sy) return;
      sy.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.85;
      if (btn) { btn.classList.add("playing"); u.onend = u.onerror = () => btn.classList.remove("playing"); }
      sy.speak(u);
    } catch (e) {}
  }
  function playOne(src) {
    return new Promise(res => { player.src = src; player.onended = () => res(true); player.onerror = () => res(false); const p = player.play(); if (p && p.catch) p.catch(() => res(false)); });
  }
  async function say(text, btn) {
    const my = ++tokn; try { player.pause(); } catch (e) {}
    const segs = segment(text);
    if (!segs) return tts(text, btn);
    if (btn) btn.classList.add("playing");
    for (const s of segs) { if (my !== tokn) break; if (!(await playOne(s))) { tts(text); break; } }
    if (btn) btn.classList.remove("playing");
  }
  window.CSSay = say;
  function sayBtn(getText, label, big) {
    const b = el("button", big ? "say" : "say mini"); b.innerHTML = sayIcon + (big ? "Listen" : ""); b.setAttribute("aria-label", label || "Listen");
    b.onclick = e => { e.stopPropagation(); say(typeof getText === "function" ? getText() : getText, b); }; return b;
  }

  /* ---------- numbers → Chinese ---------- */
  const DIG = "零一二三四五六七八九";
  const PY = { "零": "líng", "一": "yī", "二": "èr", "三": "sān", "四": "sì", "五": "wǔ", "六": "liù", "七": "qī", "八": "bā", "九": "jiǔ", "十": "shí", "两": "liǎng" };
  function small(n) { // 0..99
    if (n < 10) return DIG[n];
    const t = Math.floor(n / 10), o = n % 10;
    return (t === 1 ? "" : DIG[t]) + "十" + (o ? DIG[o] : "");
  }
  const numPy = s => [...s].map(c => PY[c] || c).join("");
  const yearZh = y => [...String(y)].map(d => "〇一二三四五六七八九"[+d]).join("") + "年";
  const yearPy = y => [...String(y)].map(d => PY[DIG[+d]]).join(" ") + " nián";
  const WD = ["日", "一", "二", "三", "四", "五", "六"], WDPY = ["rì", "yī", "èr", "sān", "sì", "wǔ", "liù"];
  function dateZh(d) { return yearZh(d.getFullYear()) + small(d.getMonth() + 1) + "月" + small(d.getDate()) + "日"; }
  function datePy(d) { return yearPy(d.getFullYear()) + " " + numPy(small(d.getMonth() + 1)) + " yuè " + numPy(small(d.getDate())) + " rì"; }
  const wdZh = d => "星期" + WD[d.getDay()], wdPy = d => "xīngqī" + (WDPY[d.getDay()] === "èr" ? "'èr" : WDPY[d.getDay()]);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  /* ---------- layout helpers ---------- */
  function header(title, zh) {
    const h = el("div", "b-head");
    const back = el("button", "ghost b-back", "‹ Back"); back.onclick = () => go("hub");
    const t = el("h2"); const z = el("span", "b-hz", zh); t.append(z, " " + title); h.append(back, t); return h;
  }
  function card(title) { const c = el("div", "b-card"); if (title) c.append(el("h3", null, title)); return c; }
  function line(zh, py, en, sayText) {
    const r = el("div", "u-line");
    const t = el("div", "u-txt"); t.append(el("div", "u-zh", zh)); if (py) t.append(el("div", "u-py", py)); if (en) t.append(el("div", "u-en", en));
    r.append(t, sayBtn(sayText || zh)); return r;
  }

  /* ---------- hub ---------- */
  function hub() {
    const p = $("upane"); p.innerHTML = "";
    const intro = el("div", "b-intro");
    intro.append(el("h2", null, "Use your Chinese"), el("p", null, "Make your Chinese name, say any date, time or your birthday, and build your own words and sentences."));
    p.append(intro);
    const g = el("div", "b-hub one");
    [["name", "名", "My Chinese name", "Get a name and surname that suits you"],
     ["dates", "日", "Dates & time", "Calendar, days, months, clock and your birthday"],
     ["words", "词", "Word lab", "How words are made, and a sentence builder"]].forEach(([id, ch, n, s], i) => {
      const b = el("button", "b-tile t" + (i * 2)); b.append(el("span", "b-tch", ch), el("span", "b-tname", n), el("span", "b-tsub", s)); b.onclick = () => go(id); g.append(b);
    });
    p.append(g);
  }
  function go(id) { store.set("usec", id); tokn++; const p = $("upane"); p.innerHTML = ""; ({ hub, name, dates, words }[id] || hub)(); }

  /* ---------- 1. Chinese name ---------- */
  const FAM = { b: "bp", p: "bp", d: "dt", t: "dt", g: "gk", k: "gk", j: "jqzh", q: "qjch", x: "xsh", zh: "zhj", ch: "chq", sh: "shx", z: "zj", c: "cq", s: "sx", l: "lr", r: "rl", n: "nl", m: "m", f: "f", h: "h", y: "y", w: "w", "": "" };
  function chunks(word) {
    let w = word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    w = w.replace(/^m(?=[bp])/, "").replace(/^n(?=[dgjt])/, "").replace(/ph/g, "f").replace(/th/g, "t").replace(/v/g, "w").replace(/ck/g, "k").replace(/c(?=[aou])/g, "k").replace(/c(?=[eiy])/g, "s").replace(/oo/g, "u").replace(/ee/g, "i");
    return w.match(/[^aeiouy]*[aeiouy]+(?:ng|n(?![aeiouy])|r(?![aeiouy]))?/g) || (w ? [w] : []);
  }
  function parse(ch) {
    const m = /^(zh|ch|sh|[bcdfghjklmnpqrstwxyz]*)/.exec(ch); let ini = m[1];
    if (ini.length > 2 || (ini.length === 2 && !["zh", "ch", "sh"].includes(ini))) ini = ini.slice(-1);
    if (ini === "r") ini = "l";
    return { ini, vow: ch.slice(m[1].length).replace(/[^aeiouy]/g, "")[0] || "" };
  }
  function plainPy(py) { return py.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ü/g, "u"); }
  function score(py, c) {
    const p = plainPy(py), pi = /^(zh|ch|sh|[bcdfghjklmnpqrstwxyz]?)/.exec(p)[1], pv = p.slice(pi.length)[0] || "";
    let s = 0;
    if (pi === c.ini) s += 3; else if ((FAM[c.ini] || "").includes(pi) && pi) s += 1.5; else if (!c.ini && (pi === "y" || pi === "w" || !pi)) s += 2;
    if (pv === c.vow) s += 2; else if ("ae".includes(pv) && "ae".includes(c.vow) || "ou".includes(pv) && "ou".includes(c.vow) || "iy".includes(pv) && "iy".includes(c.vow)) s += 1;
    return s;
  }
  function best(list, c, n, filter) { return list.filter(filter || (() => true)).map(x => [x, score(x[1], c) + Math.random() * 0.4]).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]); }
  /* opts: {first, last, style: n|m|f, mode: "sound"|"meaning", traits: [ids]} → list of names with descriptions */
  function suggest(opts) {
    const o = Object.assign({ first: "", last: "", style: "n", mode: "sound", traits: [] }, opts || {});
    const fc = chunks(o.first).map(parse), lc = chunks(o.last).map(parse);
    const okStyle = x => o.style === "n" || x[3] === o.style || x[3] === "n";
    const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
    // surnames
    let surs;
    if (lc.length) surs = best(T.surnames.filter(s => s[0].length === 1), lc[0], 4).map(s => [s, s[0] + " " + s[1] + " sounds like your surname " + o.last + (/^an? (old|ancient)/.test(s[2]) ? " – it is a real Chinese surname (" + s[2] + ")" : " and means “" + s[2] + "”")]);
    else if (o.mode === "meaning") surs = shuffleTake(T.meaningSurnames, 4).map(s => [s, "a real Chinese surname meaning “" + s[2] + "”"]);
    else surs = shuffleTake(T.surnames.filter(s => s[0].length === 1), 4).map(s => [s, "a common Chinese surname"]);
    const out = [], seen = new Set();
    const push = (sur, given, why, label) => {
      if (!given.length || given.some((g, i) => given.findIndex(h => h[0] === g[0] || plainPy(h[1]) === plainPy(g[1])) !== i)) return;
      if (given.some(g => g[0] === sur[0][0])) return;
      const zh = sur[0][0] + given.map(g => g[0]).join("");
      if (seen.has(zh)) return; seen.add(zh);
      out.push({ zh, py: sur[0][1] + " " + cap(given.map(g => g[1]).reduce((s, p) => s + (s && /^[aoeāáǎàōóǒòēéěè]/.test(p) ? "'" : "") + p, "")),
        parts: [[sur[0][0], sur[0][1], "surname – " + sur[0][2]]].concat(given.map(g => [g[0], g[1], g[2]])),
        meaning: given.map(g => g[2]).join(" + "), why: [sur[1]].concat(why), label });
    };
    if (o.mode === "meaning") {
      const picked = o.traits.length ? T.traits.filter(x => o.traits.includes(x[0])) : shuffleTake(T.traits, 2);
      const pools = picked.map(tr => ({ tr, chars: tr[3].filter(okStyle) })).filter(p => p.chars.length);
      if (!pools.length) return [];
      const soundy = fc[0] ? c => score(c[1], fc[0]) : () => 0;
      const label = picked.map(x => x[1]).join(" + ");
      for (let i = 0; i < 12 && out.length < 6; i++) {
        const sur = surs[i % surs.length];
        const A = pools[i % pools.length], B = pools[(i + 1) % pools.length];
        let ca = shuffleTake(A.chars, A.chars.length).sort((x, y) => soundy(y) - soundy(x) + (Math.random() - .5) * 2);
        const c1 = ca[i % Math.min(3, ca.length)];
        const cb = shuffleTake(B.chars.filter(c => c[0] !== c1[0]), 3);
        const why = [];
        why.push(c1[0] + " " + c1[1] + " – chosen for " + A.tr[1].toLowerCase());
        if (fc[0] && soundy(c1) >= 3) why.push(c1[0] + " also sounds a little like " + o.first);
        if (cb[0] && (i % 3 !== 2)) { why.push(cb[0][0] + " " + cb[0][1] + " – chosen for " + B.tr[1].toLowerCase()); push(sur, [c1, cb[0]], why, label); }
        else push(sur, [c1], why, label);
      }
    } else {
      const g1 = fc[0] ? best(T.given, fc[0], 3, okStyle) : shuffleTake(T.given.filter(okStyle), 3);
      const g2 = fc[1] ? best(T.given, fc[1], 3, okStyle) : [];
      surs.forEach((s, i) => {
        const a = g1[i % g1.length], b = g2.length ? g2[(i + 1) % g2.length] : null;
        const w1 = a[0] + " " + a[1] + " sounds like “" + (chunks(o.first)[0] || "") + "” in " + o.first;
        push(s, [a], [w1], "Sounds like your name");
        if (b) push(s, [a, b], [w1, b[0] + " " + b[1] + " sounds like “" + chunks(o.first)[1] + "”"], "Sounds like your name");
      });
    }
    return out.slice(0, 6);
  }
  function name() {
    const p = $("upane"); p.append(header("My Chinese name", "名"));
    const c1 = card();
    c1.innerHTML = "<p>A Chinese name has the <b>surname first</b> (usually one character), then the <b>given name</b> (one or two characters). 王明 = surname 王 Wáng + name 明 Míng (“bright”).</p><p>Choose a name that <b>sounds like your own name</b>, or one that describes <b>who you are or want to be</b> – hardworking, honest in business, faithful, kind… Every character in these suggestions has a good meaning.</p>";
    p.append(c1);
    const saved = store.get("myName", null);
    if (saved) { const s = card("Your Chinese name"); s.append(nameCard(saved, true)); p.append(s); }
    const f = card("Find a name");
    const box = el("div"); f.append(box); p.append(f);
    const res = el("div", "n-res"); p.append(res);
    buildPicker(box, res, n => { store.set("myName", n); window.CSGreet && CSGreet(); go("name"); });
    const own = card("Already have a Chinese name?");
    own.innerHTML += '<p class="hint">Maybe your teacher gave you one. Type it here.</p><div class="n-form"><label for="oZh">Chinese characters</label><input id="oZh" lang="zh" maxlength="6" placeholder="e.g. 王明"><label for="oPy">Pinyin</label><input id="oPy" maxlength="40" placeholder="e.g. Wáng Míng"><button id="oSave" class="ghost">Save my Chinese name</button><p class="hint" id="oMsg"></p></div>';
    p.append(own);
    $("oSave").onclick = () => {
      const zh = $("oZh").value.replace(/\s+/g, ""), py = $("oPy").value.trim();
      if (!/^[㐀-鿿]{1,6}$/.test(zh)) { $("oMsg").textContent = "Type your name in Chinese characters (1 to 6 characters)."; return; }
      store.set("myName", { zh, py, parts: [] }); window.CSGreet && CSGreet(); go("name");
    };
  }
  /* shared picker used here and in the welcome tour */
  function buildPicker(box, res, onChoose, compact) {
    const pr = store.get("profile", { first: "", last: "" }) || {};
    const st = { mode: store.get("nameMode", "meaning"), traits: store.get("nameTraits", []), style: "n" };
    box.innerHTML = "";
    const modes = el("div", "voices n-modes");
    [["meaning", "By meaning"], ["sound", "Sounds like my name"]].forEach(([m, l]) => {
      const b = el("button", null, l); b.setAttribute("aria-pressed", String(st.mode === m));
      b.onclick = () => { st.mode = m; store.set("nameMode", m); modes.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); draw(); run(); };
      modes.append(b);
    });
    box.append(modes);
    const area = el("div", "n-area"); box.append(area);
    function draw() {
      area.innerHTML = "";
      const f = el("div", "n-form");
      if (!compact || st.mode === "sound") {
        f.innerHTML = '<div class="n-two"><span><label for="pkFirst">First name</label><input id="pkFirst" autocomplete="given-name" placeholder="e.g. Awa"></span><span><label for="pkLast">Surname</label><input id="pkLast" autocomplete="family-name" placeholder="e.g. Ceesay"></span></div>';
      }
      const sty = el("div", "n-style"); sty.innerHTML = '<label for="pkStyle">Style</label><select id="pkStyle"><option value="n">Any</option><option value="m">Boy / man</option><option value="f">Girl / woman</option></select>';
      f.append(sty); area.append(f);
      if ($("pkFirst")) { $("pkFirst").value = pr.first || ""; $("pkLast").value = pr.last || ""; }
      $("pkStyle").value = st.style; $("pkStyle").onchange = () => { st.style = $("pkStyle").value; run(); };
      if (st.mode === "meaning") {
        area.append(el("p", "hint", "Pick up to two qualities. Your name is optional here – if you type it, the app also tries to match its sound."));
        const chips = el("div", "traits");
        T.traits.forEach(tr => {
          const c = el("button", "trait"); c.append(el("b", null, tr[1]), el("span", null, tr[2]));
          c.setAttribute("aria-pressed", String(st.traits.includes(tr[0])));
          c.onclick = () => {
            if (st.traits.includes(tr[0])) st.traits = st.traits.filter(x => x !== tr[0]);
            else { st.traits.push(tr[0]); if (st.traits.length > 2) st.traits.shift(); }
            store.set("nameTraits", st.traits);
            chips.querySelectorAll(".trait").forEach((x, i) => x.setAttribute("aria-pressed", String(st.traits.includes(T.traits[i][0]))));
            run();
          };
          chips.append(c);
        });
        area.append(chips);
      } else area.append(el("p", "hint", "Type your first name and surname. The suggestions sound a little like them."));
      const go2 = el("button", "primarybtn", "Suggest names"); go2.onclick = run; area.append(go2);
    }
    function run() {
      if ($("pkFirst")) { pr.first = $("pkFirst").value.trim(); pr.last = $("pkLast").value.trim(); store.set("profile", { first: pr.first, last: pr.last }); window.CSGreet && CSGreet(); }
      res.innerHTML = "";
      if (st.mode === "sound" && !pr.first && !pr.last) { res.append(el("p", "hint", "Type your first name or surname, or switch to “By meaning”.")); return; }
      const list = suggest({ first: pr.first, last: pr.last, style: st.style, mode: st.mode, traits: st.traits });
      if (!list.length) { res.append(el("p", "hint", "No names for that choice. Try another quality or style.")); return; }
      list.forEach(n => res.append(compact ? miniName(n, onChoose) : (c => { c.classList.add("n-sug"); c.append(nameCard(n, false, onChoose)); return c; })(card())));
    }
    draw();
    if (st.mode === "meaning" || pr.first || pr.last) run();
  }
  function miniName(n, onChoose) {
    const c = el("button", "ob-name");
    c.append(el("span", "obn-zh", n.zh));
    const m = el("span", "obn-m"); m.append(el("span", "obn-py", n.py), el("span", "obn-mean", n.meaning + (n.label ? " · " + n.label : "")));
    c.append(m);
    c.onclick = () => { document.querySelectorAll(".ob-name").forEach(x => x.setAttribute("aria-pressed", String(x === c))); onChoose(n); say(n.zh); };
    return c;
  }
  function shuffleTake(a, n) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
  function nameCard(n, isMine, onChoose) {
    const w = el("div", "n-card");
    const top = el("div", "n-top");
    top.append(el("div", "n-zh", n.zh));
    const meta = el("div", "n-meta"); meta.append(el("div", "n-py", n.py || ""), sayBtn(n.zh, "Listen to the name", true)); top.append(meta);
    w.append(top);
    if (n.meaning) { const d = el("p", "n-desc"); d.append(el("b", null, "Meaning: "), n.meaning); if (n.label) d.append(el("span", "n-tag", n.label)); w.append(d); }
    const ul = el("ul", "n-parts"); (n.parts || []).forEach(([c, py, m]) => { const li = el("li"); li.append(el("b", null, c), " " + py + " – " + m); ul.append(li); }); w.append(ul);
    if (n.why && n.why.length) { const wy = el("details", "help n-why"); wy.append(el("summary", null, "Why this name?")); const l = el("ul", "n-parts"); n.why.forEach(x => l.append(el("li", null, x))); wy.append(l); w.append(wy); }
    const intro = el("p", "n-intro"); intro.textContent = "我叫" + n.zh + "。" + (n.py ? " (Wǒ jiào " + n.py + ".) – My name is " + n.py + "." : "");
    w.append(intro);
    if (!isMine) { const b = el("button", "ghost", "Make this my name"); b.onclick = () => (onChoose ? onChoose(n) : (store.set("myName", n), window.CSGreet && CSGreet(), go("name"))); w.append(b); }
    else { const b = el("button", "ghost", "Remove my name"); b.onclick = () => { store.set("myName", null); window.CSGreet && CSGreet(); go("name"); }; w.append(b); }
    return w;
  }

  /* ---------- 2. Dates & time ---------- */
  let calY, calM;
  function dates() {
    const p = $("upane"); p.append(header("Dates & time", "日"));
    const now = new Date();
    // today
    const c0 = card("Today");
    c0.append(line(dateZh(now), datePy(now), now.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })));
    c0.append(line(wdZh(now), wdPy(now), T.weekdays[(now.getDay() + 6) % 7][2]));
    c0.append(el("p", "hint", "Chinese dates go from big to small: year 年 → month 月 → day 日 (or 号 when speaking) → weekday."));
    p.append(c0);
    // calendar
    const c1 = card("Calendar"); c1.append(el("p", "hint", "Tap any day to hear how to say it."));
    const cal = el("div", "cal"); const sel = el("div", "cal-sel"); c1.append(cal, sel); p.append(c1);
    calY = now.getFullYear(); calM = now.getMonth();
    function pick(d) {
      sel.innerHTML = "";
      const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      const rel = T.dayWords.find(x => x[3] === diff);
      sel.append(line(dateZh(d), datePy(d), d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })));
      sel.append(line(wdZh(d), wdPy(d), T.weekdays[(d.getDay() + 6) % 7][2]));
      const spoken = small(d.getMonth() + 1) + "月" + small(d.getDate()) + "号";
      sel.append(line(spoken, numPy(small(d.getMonth() + 1)) + " yuè " + numPy(small(d.getDate())) + " hào", "Spoken: people usually say 号 hào instead of 日 rì"));
      if (rel) sel.append(line(rel[0] + "是" + small(d.getMonth() + 1) + "月" + small(d.getDate()) + "号", rel[1] + " shì …", rel[2][0].toUpperCase() + rel[2].slice(1) + " is " + d.toDateString().slice(4, 10)));
      cal.querySelectorAll(".on").forEach(x => x.classList.remove("on"));
      const btn = cal.querySelector('[data-d="' + d.getDate() + '"]'); if (btn) btn.classList.add("on");
    }
    function drawCal() {
      cal.innerHTML = "";
      const head = el("div", "cal-head");
      const prev = el("button", "ghost", "‹"); prev.setAttribute("aria-label", "Previous month");
      const next = el("button", "ghost", "›"); next.setAttribute("aria-label", "Next month");
      const title = el("div", "cal-title"); const tz = calY + "年" + small(calM + 1) + "月";
      title.append(el("span", "cal-zh", tz), el("span", "cal-en", T.months[calM] + " " + calY));
      head.append(prev, title, sayBtn(yearZh(calY) + small(calM + 1) + "月", "Listen to the month"), next);
      prev.onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } drawCal(); };
      next.onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } drawCal(); };
      cal.append(head);
      const grid = el("div", "cal-grid");
      ["一", "二", "三", "四", "五", "六", "日"].forEach(w => grid.append(el("div", "cal-wd", w)));
      const first = new Date(calY, calM, 1), off = (first.getDay() + 6) % 7, days = new Date(calY, calM + 1, 0).getDate();
      for (let i = 0; i < off; i++) grid.append(el("div"));
      for (let d = 1; d <= days; d++) {
        const dt = new Date(calY, calM, d);
        const b = el("button", "cal-d" + (sameDay(dt, now) ? " today" : "") + (dt.getDay() % 6 === 0 ? " wk" : ""), String(d)); b.dataset.d = d;
        b.setAttribute("aria-label", dateZh(dt));
        b.onclick = () => { pick(dt); say(small(calM + 1) + "月" + small(d) + "号" + wdZh(dt)); };
        grid.append(b);
      }
      cal.append(grid);
    }
    drawCal(); pick(now);
    // weekdays & months
    const c2 = card("Days of the week"); c2.append(el("p", "hint", "Easy: 星期 (week) + a number. Monday is day one. Sunday is 星期日 or 星期天."));
    const wl = el("div", "u-grid"); T.weekdays.forEach(([z, py, en]) => wl.append(line(z, py, en))); c2.append(wl); p.append(c2);
    const c3 = card("Months"); c3.append(el("p", "hint", "Even easier: a number + 月 (moon). January = 一月, December = 十二月."));
    const ml = el("div", "u-grid"); T.months.forEach((en, i) => ml.append(line(small(i + 1) + "月", numPy(small(i + 1)) + " yuè", en))); c3.append(ml); p.append(c3);
    // time
    const c4 = card("What time is it?");
    const clock = el("div", "clock"); const tin = el("input"); tin.type = "time"; tin.id = "tIn"; tin.setAttribute("aria-label", "Time");
    const nowBtn = el("button", "ghost", "Now");
    const row = el("div", "arow"); row.append(tin, nowBtn); c4.append(row, clock);
    c4.append(el("p", "hint", "Parts of the day: 早上 early morning · 上午 morning · 中午 noon · 下午 afternoon · 晚上 evening. Say them before the time: 下午三点 = 3 pm."));
    p.append(c4);
    const setNow = () => { const d = new Date(); tin.value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); drawTime(); };
    function drawTime() {
      clock.innerHTML = "";
      const [h, m] = (tin.value || "00:00").split(":").map(Number);
      const part = h < 5 ? ["凌晨", "língchén", "early morning"] : h < 9 ? ["早上", "zǎoshang", "morning"] : h < 12 ? ["上午", "shàngwǔ", "morning"] : h < 13 ? ["中午", "zhōngwǔ", "noon"] : h < 18 ? ["下午", "xiàwǔ", "afternoon"] : ["晚上", "wǎnshang", "evening"];
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const hz = h12 === 2 ? "两" : small(h12), hpy = h12 === 2 ? "liǎng" : numPy(small(h12));
      const mz = m === 0 ? "" : (m < 10 ? "零" + DIG[m] : small(m)) + "分", mpy = m === 0 ? "" : " " + (m < 10 ? "líng " + PY[DIG[m]] : numPy(small(m))) + " fēn";
      const full = part[0] + hz + "点" + mz;
      clock.append(el("div", "clock-big", String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0")));
      clock.append(line("现在" + full, "xiànzài " + part[1] + " " + hpy + " diǎn" + mpy, "It is " + (h12) + ":" + String(m).padStart(2, "0") + " in the " + part[2]));
      const alt = [];
      if (m === 30) alt.push([part[0] + hz + "点半", "… diǎn bàn", "半 bàn = half past"]);
      if (m === 15) alt.push([part[0] + hz + "点一刻", "… diǎn yí kè", "一刻 yí kè = a quarter"]);
      if (m === 45) alt.push([part[0] + hz + "点三刻", "… diǎn sān kè", "三刻 = three quarters"]);
      if (m === 0) alt.push([part[0] + hz + "点整", "… diǎn zhěng", "整 zhěng = o'clock exactly"]);
      alt.forEach(a => clock.append(line(a[0], a[1], a[2])));
      if (h12 === 2) clock.append(el("p", "hint", "2 o'clock is 两点 (liǎng diǎn), never 二点."));
    }
    tin.addEventListener("input", drawTime); nowBtn.onclick = setNow; setNow();
    // birthday
    const c5 = card("My birthday 生日");
    const bin = el("input"); bin.type = "date"; bin.id = "bIn"; bin.setAttribute("aria-label", "Your date of birth"); bin.value = store.get("birthday", "");
    const bres = el("div", "bday"); c5.append(el("p", "hint", "Enter your date of birth to learn how to say your birthday, your age and your Chinese zodiac animal."), bin, bres); p.append(c5);
    function drawB() {
      bres.innerHTML = ""; if (!bin.value) return;
      store.set("birthday", bin.value);
      const [y, mo, d] = bin.value.split("-").map(Number); const bd = new Date(y, mo - 1, d);
      if (isNaN(bd) || bd > now) { bres.append(el("p", "hint", "Choose a date in the past.")); return; }
      let age = now.getFullYear() - y; if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age--;
      const mz = small(mo) + "月" + small(d) + "号", mpy = numPy(small(mo)) + " yuè " + numPy(small(d)) + " hào";
      bres.append(line("我的生日是" + mz + "。", "Wǒ de shēngrì shì " + mpy + ".", "My birthday is on " + T.months[mo - 1] + " " + d + "."));
      bres.append(line("我是" + yearZh(y) + small(mo) + "月" + small(d) + "号出生的。", "Wǒ shì " + yearPy(y) + " " + mpy + " chūshēng de.", "I was born on " + bd.toDateString().slice(4) + ". (Years are read digit by digit.)"));
      const ageZh = age < 100 ? small(age) : String(age);
      bres.append(line("我今年" + ageZh + "岁。", "Wǒ jīnnián " + numPy(ageZh) + " suì.", "I am " + age + " years old this year."));
      bres.append(line("那天是" + wdZh(bd) + "。", "Nà tiān shì " + wdPy(bd) + ".", "That day was a " + T.weekdays[(bd.getDay() + 6) % 7][2] + "."));
      const z = T.zodiac[((y - 4) % 12 + 12) % 12];
      const zc = el("div", "zodiac");
      zc.append(el("div", "z-emo", z[3]));
      const zt = el("div"); zt.append(el("div", "z-zh", "我属" + z[0] + "。"), el("div", "u-py", "Wǒ shǔ " + z[1] + ". – I am a " + z[2] + "."), el("div", "u-en", "People born in the year of the " + z[2] + " are said to be " + z[4] + "."));
      zc.append(zt, sayBtn("我属" + z[0]));
      bres.append(zc);
      if (mo <= 2) bres.append(el("p", "hint", "Born in January or February? The Chinese zodiac year starts at Chinese New Year (late January to mid February), so you may be the animal before: " + T.zodiac[((y - 5) % 12 + 12) % 12][2] + " " + T.zodiac[((y - 5) % 12 + 12) % 12][0] + "."));
      bres.append(el("p", "hint", "Happy birthday in Chinese: 生日快乐！ (shēngrì kuàilè!)"));
      bres.append(line("生日快乐！", "Shēngrì kuàilè!", "Happy birthday!"));
    }
    bin.addEventListener("input", drawB); drawB();
  }

  /* ---------- 3. Word lab ---------- */
  let picked = { who: null, when: null, where: null, verb: null, what: null, neg: false, q: false };
  function words() {
    const p = $("upane"); p.append(header("Word lab", "词"));
    const c1 = card("How words are made");
    c1.append(el("p", null, "Most Chinese words are made by joining characters you already know. Once you know the pieces, you can guess the meaning – it is like Lego. Tap a word to hear it."));
    const g = el("div", "recipes");
    T.recipes.forEach(([w, py, en, parts, lit]) => {
      const b = el("button", "recipe");
      b.append(el("span", "rc-w", w), el("span", "rc-p", parts), el("span", "rc-e", "= " + en + " (" + lit + ")"));
      b.onclick = () => say(w, b); g.append(b);
    });
    c1.append(g); p.append(c1);
    // builder
    const c2 = card("Sentence builder");
    c2.append(el("p", null, "Pick words from each group. The builder puts them in the correct Chinese order for you:"));
    const order = el("div", "order"); ["Who", "When", "Where", "Action", "Thing", "吗?"].forEach((x, i) => { order.append(el("span", "ord", x)); if (i < 5) order.append(el("span", "ord-arrow", "›")); });
    c2.append(order);
    c2.append(el("p", "hint", "Remember: time and place come BEFORE the action in Chinese. “I study at school today” becomes 我今天在学校学习 (I today at school study)."));
    const out = el("div", "b-out"); c2.append(out);
    const groups = [["who", "Who"], ["when", "When (optional)"], ["where", "Where (optional)"], ["verb", "Action"], ["what", "Thing (optional)"]];
    const pane = el("div", "b-groups");
    groups.forEach(([k, label]) => {
      const gw = el("div", "bg"); gw.append(el("div", "bg-l", label));
      const row = el("div", "bg-row");
      T.builder[k].forEach(it => {
        const b = el("button", "tile-w"); b.append(el("span", "tw-z", it[0]), el("span", "tw-e", it[2]));
        b.setAttribute("aria-pressed", String(!!picked[k] && picked[k][0] === it[0]));
        b.onclick = () => { picked[k] = picked[k] && picked[k][0] === it[0] ? null : it; row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b && !!picked[k]))); build(); };
        row.append(b);
      });
      gw.append(row); pane.append(gw);
    });
    const ex = el("div", "bg"); ex.append(el("div", "bg-l", "Extras"));
    const exr = el("div", "bg-row");
    const negB = el("button", "tile-w"); negB.append(el("span", "tw-z", "不 / 没"), el("span", "tw-e", "not")); negB.setAttribute("aria-pressed", String(picked.neg));
    negB.onclick = () => { picked.neg = !picked.neg; negB.setAttribute("aria-pressed", String(picked.neg)); build(); };
    const qB = el("button", "tile-w"); qB.append(el("span", "tw-z", "吗"), el("span", "tw-e", "make a question")); qB.setAttribute("aria-pressed", String(picked.q));
    qB.onclick = () => { picked.q = !picked.q; qB.setAttribute("aria-pressed", String(picked.q)); build(); };
    const clr = el("button", "ghost", "Clear"); clr.onclick = () => { picked = { who: null, when: null, where: null, verb: null, what: null, neg: false, q: false }; go("words"); };
    exr.append(negB, qB, clr); ex.append(exr); pane.append(ex);
    c2.append(pane); p.append(c2);
    function build() {
      out.innerHTML = "";
      const P = picked;
      if (!P.who && !P.verb) { out.append(el("p", "hint", "Start by choosing Who and an Action.")); return; }
      const parts = [], gloss = [], notes = [];
      if (P.who) { parts.push(P.who); gloss.push(P.who[2]); }
      if (P.when) { parts.push(P.when); gloss.push(P.when[2]); }
      const goVerb = P.verb && P.verb[0] === "去";
      const neg = P.neg ? (P.verb && P.verb[0] === "有" ? ["没", "méi", "not"] : ["不", "bù", "not"]) : null;
      if (P.where && !goVerb) {
        if (neg) { parts.push(neg); gloss.push("not"); }
        parts.push(["在", "zài", "at"]); gloss.push("at"); parts.push(P.where); gloss.push(P.where[2]);
        notes.push("在 + place goes before the action: 在" + P.where[0] + (P.verb ? P.verb[0] : "") + ".");
      } else if (neg) { parts.push(neg); gloss.push("not"); }
      if (P.verb) { parts.push(P.verb); gloss.push(P.verb[2]); }
      if (goVerb && P.where) { parts.push(P.where); gloss.push(P.where[2]); notes.push("With 去 (go), the place comes right after it: 去" + P.where[0] + "."); }
      const noObj = P.verb && ["去", "想", "工作", "睡觉"].includes(P.verb[0]);
      if (P.what && noObj) {
        notes.push(P.verb[0] === "睡觉" || P.verb[0] === "工作" ? P.verb[0] + " does not take a thing after it, so “" + P.what[0] + "” was left out." : P.verb[0] + " needs a second action before a thing: " + (P.verb[0] === "去" ? "去商店买东西 (go to the shop to buy things)" : "想喝茶 (want to drink tea)") + ". Try 喜欢, 吃, 喝, 看 or 买 instead.");
      } else if (P.what) { parts.push(P.what); gloss.push(P.what[2]); }
      if (P.neg && P.verb && P.verb[0] === "有") notes.push("有 is made negative with 没 (méi), not 不: 没有.");
      if (P.neg && P.verb && P.verb[0] === "是") notes.push("不是 is said bú shì (不 changes tone before a 4th tone).");
      if (P.q) { parts.push(["吗", "ma", "?"]); notes.push("吗 at the end turns a statement into a yes/no question."); }
      if (!P.verb) notes.push("Add an action to finish the sentence.");
      if (P.verb && P.verb[0] === "是" && !P.what) notes.push("是 needs a thing after it: 我是学生.");
      const zh = parts.map(x => x[0]).join("") + (P.q ? "？" : "。");
      const py = parts.map(x => x[1]).join(" ").replace(/ ma$/, " ma") + (P.q ? "?" : ".");
      const big = el("div", "b-sent"); big.append(el("div", "bs-zh", zh), el("div", "u-py", py[0].toUpperCase() + py.slice(1)), el("div", "u-en", "Word by word: " + gloss.join(" · ") + (P.q ? " ?" : "")));
      const ctl = el("div", "sh-btns"); ctl.append(sayBtn(zh, "Listen to the sentence", true));
      const copy = el("button", "ghost", "Copy"); copy.onclick = () => { try { navigator.clipboard.writeText(zh).then(() => copy.textContent = "Copied", () => copy.textContent = "Select and copy"); } catch (e) { copy.textContent = "Select and copy"; } };
      ctl.append(copy); big.append(ctl);
      out.append(big);
      notes.forEach(n => out.append(el("p", "u-note", n)));
    }
    build();
  }

  window.CSGreet = function () {
    const n = store.get("myName", null), pr = store.get("profile", {}) || {}, d = new Date();
    const first = (pr.first || "").trim();
    $("hello").textContent = "你好，" + (n ? n.zh : first || "同学") + "！";
    $("helloName").textContent = n && first ? first + (pr.last ? " " + pr.last : "") : "";
    $("today").textContent = small(d.getMonth() + 1) + "月" + small(d.getDate()) + "日 " + wdZh(d);
    $("today").title = d.toDateString();
  };
  CSGreet();
  window.CSUse = { go, suggest, nameCard, buildPicker, say, sayBtn };
  go(store.get("usec", "hub"));
})();
