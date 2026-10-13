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

  // One-time move for people who used the app before the welcome screen existed:
  // the old built-in "Mine" list becomes their own Added words, so nothing they used disappears.
  (function migrate() {
    let used = false;
    try { used = ["passed", "assignments", "set", "customWords"].some(k => localStorage.getItem(k) !== null); } catch (e) {}
    if (!used || store.get("migrated9", false)) return;
    const OLD_MINE = [["马博", "Mǎ Bó", "my Chinese name"], ["冈比亚", "Gāngbǐyà", "The Gambia"], ["冈比亚大学", "Gāngbǐyà Dàxué", "University of the Gambia"], ["法拉巴", "Fǎlābā", "Faraba"], ["上课", "shàng kè", "attend class"], ["弟弟", "dìdi", "younger brother"], ["一千", "yìqiān", "one thousand"], ["掌", "zhǎng", "palm"], ["早饭", "zǎofàn", "breakfast"], ["起床", "qǐchuáng", "to get up"], ["半", "bàn", "half"]];
    const cw = store.get("customWords", []);
    OLD_MINE.forEach(w => { if (!cw.some(x => x[0] === w[0])) cw.push(w); });
    store.set("customWords", cw);
    store.set("migrated9", true);
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
      b.textContent = s[0] === "C" ? "Class" : s[0] === "M" ? "Mine" : s[0] === "A" ? "＋ Added" : "L" + s[0];
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
    if (s[0] === "C") $("settitle").append(el("span", "bookref", "From the class board, 10月5日"));
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
      leniency: 1.4, showHintAfterMisses: 2,
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
    step = 0;
    const c = cur(), n = charData(c).strokes.length;
    writer.hideCharacter();
    withOutline ? writer.showOutline() : writer.hideOutline();
 const w = writer, sayIf = (t, k) => { if (w === writer) say(t, k); };
    say(withOutline ? "Trace stroke 1 of " + n + " with your finger" : "Write " + c + " from memory – stroke 1 of " + n);
    writer.quiz({
      onCorrectStroke: d => { if (d.strokesRemaining) sayIf("Good. Stroke " + (d.strokeNum + 2) + " of " + n, "good"); },
      onMistake: d => sayIf(d.mistakesOnStroke >= 2 ? "Follow the flashing hint" : "Not quite – check the direction and order", "bad"),
      onComplete: d => {
        if (w !== writer) return;
        const m = d.totalMistakes, s = m === 1 ? "" : "s";
        if (!withOutline && m <= 3) {
          passed.add(c); store.set("passed", [...passed]);
          say(m === 0 ? "Perfect! Passed ✓" : "Passed ✓ with " + m + " mistake" + s, "good");
          renderWords();
          [...$("chars").children].forEach(b => { if (passed.has(b.textContent)) b.classList.add("done"); });
        } else if (!withOutline) {
          say(m + " mistakes. Watch again, then retry Test.", "bad");
        } else {
          say(m === 0 ? "Clean trace! Now try Test." : "Finished with " + m + " mistake" + s + ". Trace again or try Test.", m ? "" : "good");
        }
      }
    });
  }
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
    player.src = "audio/" + pick + "/" + a[0] + ".mp3";
    player.playbackRate = slow ? 0.65 : 1;
    try { player.preservesPitch = true; player.mozPreservesPitch = true; player.webkitPreservesPitch = true; } catch (e) {}
    btn.classList.add("playing");
    player.onended = player.onerror = () => btn.classList.remove("playing");
    const p = player.play();
    if (p && p.catch) p.catch(() => { btn.classList.remove("playing"); ttsSpeak(text, slow ? 0.5 : 0.85, btn); });
  }
  const curWord = () => words()[wordIdx] && words()[wordIdx][0];
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
  function setName(s) { return s[0] === "C" ? "Class" : s[0] === "M" ? "Mine" : s[0] === "A" ? "Added" : "L" + s[0]; }
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
      b.children[0].textContent = s[0] === "C" || s[0] === "M" ? "课" : s[0];
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
    if (t === "p" && writer) loadChar(cur());
  }
  let curTab = null;
  function userTab(t) {
    const prev = curTab;
    if (prev && prev !== t && window.CSNav) CSNav.push(() => showTab(prev), "tab");
    showTab(t);
  }
  $("tPractice").onclick = () => userTab("p");
  $("tAssign").onclick = () => userTab("a");
  $("tBasics").onclick = () => userTab("b");
  $("tUse").onclick = () => userTab("u");
  window.CS = { say: (text, btn) => play(text, false, btn) };

  /* ---- Add your own words ---- */
  function saveCustom() { store.set("customWords", customWords); store.set("customData", customData); }
  function msg(t, cls) { const m = $("addmsg"); m.textContent = t; m.className = "hint" + (cls ? " " + cls : ""); }
  $("addform").addEventListener("submit", async e => {
    e.preventDefault();
    const z = $("fz").value.trim(), p = $("fp").value.trim(), m = $("fm").value.trim();
    const han = [...new Set([...z].filter(isHan))];
    if (!han.length) { msg("Type at least one Chinese character.", "bad"); return; }
    const need = han.filter(c => !charData(c));
    if (need.length) {
      msg("Downloading strokes for " + need.join(" ") + "…");
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
        msg(navigator.onLine === false ? "You're offline. Connect to the internet once to add new characters." :
          "No stroke data found for " + failed.join(" ") + ". Check the characters and try again.", "bad");
        return;
      }
    }
    customWords.push([z, p || "", m || ""]);
    saveCustom();
    $("addform").reset();
    wordIdx = customWords.length - 1; charIdx = 0;
    msg("Added " + z + ".", "good");
    renderWords(); renderWord();
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
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  function renderAll() { renderSets(); renderWords(); renderWord(); }
  renderAll();
  lastW = $("box").clientWidth;
  showTab(["a", "b", "u", "p"].includes(store.get("tab", "b")) ? store.get("tab", "b") : "b");
})();
