/* Assignments: saved on this phone (text in localStorage, photos in IndexedDB) */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let list = store.get("assignments", []) || [];
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
      img.onclick = () => { $("viewerImg").src = url; $("viewer").hidden = false; };
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
  function render() {
    const q = $("aq").value.trim().toLowerCase();
    const box = $("aList"); box.innerHTML = "";
    const shown = list.slice().sort((x, y) => y.n - x.n)
      .filter(a => !q || [a.title, a.task, a.work, "assignment " + a.n].join(" ").toLowerCase().includes(q));
    if (!shown.length) { box.innerHTML = '<p class="empty">' + (q ? "No assignment matches your search." : "No assignments yet. Tap ＋ New to add one.") + "</p>"; return; }
    shown.forEach(a => {
      const card = document.createElement("article"); card.className = "acard" + (a.done ? " isdone" : "");
      const head = document.createElement("button"); head.className = "ahead"; head.setAttribute("aria-expanded", String(open.has(a.id)));
      head.innerHTML = '<span class="anum"></span><span class="ameta"><span class="atitle"></span><span class="adate"></span></span><span class="astate"></span>';
      head.querySelector(".anum").textContent = a.n;
      head.querySelector(".atitle").textContent = a.title;
      head.querySelector(".adate").textContent = "Assignment " + a.n + (a.date ? " · " + niceDate(a.date) : "");
      head.querySelector(".astate").textContent = a.done ? "Done" : "To do";
      head.onclick = () => { open.has(a.id) ? open.delete(a.id) : open.add(a.id); store.set("aOpen", [...open]); render(); };
      card.appendChild(head);
      if (open.has(a.id)) {
        const body = document.createElement("div"); body.className = "abody";
        if (a.task) {
          const t = document.createElement("div"); t.className = "atask";
          const l = document.createElement("p"); l.className = "label"; l.textContent = "Task";
          t.appendChild(l); a.task.split("\n").forEach(s => t.appendChild(lineEl(s))); body.appendChild(t);
        }
        if (a.work) {
          const w = document.createElement("div"); w.className = "awork";
          const l = document.createElement("p"); l.className = "label"; l.textContent = "My work";
          w.appendChild(l); a.work.split("\n").forEach(s => w.appendChild(lineEl(s))); body.appendChild(w);
        }
        const pl = document.createElement("p"); pl.className = "label"; pl.textContent = "Photos of my written work";
        const pw = document.createElement("div"); pw.className = "photos";
        body.append(pl, pw); renderPhotos(a, pw);
        const act = document.createElement("div"); act.className = "frow";
        const done = document.createElement("button"); done.className = "ghost"; done.textContent = a.done ? "Mark as to do" : "Mark as done";
        done.onclick = () => { a.done = !a.done; save(); render(); };
        const ed = document.createElement("button"); ed.className = "ghost"; ed.textContent = "Edit";
        ed.onclick = () => openForm(a);
        act.append(done, ed); body.appendChild(act);
        card.appendChild(body);
      }
      box.appendChild(card);
    });
  }

  /* ---- Add / edit form ---- */
  function openForm(a) {
    editing = a || null;
    $("aFormTitle").textContent = a ? "Edit assignment " + a.n : "New assignment " + (Math.max(0, ...list.map(x => x.n)) + 1);
    $("aTitle").value = a ? a.title : "";
    $("aDate").value = a ? (a.date || "") : new Date().toISOString().slice(0, 10);
    $("aTask").value = a ? (a.task || "") : "";
    $("aWork").value = a ? (a.work || "") : "";
    $("aDelete").hidden = !a; $("aDelete").textContent = "Delete"; $("aDelete").dataset.c = "";
    $("aForm").hidden = false; $("aNew").hidden = true;
    $("aForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("aTitle").focus();
  }
  function closeForm() { $("aForm").hidden = true; $("aNew").hidden = false; editing = null; }
  $("aNew").onclick = () => openForm(null);
  $("aCancel").onclick = closeForm;
  $("aForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = { title: $("aTitle").value.trim(), date: $("aDate").value, task: $("aTask").value.trim(), work: $("aWork").value.replace(/\s+$/, "") };
    if (!v.title) return;
    if (editing) Object.assign(editing, v);
    else {
      const a = Object.assign({ id: "a" + Date.now(), n: Math.max(0, ...list.map(x => x.n)) + 1, done: false }, v);
      list.push(a); open.add(a.id); store.set("aOpen", [...open]);
    }
    save(); closeForm(); render();
  });
  $("aDelete").onclick = async () => {
    const b = $("aDelete");
    if (!editing) return;
    if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Tap again to delete"; return; }
    const id = editing.id;
    list = list.filter(x => x.id !== id); save();
    try { await delAllPhotos(id); } catch (e) {}
    closeForm(); render();
  };
  $("aq").addEventListener("input", render);
  $("viewerClose").onclick = () => { $("viewer").hidden = true; };
  $("viewer").addEventListener("click", e => { if (e.target === $("viewer")) $("viewer").hidden = true; });

  render();
})();
