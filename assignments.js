/* Assignments: saved on this phone (text in localStorage, photos in IndexedDB) */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let list = store.get("assignments", []) || [];
  const COURSES = [["c1", "Chinese 1", "Synthesis"], ["c2", "Chinese 2", "Listening & Speaking"], ["c3", "Chinese 3", "Characters"]];
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
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => res(b || file), "image/jpeg", 0.82);
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
      f.append(img, del); wrap.appendChild(f);
    }
    const add = document.createElement("label"); add.className = "padd";
    add.innerHTML = '<input type="file" accept="image/*" multiple hidden><span>＋ Add photo</span>';
    add.querySelector("input").onchange = async e => {
      add.querySelector("span").textContent = "Saving…";
      try { for (const f of e.target.files) await addPhoto(a.id, await shrink(f)); }
      catch (err) { add.querySelector("span").textContent = "Couldn't save photo"; return; }
      renderPhotos(a, wrap);
    };
    wrap.appendChild(add);
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
  function card(a) {
    const card = document.createElement("article"); card.className = "acard" + (a.done ? " isdone" : "") + (a.fromClass ? " fromclass" : "");
    const head = document.createElement("button"); head.className = "ahead"; head.setAttribute("aria-expanded", String(open.has(a.id)));
    head.innerHTML = '<span class="anum"></span><span class="ameta"><span class="atitle"></span><span class="adate"></span></span><span class="astate"></span>';
    head.querySelector(".anum").textContent = a.n || "•";
    head.querySelector(".atitle").textContent = a.title;
    head.querySelector(".adate").textContent = (a.fromClass ? "From class" : "My assignment") + (course === "all" ? " · " + courseName(a.course) : "") + (a.date ? " · " + niceDate(a.date) : "");
    const tk = a.chars ? ((classState[a.id] || {}).ticks || []).length : 0;
    head.querySelector(".astate").textContent = a.done ? "Done" : a.chars && tk ? tk + "/" + a.chars.length : "To do";
    head.onclick = () => { open.has(a.id) ? open.delete(a.id) : open.add(a.id); store.set("aOpen", [...open]); render(); };
    card.appendChild(head);
    if (!open.has(a.id)) return card;
    const body = document.createElement("div"); body.className = "abody";
    if (a.task) {
      const t = document.createElement("div"); t.className = "atask";
      const l = document.createElement("p"); l.className = "label"; l.textContent = "Instructions";
      t.appendChild(l); a.task.split("\n").forEach(x => t.appendChild(lineEl(x))); body.appendChild(t);
    }
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
        b.children[0].textContent = i + 1; b.children[1].textContent = c; b.children[2].textContent = py;
        b.onclick = () => window.CSWrite && CSWrite.open(a.set, c);
        const t = document.createElement("button"); t.className = "hw-t"; t.setAttribute("aria-label", "Written " + c + " " + (a.times || 18) + " times"); t.textContent = ticks.has(c) ? "✓" : "○";
        t.onclick = () => {
          ticks.has(c) ? ticks.delete(c) : ticks.add(c);
          classState[a.id] = Object.assign({}, classState[a.id], { ticks: [...ticks] }); store.set("classState", classState);
          cell.classList.toggle("ok", ticks.has(c)); t.textContent = ticks.has(c) ? "✓" : "○"; upd();
        };
        cell.append(b, t); grid.appendChild(cell);
      });
      upd(); box.append(top, bar, tools, hint, grid); body.appendChild(box);
    } else if (a.fromClass) {
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
    const q = $("aq").value.trim().toLowerCase();
    const box = $("aList"); box.innerHTML = "";
    const match = a => !q || [a.title, a.task, a.work, "assignment " + a.n, courseName(a.course)].join(" ").toLowerCase().includes(q);
    const inCourse = a => course === "all" || a.course === course;
    const cls = CLASS.map(view).filter(inCourse).filter(match).sort((x, y) => (x.course || "").localeCompare(y.course || "") || (y.n || 0) - (x.n || 0));
    const mine = list.filter(inCourse).filter(match).sort((x, y) => y.n - x.n);
    const section = (title, items, empty) => {
      const h = document.createElement("h3"); h.className = "asec"; h.textContent = title; box.appendChild(h);
      if (!items.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = empty; box.appendChild(p); return; }
      items.forEach(a => box.appendChild(card(a)));
    };
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
})();
