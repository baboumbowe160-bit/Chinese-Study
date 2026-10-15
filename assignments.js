/* Assignments: saved on this phone (text in localStorage, photos in IndexedDB) */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let list = store.get("assignments", []) || [];
  const COURSES = [["c1", "Chinese 1", "Synthesis"], ["c2", "Chinese 2", "Reading & Writing"], ["c3", "Chinese 3", "Characters"]];
  const CLASS = (window.CLASS_ASSIGNMENTS || []).map(a => Object.assign({ fromClass: true }, a));
  let classState = store.get("classState", {});   // per class assignment: { done, work }
  let course = store.get("aCourse", "all");
  const courseName = c => { const x = COURSES.find(k => k[0] === c); return x ? x[1] + " · " + x[2] : "Not sorted"; };
  let open = new Set(store.get("aOpen", []));
  let editing = null;
  const save = () => store.set("assignments", list);

  /* ---- Photo storage ---- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open("chinese-study", 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true }); s.createIndex("aid", "aid"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function photos(aid) {
    try {
      const d = await db();
      return await new Promise((res, rej) => { const q = d.transaction("photos").objectStore("photos").index("aid").getAll(aid); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    } catch (e) { return []; }
  }
  async function addPhoto(aid, blob) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").add({ aid, blob, t: Date.now() }); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  async function delPhoto(id) {
    const d = await db();
    return new Promise(res => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").delete(id); t.oncomplete = res; });
  }
  async function delAllPhotos(aid) { for (const p of await photos(aid)) await delPhoto(p.id); }
  function shrink(file) {
    return new Promise(res => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 2400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => res(b || file), "image/jpeg", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  /* ---- Rendering ---- */
  const ZH = /[㐀-鿿][㐀-鿿，。！？、：；…（）·\s]*/g;
  function niceDate(d) {
    if (!d) return "";
    try { return new Date(d + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; }
  }
  function lineEl(line) {
    const row = document.createElement("div");
    const t = line.trim();
    if (!t) { row.className = "gap"; return row; }
    const zh = (t.match(ZH) || []).map(s => s.trim()).filter(Boolean);
    const isHead = !zh.length && t.length < 40 && !/[.→]/.test(t);
    row.className = isHead ? "lhead" : "line";
    const txt = document.createElement("div"); txt.className = "ltxt";
    let last = 0;
    t.replace(/\(([^)]*)\)|[㐀-鿿][㐀-鿿，。！？、：；…·]*/g, (m, py, i) => {
      txt.appendChild(document.createTextNode(t.slice(last, i)));
      const s = document.createElement("span");
      s.className = py !== undefined && !/[㐀-鿿]/.test(m) ? "lpy" : "lzh";
      s.textContent = m; txt.appendChild(s); last = i + m.length; return m;
    });
    txt.appendChild(document.createTextNode(t.slice(last)));
    row.appendChild(txt);
    if (zh.length) {
      const say = zh[zh.length - 1].replace(/\s+/g, "");
      const b = document.createElement("button");
      b.className = "say mini"; b.setAttribute("aria-label", "Listen to " + say);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
      b.onclick = () => window.CS && window.CS.say(say, b);
      row.appendChild(b);
    }
    return row;
  }
  async function renderPhotos(a, wrap) {
    wrap.innerHTML = "";
    for (const p of await photos(a.id)) {
      const f = document.createElement("figure");
      const img = document.createElement("img");
      const url = URL.createObjectURL(p.blob); img.src = url; img.alt = "Photo of " + a.title;
      img.onclick = () => { $("viewerImg").src = url; if (window.CSNav) viewTok = CSNav.push(hideViewer); $("viewer").hidden = false; };
      const del = document.createElement("button"); del.className = "pdel"; del.textContent = "×"; del.setAttribute("aria-label", "Remove photo");
      del.onclick = async () => {
        if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Remove?"; setTimeout(() => { del.dataset.c = ""; del.textContent = "×"; }, 3000); return; }
        await delPhoto(p.id); renderPhotos(a, wrap);
      };
      // check the handwriting in this photo (whole page: every copy, one by one)
      const sum = ((classState[a.id] || {}).checks || {})[p.id];
      const chk = document.createElement("button"); chk.className = "pp-tag"; chk.textContent = sum ? "✓ " + sum.good + "/" + sum.total + " good" : "Check ✓";
      chk.onclick = () => window.CSChecker && window.CSPool && CSChecker.open({
        blob: p.blob, pool: CSPool, targets: a.chars ? [...new Set(a.chars.flatMap(c => [...c[0]].filter(k => /[㐀-鿿]/.test(k))))] : [], times: a.times || 0, title: "Check: " + a.title,
        onDone: s2 => {
          classState = store.get("classState", {});
          const st = classState[a.id] = Object.assign({}, classState[a.id]);
          st.checks = Object.assign({}, st.checks, { [p.id]: { good: s2.good, total: s2.total, avg: s2.avg } });
          // a character written enough times, almost all good, gets ticked automatically
          if (a.chars) {
            const t = new Set(st.ticks || []);
            const okc = new Set(Object.entries(s2.perChar).filter(([, v]) => v.n >= (a.times || 1) && v.good >= Math.ceil(v.n * 0.8)).map(([c]) => c));
            a.chars.forEach(x => { const cs2 = [...x[0]].filter(k => /[㐀-鿿]/.test(k)); if (cs2.length && cs2.every(k => okc.has(k))) t.add(x[0]); });
            st.ticks = [...t];
          }
          store.set("classState", classState); render();
        }
      });
      f.append(img, del, chk); wrap.appendChild(f);
    }
    const save = async (files, btn) => {
      const sp = btn.querySelector("span"); sp.textContent = "Saving…";
      try { for (const f of files) await addPhoto(a.id, await shrink(f)); }
      catch (err) { sp.textContent = "Couldn't save photo"; return; }
      renderPhotos(a, wrap);
    };
    const cam = document.createElement("button"); cam.className = "padd"; cam.innerHTML = "<span>📷 Take photo</span>";
    cam.onclick = async () => { const b = window.CSCamera ? await CSCamera.take() : null; if (b) save([b], cam); };
    const add = document.createElement("label"); add.className = "padd";
    add.innerHTML = '<input type="file" accept="image/*" multiple hidden><span>🖼 From gallery</span>';
    add.querySelector("input").onchange = e => save([...e.target.files], add);
    wrap.append(cam, add);
  }
  function chips() {
    const box = $("aCourses"); box.innerHTML = "";
    [["all", "All", ""]].concat(COURSES).forEach(([id, n, sub]) => {
      const b = document.createElement("button"); b.className = "acourse"; b.setAttribute("aria-pressed", String(course === id));
      const t = document.createElement("b"); t.textContent = n; b.appendChild(t);
      if (sub) { const s2 = document.createElement("span"); s2.textContent = sub; b.appendChild(s2); }
      b.onclick = () => { course = id; store.set("aCourse", id); chips(); render(); };
      box.appendChild(b);
    });
  }
  function view(a) {   // merge class assignments with this phone's progress
    if (!a.fromClass) return a;
    const st = classState[a.id] || {};
    return Object.assign({}, a, { done: !!st.done, work: st.work || "" });
  }
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const SAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
  function sayB(text) { const b = mk("button", "say mini"); b.innerHTML = SAY_SVG; b.setAttribute("aria-label", "Listen"); b.onclick = e => { e.stopPropagation(); window.CSSay && CSSay(text.replace(/____/g, "，").replace(/\n/g, "，").replace(/[A-Za-z]+：/g, ""), b); }; return b; }
  const hasZh = s => /[\u4e00-\u9fff]/.test(s);
  // a question paper: the student types an answer and the app says right or wrong (it never shows the answer)
  function questions(a, card) {
    const st = classState[a.id] || {};
    const got = new Set(st.got || []), typed = Object.assign({}, st.typed || {});
    const total = a.qs.reduce((s, g) => s + g.items.length, 0);
    const box = mk("div", "aq-box");
    const top = mk("div", "aq-top"); const cnt = mk("b"); top.append(cnt); box.append(top);
    const upd = () => { cnt.textContent = got.size + " / " + total + " correct"; const s2 = card.querySelector(".astate"); if (s2 && !a.done) s2.textContent = got.size ? got.size + "/" + total : "To do"; };
    const save = () => { classState = store.get("classState", {}); classState[a.id] = Object.assign({}, classState[a.id], { got: [...got], typed }); store.set("classState", classState); };
    const kb = mk("p", "hint aq-kb"); kb.textContent = "Type in Chinese characters with a Chinese keyboard (on Android: Gboard → Settings → Languages → Add keyboard → Chinese (Pinyin) or Chinese handwriting). The app checks your answer – it never shows the answers.";
    box.append(kb);
    a.qs.forEach((g, gi) => {
      box.append(mk("h4", "aq-h", g.h)); if (g.sub) box.append(mk("p", "hint", g.sub));
      g.items.forEach(([n, q, py, c], i) => {
        const key = a.id + ":" + gi + ":" + i, sk = gi + ":" + i;
        const r = mk("div", "aq" + (got.has(sk) ? " got" : ""));
        const qh = mk("div", "aq-q");
        qh.append(mk("span", "aq-n", n === "" ? "•" : String(n)));
        const qt = mk("div", "aq-qt");
        q.split("\n").forEach(line => qt.append(mk("div", hasZh(line) ? "aq-zh" : "aq-en", line)));
        if (py) qt.append(mk("div", "aq-py", py));
        qh.append(qt); if (hasZh(q)) qh.append(sayB(q));
        const row = mk("div", "aq-in");
        const inp = mk("input", "aq-inp"); inp.type = "text"; inp.lang = c.e ? "en" : "zh-CN"; inp.autocomplete = "off"; inp.spellcheck = false;
        inp.placeholder = c.e ? "Type the English" : "Type your answer in Chinese"; inp.value = typed[sk] || "";
        const btn = mk("button", "primarybtn aq-check", "Check");
        const fb = mk("p", "aq-fb");
        const show = res => {
          fb.className = "aq-fb " + res;
          fb.textContent = res === "right" ? "✓ Correct!" : res === "open" ? "🤔 This question has many possible answers and the app doesn't know yours. It may still be right – show it to your teacher." :
            res === "pinyin" ? "Please write it in Chinese characters, not pinyin." : res === "empty" ? "Type your answer first." : "✗ Not correct yet – look again and try once more.";
        };
        const run = () => {
          const res = CSCheck.check(key, c, inp.value);
          typed[sk] = inp.value;
          if (res === "right") got.add(sk); else got.delete(sk);
          r.classList.toggle("got", res === "right"); save(); upd(); show(res);
        };
        btn.onclick = run; inp.onkeydown = e => { if (e.key === "Enter") run(); };
        inp.oninput = () => { fb.textContent = ""; fb.className = "aq-fb"; };
        if (got.has(sk)) show("right");
        row.append(inp, btn); r.append(qh, row, fb); box.append(r);
      });
    });
    upd(); return box;
  }
  // listening with pictures (the recording is in the workbook audio)
  function pictures(a) {
    const box = mk("div", "aq-box");
    const au = mk("p", "wb-audio"); au.append("🎧 Play track " + a.wbTrack + " of the workbook audio. ");
    const l = mk("a", null, "Open the HSK 1 Workbook audio ↗"); l.href = "https://soundcloud.com/user-682871665/sets/hsk-1-workbook-audio-2"; l.target = "_blank"; l.rel = "noopener"; au.append(l); box.append(au);
    const pg = mk("div", "aq-pics");
    a.pics.forEach(([L, emo, cap]) => { const c = mk("div", "aq-pic"); c.append(mk("b", "wb-letter", L), mk("span", "wb-emo", emo), mk("span", "wb-cap", cap)); pg.append(c); });
    box.append(mk("h4", "aq-h", "The pictures"), pg);
    if (a.example) {
      const ex = mk("div", "aq ex open"); const q = mk("div", "aq-q"); const qt = mk("div", "aq-qt");
      qt.append(mk("div", "aq-en", "Example"));
      a.example[0].split("\n").forEach(x => qt.append(mk("div", "aq-zh", x)));
      qt.append(mk("div", "aq-py", a.example[1]), mk("div", "aq-note", a.example[3] + " → picture " + a.example[2]));
      q.append(qt, sayB(a.example[0])); ex.append(q); box.append(ex);
    }
    const mine = (classState[a.id] || {}).pick || {};
    box.append(mk("h4", "aq-h", "Your answers"), mk("p", "hint", "Listen, then tap the letter of the picture for each dialogue. Check your answers in class."));
    a.blanks.forEach(n => {
      const r = mk("div", "wb-q row"); r.append(mk("span", "wb-num", n + "."));
      const g = mk("div", "wb-ch letters");
      a.pics.forEach(([L]) => {
        const b = mk("button", "wb-op" + (mine[n] === L ? " sel" : ""), L);
        b.onclick = () => { classState = store.get("classState", {}); const s = Object.assign({}, classState[a.id]); s.pick = Object.assign({}, s.pick, { [n]: L }); classState[a.id] = s; store.set("classState", classState); [...g.children].forEach(x => x.classList.toggle("sel", x === b)); };
        g.append(b);
      });
      r.append(g); box.append(r);
    });
    return box;
  }
  function card(a) {
    const card = document.createElement("article"); card.id = "acard-" + a.id; card.className = "acard" + (a.done ? " isdone" : "") + (a.fromClass ? " fromclass" : "");
    const head = document.createElement("button"); head.className = "ahead"; head.setAttribute("aria-expanded", String(open.has(a.id)));
    head.innerHTML = '<span class="anum"></span><span class="ameta"><span class="atitle"></span><span class="adate"></span></span><span class="astate"></span>';
    head.querySelector(".anum").textContent = a.tag || (a.newcomer ? "新" : (a.n || "•"));
    head.querySelector(".atitle").textContent = a.title;
    head.querySelector(".adate").textContent = (a.fromClass ? "From class" : "My assignment") + (course === "all" ? " · " + courseName(a.course) : "") + (a.date ? " · " + niceDate(a.date) : "");
    const tk = a.chars ? ((classState[a.id] || {}).ticks || []).length : 0;
    const qn = a.qs ? a.qs.reduce((s, g) => s + g.items.length, 0) : 0, qk = a.qs ? ((classState[a.id] || {}).got || []).length : 0;
    head.querySelector(".astate").textContent = a.done ? "Done" : a.chars && tk ? tk + "/" + a.chars.length : qn && qk ? qk + "/" + qn : "To do";
    head.onclick = () => { open.has(a.id) ? open.delete(a.id) : open.add(a.id); store.set("aOpen", [...open]); render(); };
    card.appendChild(head);
    if (!open.has(a.id)) return card;
    const body = document.createElement("div"); body.className = "abody";
    if (a.task) {
      const t = document.createElement("div"); t.className = "atask";
      const l = document.createElement("p"); l.className = "label"; l.textContent = "Instructions";
      t.appendChild(l); a.task.split("\n").forEach(x => t.appendChild(lineEl(x))); body.appendChild(t);
    }
    if (a.dateNote) { const dn = document.createElement("p"); dn.className = "hint adnote"; dn.textContent = "📅 " + a.dateNote; body.appendChild(dn); }
    const practise = c => window.CSWrite && CSWrite.open(a.set, c);
    const marksTitle = a.marksTitle || "✍ Notes", marksSub = a.marksSub || "Common mistakes to avoid – tap a character to practise it.";
    const noteBox = (cls, title, sub, items) => {
      const box = document.createElement("div"); box.className = "anotes " + cls;
      const h = document.createElement("p"); h.className = "label"; h.textContent = title; box.appendChild(h);
      if (sub) { const p = document.createElement("p"); p.className = "hint"; p.textContent = sub; box.appendChild(p); }
      items.forEach(([c, note]) => {
        const r = document.createElement("div"); r.className = "anote";
        const b = document.createElement("button"); b.className = "anote-c"; b.textContent = c; b.setAttribute("aria-label", "Practise " + c); b.onclick = () => practise(c);
        const t = document.createElement("p"); t.textContent = note;
        r.append(b, t); box.appendChild(r);
      });
      body.appendChild(box);
    };
    if (a.marks && a.marks.length) noteBox("marks", marksTitle, marksSub, a.marks);
    if (a.tips && a.tips.length) noteBox("tips", "💡 Watch out", "", a.tips);
    if (a.words && a.words.length) {
      const wb = document.createElement("div"); wb.className = "awords";
      const l = document.createElement("p"); l.className = "label"; l.textContent = "Words to learn"; wb.appendChild(l);
      a.words.forEach(([w, py, m]) => {
        const r = document.createElement("div"); r.className = "line";
        const t = document.createElement("button"); t.className = "ltxt aword"; t.onclick = () => practise(w);
        t.innerHTML = '<span class="lzh"></span> <span class="lpy"></span> <span class="aw-m"></span>';
        t.children[0].textContent = w; t.children[1].textContent = py; t.children[2].textContent = m;
        const sb = document.createElement("button"); sb.className = "say mini"; sb.setAttribute("aria-label", "Listen to " + w);
        sb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
        sb.onclick = () => window.CSSay && CSSay(w, sb);
        r.append(t, sb); wb.appendChild(r);
      });
      body.appendChild(wb);
    }
    if (a.qs) body.appendChild(questions(a, card));
    if (a.pics) body.appendChild(pictures(a));
    if (a.chars) {
      // characters to write: tap to practise, tick when written N times
      const ticks = new Set((classState[a.id] || {}).ticks || []);
      const box = document.createElement("div"); box.className = "hw";
      const top = document.createElement("div"); top.className = "hw-top";
      const cnt = document.createElement("b");
      const bar = document.createElement("div"); bar.className = "hw-bar"; const fill = document.createElement("span"); bar.appendChild(fill);
      const upd = () => {
        cnt.textContent = ticks.size + " / " + a.chars.length + " written " + (a.times || 18) + "×"; fill.style.width = (ticks.size / a.chars.length * 100) + "%";
        const st = card.querySelector(".astate"); if (st && !a.done) st.textContent = ticks.size ? ticks.size + "/" + a.chars.length : "To do";
      };
      top.append(cnt);
      const tools = document.createElement("div"); tools.className = "frow";
      if (a.set) { const go = document.createElement("button"); go.className = "primarybtn"; go.textContent = "✍ Practise in Write"; go.onclick = () => window.CSWrite && CSWrite.open(a.set); tools.append(go); }
      if (a.sheet) { const sh = document.createElement("a"); sh.className = "ghost hw-sheet"; sh.href = a.sheet; sh.target = "_blank"; sh.rel = "noopener"; sh.textContent = "🖨 Practice sheet (PDF)"; tools.append(sh); }
      const hint = document.createElement("p"); hint.className = "hint"; hint.textContent = "Tap a character to watch its stroke order and practise it. Tap ○ when you have written it " + (a.times || 18) + " times in your book.";
      const grid = document.createElement("div"); grid.className = "hw-grid";
      a.chars.forEach(([c, py, m], i) => {
        const cell = document.createElement("div"); cell.className = "hw-c" + (ticks.has(c) ? " ok" : "");
        const b = document.createElement("button"); b.className = "hw-ch"; b.title = py + " – " + m;
        b.innerHTML = '<span class="hw-n"></span><span class="hw-z"></span><span class="hw-p"></span>';
        b.children[0].textContent = a.chars[i][3] || i + 1; b.children[1].textContent = c; b.children[2].textContent = py;
        if ([...c].length > 1) { const L = [...c].length; cell.classList.add("hw-word"); if (L > 7) cell.classList.add("hw-long"); cell.style.gridColumn = L > 7 ? "1 / -1" : "span " + Math.min(4, Math.max(2, Math.ceil(L * 0.75))); }
        b.onclick = () => window.CSWrite && CSWrite.open(a.set, c);
        const t = document.createElement("button"); t.className = "hw-t"; t.setAttribute("aria-label", "Written " + c + " " + (a.times || 18) + " times"); t.textContent = ticks.has(c) ? "✓" : "○";
        t.onclick = () => {
          classState = store.get("classState", {});
          ticks.has(c) ? ticks.delete(c) : ticks.add(c);
          classState[a.id] = Object.assign({}, classState[a.id], { ticks: [...ticks] }); store.set("classState", classState);
          cell.classList.toggle("ok", ticks.has(c)); t.textContent = ticks.has(c) ? "✓" : "○"; upd();
        };
        cell.append(b, t); grid.appendChild(cell);
      });
      upd(); box.append(top, bar, tools, hint, grid); body.appendChild(box);
    } else if (a.fromClass && !a.qs && !a.pics) {
      const l = document.createElement("label"); l.className = "label"; l.textContent = "My answers"; l.htmlFor = "w-" + a.id;
      const ta = document.createElement("textarea"); ta.id = "w-" + a.id; ta.className = "awork-in"; ta.rows = 6; ta.value = a.work || "";
      ta.placeholder = "Write your answers here, one per line. Lines with Chinese get a speaker button.";
      const prev = document.createElement("div"); prev.className = "awork";
      const draw = () => { prev.innerHTML = ""; (ta.value || "").split("\n").forEach(x => x.trim() && prev.appendChild(lineEl(x))); };
      ta.oninput = () => { classState[a.id] = Object.assign({}, classState[a.id], { work: ta.value }); store.set("classState", classState); draw(); };
      draw(); body.append(l, ta, prev);
    } else if (a.work) {
      const w = document.createElement("div"); w.className = "awork";
      const l = document.createElement("p"); l.className = "label"; l.textContent = "My work";
      w.appendChild(l); a.work.split("\n").forEach(x => w.appendChild(lineEl(x))); body.appendChild(w);
    }
    const pl = document.createElement("p"); pl.className = "label"; pl.textContent = "Photos of my written work";
    const pw = document.createElement("div"); pw.className = "photos";
    body.append(pl, pw); renderPhotos(a, pw);
    const act = document.createElement("div"); act.className = "frow";
    const done = document.createElement("button"); done.className = "ghost"; done.textContent = a.done ? "Mark as to do" : "Mark as done";
    done.onclick = () => {
      if (a.fromClass) { classState[a.id] = Object.assign({}, classState[a.id], { done: !a.done }); store.set("classState", classState); }
      else { const real = list.find(x => x.id === a.id); real.done = !real.done; save(); }
      render();
    };
    act.append(done);
    if (!a.fromClass) { const ed = document.createElement("button"); ed.className = "ghost"; ed.textContent = "Edit"; ed.onclick = () => openForm(list.find(x => x.id === a.id)); act.append(ed); }
    body.appendChild(act);
    card.appendChild(body);
    return card;
  }
  function render() {
    classState = store.get("classState", {});   // the Write tab may have ticked characters
    const q = $("aq").value.trim().toLowerCase();
    const box = $("aList"); box.innerHTML = "";
    const match = a => !q || [a.title, a.task, a.work, "assignment " + a.n, courseName(a.course)].join(" ").toLowerCase().includes(q);
    const inCourse = a => course === "all" || a.course === course;
    const cls = CLASS.map(view).filter(inCourse).filter(match).sort((x, y) => (x.course || "").localeCompare(y.course || "") || (x.n || 0) - (y.n || 0));
    const mine = list.filter(inCourse).filter(match).sort((x, y) => y.n - x.n);
    const section = (title, items, empty) => {
      const h = document.createElement("h3"); h.className = "asec"; h.textContent = title; box.appendChild(h);
      if (!items.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = empty; box.appendChild(p); return; }
      items.forEach(a => box.appendChild(card(a)));
    };
    // guide for students who joined the course late
    const c3 = CLASS.filter(a => a.course === "c3" && !a.qs).sort((x, y) => (x.n || 0) - (y.n || 0));
    if (!q && (course === "all" || course === "c3") && c3.length) {
      const g = document.createElement("div"); g.className = "aguide";
      const nc = c3.find(a => a.newcomer), last = c3.filter(a => !a.newcomer).pop() || c3[c3.length - 1], latest = last;
      g.innerHTML = '<b>New to the course?</b><p class="hint">Chinese 3 (Characters) gives a writing assignment almost every week. ' + (nc ? 'Joined late? Start with <b>New</b>: every new word from Lessons 1–7, 18 times each. Then do the class assignments in order, 1 → ' + last.n + '.' : 'Do them in order, 1 → ' + last.n + '.') + ' Each one has its characters with stroke order, the words to learn and notes on common mistakes.</p>';
      const row = document.createElement("div"); row.className = "aguide-row";
      c3.forEach(a => {
        const b = document.createElement("button"); b.className = "aguide-b" + (a === latest ? " latest" : "");
        const st = classState[a.id] || {}, tk = (st.ticks || []).length;
        b.innerHTML = '<b></b><span></span>'; b.children[0].textContent = a.newcomer ? "New" : a.n; b.children[1].textContent = (a.newcomer ? "L1–7" : a.date ? niceDate(a.date).replace(/,? \d{4}$/, "") : "–") + (st.done ? " ✓" : tk ? " · " + tk + "/" + a.chars.length : "");
        b.title = a.title; b.onclick = () => { open.add(a.id); store.set("aOpen", [...open]); render(); const el2 = document.getElementById("acard-" + a.id); if (el2) el2.scrollIntoView({ behavior: "smooth", block: "start" }); };
        row.appendChild(b);
      });
      g.appendChild(row); box.appendChild(g);
    }
    section("From class", cls, q ? "No class assignment matches your search." : "Class assignments for " + (course === "all" ? "your courses" : courseName(course)) + " will appear here.");
    section("My own assignments", mine, q ? "None of your assignments match." : "Tap ＋ New to add your own.");
  }

  let viewTok = null, formTok = null;
  function hideViewer() { $("viewer").hidden = true; }
  function userHideViewer() { if (!(window.CSNav && CSNav.done(viewTok))) hideViewer(); }
  /* ---- Add / edit form ---- */
  function openForm(a) {
    editing = a || null;
    $("aFormTitle").textContent = a ? "Edit assignment " + a.n : "New assignment " + (Math.max(0, ...list.map(x => x.n)) + 1);
    $("aTitle").value = a ? a.title : "";
    $("aDate").value = a ? (a.date || "") : new Date().toISOString().slice(0, 10);
    $("aTask").value = a ? (a.task || "") : "";
    $("aWork").value = a ? (a.work || "") : "";
    $("aCourseSel").value = a ? (a.course || "") : (course === "all" ? "" : course);
    $("aDelete").hidden = !a; $("aDelete").textContent = "Delete"; $("aDelete").dataset.c = "";
    if ($("aForm").hidden && window.CSNav) formTok = CSNav.push(closeForm);
    $("aForm").hidden = false; $("aNew").hidden = true;
    $("aForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("aTitle").focus();
  }
  function closeForm() { $("aForm").hidden = true; $("aNew").hidden = false; editing = null; }
  $("aNew").onclick = () => openForm(null);
  const userCloseForm = () => { if (!(window.CSNav && CSNav.done(formTok))) closeForm(); };
  $("aCancel").onclick = userCloseForm;
  $("aForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = { title: $("aTitle").value.trim(), date: $("aDate").value, task: $("aTask").value.trim(), work: $("aWork").value.replace(/\s+$/, ""), course: $("aCourseSel").value };
    if (!v.title) return;
    if (editing) Object.assign(editing, v);
    else {
      const a = Object.assign({ id: "a" + Date.now(), n: Math.max(0, ...list.map(x => x.n)) + 1, done: false }, v);
      list.push(a); open.add(a.id); store.set("aOpen", [...open]);
    }
    save(); userCloseForm(); render();
  });
  $("aDelete").onclick = async () => {
    const b = $("aDelete");
    if (!editing) return;
    if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Tap again to delete"; return; }
    const id = editing.id;
    list = list.filter(x => x.id !== id); save();
    try { await delAllPhotos(id); } catch (e) {}
    userCloseForm(); render();
  };
  $("aq").addEventListener("input", render);
  chips();
  $("viewerClose").onclick = userHideViewer;
  $("viewer").addEventListener("click", e => { if (e.target === $("viewer")) userHideViewer(); });

  render();
  window.CSAssign = { render: () => render() };
})();
