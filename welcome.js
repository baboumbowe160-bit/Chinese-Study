/* Welcome & tutorial (first launch), profile panel, references */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const U = () => window.CSUse || {};
  const greet = () => window.CSGreet && CSGreet();

  /* ---------- overlay shell ---------- */
  const ov = $("ob");
  let obTok = null;
  function show(build) { if (ov.hidden && window.CSNav) obTok = CSNav.push(close); const box = $("obBox"); box.innerHTML = ""; build(box); ov.hidden = false; document.body.classList.add("noscroll"); box.scrollTop = 0; const f = box.querySelector("input") || box.querySelector(".primarybtn"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 60); }
  function close() { ov.hidden = true; document.body.classList.remove("noscroll"); }
  const userClose = () => { if (!(window.CSNav && CSNav.done(obTok))) close(); };
  function dots(n, i) { const d = el("div", "ob-dots"); for (let k = 0; k < n; k++) d.append(el("span", k === i ? "on" : null)); d.setAttribute("aria-label", "Step " + (i + 1) + " of " + n); return d; }
  function foot(onNext, nextLabel, onSkip, skipLabel) {
    const f = el("div", "ob-foot");
    if (onSkip) { const s = el("button", "ghost", skipLabel || "Skip"); s.onclick = onSkip; f.append(s); }
    const n = el("button", "primarybtn", nextLabel || "Next"); n.onclick = onNext; f.append(n);
    return f;
  }
  const STEPS = 5;

  /* ---------- 1. welcome ---------- */
  function step1() {
    show(b => {
      b.append(dots(STEPS, 0));
      const hero = el("div", "ob-hero");
      const seal = el("div", "seal big"); seal.append(el("span", null, "学")); hero.append(seal);
      hero.append(el("div", "ob-zh", "欢迎！"), el("h2", null, "Welcome to Chinese Study Partner"));
      b.append(hero);
      b.append(el("p", null, "学伴 xuébàn – your study partner for learning Chinese from zero, made for students using HSK Standard Course 1."));
      const ul = el("ul", "ob-list");
      [["学", "Learn", "pinyin, tones, numbers, strokes, radicals and how characters began"],
       ["写", "Write", "every word from Lessons 1–15, with stroke order, tracing and real voices"],
       ["用", "Use", "your Chinese name, dates, time, your birthday and a sentence builder"],
       ["作", "Homework", "keep your class assignments and photos of your written work"]].forEach(([z, n, d]) => {
        const li = el("li"); li.append(el("span", "stamp", z)); const t = el("span"); t.append(el("b", null, n), " – " + d); li.append(t); ul.append(li);
      });
      b.append(ul);
      b.append(el("p", "hint", "Everything is saved on this phone only. It works offline after the first visit."));
      b.append(foot(step2, "Let's start", () => finish(), "Skip tour"));
    });
  }

  /* ---------- 2. your name ---------- */
  function step2() {
    const pr = store.get("profile", { first: "", last: "" }) || {};
    show(b => {
      b.append(dots(STEPS, 1), el("h2", null, "What is your name?"));
      b.append(el("p", null, "Write your normal name. The app uses it to greet you and to suggest a Chinese name that sounds like it."));
      const f = el("div", "n-form");
      f.innerHTML = '<label for="obFirst">First name</label><input id="obFirst" autocomplete="given-name" placeholder="e.g. Awa"><label for="obLast">Surname</label><input id="obLast" autocomplete="family-name" placeholder="e.g. Ceesay">';
      b.append(f);
      $("obFirst").value = pr.first || ""; $("obLast").value = pr.last || "";
      const save = () => { store.set("profile", { first: $("obFirst").value.trim(), last: $("obLast").value.trim() }); greet(); };
      b.append(foot(() => { save(); step3(); }, "Next", () => { save(); step4(); }, "Skip"));
    });
  }

  /* ---------- 3. Chinese name ---------- */
  function step3() {
    show(b => {
      b.append(dots(STEPS, 2), el("h2", null, "Choose a Chinese name"));
      b.append(el("p", null, "In Chinese the surname comes first. Pick a name by the qualities you love – hardworking, honest in business, faithful… – or one that sounds like your own name. You can change it any time."));
      const box = el("div", "ob-picker"), res = el("div", "ob-names");
      b.append(box, res);
      const chosenMsg = el("p", "hint ob-chosen");
      const cur = store.get("myName", null); if (cur) chosenMsg.textContent = "Your Chinese name: " + cur.zh + (cur.py ? " (" + cur.py + ")" : "");
      if (U().buildPicker) U().buildPicker(box, res, n => { store.set("myName", n); greet(); chosenMsg.textContent = "Chosen: " + n.zh + " (" + n.py + ") – " + n.meaning; }, true);
      b.append(chosenMsg);
      const own = el("details", "help"); own.innerHTML = '<summary>I already have a Chinese name</summary><div class="n-form"><label for="obZh">Chinese characters</label><input id="obZh" lang="zh" maxlength="6" placeholder="e.g. 王明"><label for="obPy">Pinyin</label><input id="obPy" maxlength="40" placeholder="e.g. Wáng Míng"><button class="ghost" id="obOwn">Use this name</button><p class="hint" id="obMsg"></p></div>';
      b.append(own);
      $("obOwn").onclick = () => {
        const zh = $("obZh").value.replace(/\s+/g, ""), py = $("obPy").value.trim();
        if (!/^[\u3400-\u9fff]{1,6}$/.test(zh)) { $("obMsg").textContent = "Type your name in Chinese characters (1 to 6 characters)."; return; }
        store.set("myName", { zh, py, parts: [] }); greet(); $("obMsg").textContent = "Saved: " + zh;
      };
      b.append(foot(step4, "Next", () => { step4(); }, "Skip for now"));
    });
  }

  /* ---------- 4. tour ---------- */
  function step4() {
    show(b => {
      b.append(dots(STEPS, 3), el("h2", null, "How to use the app"));
      const tips = [
        ["学", "Learn", "Start here if you are new. Sounds teaches pinyin and the four tones; then numbers, strokes, radicals and picture characters. Finish with the games."],
        ["写", "Write", "Pick a lesson and a word. Watch the stroke order, tap Next stroke to copy it on paper, Trace with your finger, then Test yourself. Listen to real native speakers."],
        ["用", "Use", "Make or change your Chinese name, say any date, time or your birthday, and build correct sentences."],
        ["作", "Homework", "Tap ＋ New to save each assignment. Add photos of your written work. Search old assignments any time."],
      ];
      const ul = el("div", "ob-tour");
      tips.forEach(([z, n, d]) => { const r = el("div", "ob-tip"); r.append(el("span", "stamp", z)); const t = el("div"); t.append(el("b", null, n), el("p", null, d)); r.append(t); ul.append(r); });
      b.append(ul);
      b.append(el("p", "hint", "The four stamps are always at the bottom of the screen. Tap the red seal at the top to change your name or see this tour again."));
      b.append(foot(step5, "Next"));
    });
  }

  /* ---------- 5. done ---------- */
  function step5() {
    const n = store.get("myName", null), pr = store.get("profile", {}) || {};
    show(b => {
      b.append(dots(STEPS, 4));
      const hero = el("div", "ob-hero");
      hero.append(el("div", "ob-zh", "你好，" + (n ? n.zh : pr.first || "同学") + "！"));
      hero.append(el("h2", null, n ? "Nice to meet you, " + n.py + "!" : "You are ready!"));
      b.append(hero);
      if (n && U().sayBtn) { const r = el("div", "ob-say"); r.append(U().sayBtn("我叫" + n.zh, "Listen", true), el("span", null, "我叫" + n.zh + "。 – My name is " + (n.py || n.zh) + ".")); b.append(r); }
      b.append(el("p", null, "Tip: install the app on your phone so it opens like any other app. In Chrome tap ⋮ then Install app (or Add to Home screen)."));
      b.append(foot(finish, "Start learning"));
    });
  }
  function finish() {
    store.set("welcomed", true); userClose();
    setTimeout(() => { const t = document.getElementById("tBasics"); if (t) t.click(); }, 120);
  }

  /* ---------- profile panel ---------- */
  function profile() {
    const n = store.get("myName", null), pr = store.get("profile", { first: "", last: "" }) || {};
    show(b => {
      const x = el("button", "ghost ob-x", "✕"); x.setAttribute("aria-label", "Close"); x.onclick = userClose; b.append(x);
      b.append(el("h2", null, "My profile"));
      const f = el("div", "n-form");
      f.innerHTML = '<label for="pfFirst">First name</label><input id="pfFirst" autocomplete="given-name"><label for="pfLast">Surname</label><input id="pfLast" autocomplete="family-name">';
      b.append(f); $("pfFirst").value = pr.first || ""; $("pfLast").value = pr.last || "";
      const save = () => { store.set("profile", { first: $("pfFirst").value.trim(), last: $("pfLast").value.trim() }); greet(); };
      $("pfFirst").oninput = save; $("pfLast").oninput = save;
      const cn = el("div", "pf-cn");
      cn.append(el("p", "label", "Chinese name"));
      if (n) { const r = el("div", "pf-name"); r.append(el("span", "n-zh", n.zh), el("span", "n-py", n.py || "")); cn.append(r); }
      else cn.append(el("p", "hint", "You don't have a Chinese name yet."));
      const row = el("div", "frow");
      const ch = el("button", "primarybtn", n ? "Change Chinese name" : "Choose a Chinese name");
      ch.onclick = () => { save(); close(); document.getElementById("tUse").click(); if (U().go) U().go("name"); };
      row.append(ch);
      if (n) { const rm = el("button", "ghost", "Remove"); rm.onclick = () => { store.set("myName", null); greet(); profile(); }; row.append(rm); }
      cn.append(row); b.append(cn);
      const more = el("div", "frow");
      const tour = el("button", "ghost", "Show the welcome tour"); tour.onclick = step1;
      const refs = el("button", "ghost", "References & credits"); refs.onclick = references;
      more.append(tour, refs); b.append(more);
      b.append(el("p", "hint", "Your names, progress and homework are saved only on this phone."));
    });
  }

  /* ---------- references ---------- */
  function references() {
    show(b => {
      const x = el("button", "ghost ob-x", "✕"); x.setAttribute("aria-label", "Close"); x.onclick = userClose; b.append(x);
      b.append(el("h2", null, "References & credits"));
      const sec = (title, items) => {
        b.append(el("h3", null, title));
        const ul = el("ul", "refs");
        items.forEach(it => { const li = el("li"); li.innerHTML = it; ul.append(li); });
        b.append(ul);
      };
      sec("Course book", [
        "<b>HSK标准教程 1 · HSK Standard Course 1</b>. Chief editor 姜丽萍 Jiang Liping. Beijing Language and Culture University Press. The new words, key sentences and lesson order of Lessons 1–15 follow this book.",
        "Lesson pages in the book: L1 p.2 · L2 p.8 · L3 p.14 · L4 p.22 · L5 p.30 · L6 p.40 · L7 p.48 · L8 p.56 · L9 p.64 · L10 p.72 · L11 p.82 · L12 p.90 · L13 p.98 · L14 p.104 · L15 p.112 · full word list (词语总表) p.120.",
        "The pinyin tables (initials, finals, tones) follow the 拼音 sections of the lessons, mainly Lessons 1–5; the stroke and radical notes follow the 汉字 sections.",
      ]);
      sec("Class notes", [
        "<b>Class</b> word lists: characters written on the board in class, with meanings as taught by the teacher.",
      ]);
      sec("Characters, strokes and origins", [
        'Stroke-order animations: <a href="https://hanziwriter.org" target="_blank" rel="noopener">Hanzi Writer</a> by David Chanin (MIT licence).',
        'Stroke data, radicals and character origins: <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me a Hanzi</a> by Shaunak Kishore (Arphic Public License / LGPL).',
        "The 214 radicals follow the <b>Kangxi Dictionary</b> (康熙字典, 1716), as listed in the Unicode Kangxi Radicals block.",
        "Pinyin was created in China in the 1950s by a committee whose best-known member was Zhou Youguang (周有光), and adopted in 1958.",
      ]);
      sec("Numbers with meaning", (window.LUCKY ? LUCKY.sources : []).map(([t, who, url]) => '<a href="' + url + '" target="_blank" rel="noopener">' + t + "</a> – " + who + ".")
        .concat(["上山打老虎 is a traditional children's rhyme. 一去二三里 is by the Song-dynasty poet 邵雍 Shào Yōng (1011–1077)."]));
      sec("Voices", [
        'Native-speaker recordings from <a href="https://github.com/hugolpz/audio-cmn" target="_blank" rel="noopener">audio-cmn</a> (CC BY-SA): HSK words read by Yue Tan, syllables read by Chen Wang (Shtooka project). Volume-adjusted and joined for this app.',
        "Phone voice: your phone's own text-to-speech.",
        'Rhyme chants: syllables recorded by a native speaker from <a href="https://github.com/davinfifield/mp3-chinese-pinyin-sound" target="_blank" rel="noopener">mp3-chinese-pinyin-sound</a> (public domain), chanted on a steady beat for this app (voice only).',
      ]);
      sec("Handwriting checker", [
        'Reads photos of your writing with <a href="https://github.com/pavlo-melnyk/offline-HCCR" target="_blank" rel="noopener">Melnyk-Net</a> by Pavlo Melnyk (MIT licence): a neural network trained on the CASIA-HWDB handwriting collection (Institute of Automation, Chinese Academy of Sciences; 2.6 million characters by 720 writers), 97.6 % correct on the ICDAR-2013 test. It knows the 3755 most common characters (the ~740 the app teaches get a small head start) and runs on your phone.',
      ]);
      sec("Word lists", [
        "HSK levels 1–3 word lists (HSK 2012) are used to pick example characters for each radical.",
      ]);
      sec("Fonts", ["Ma Shan Zheng (brush), Young Serif and Lexend – SIL Open Font License."]);
      b.append(el("p", "hint", "Origins of characters are the traditional explanations used in teaching. Scholars sometimes disagree about the oldest meanings."));
      const back = el("button", "primarybtn", "Close"); back.onclick = userClose; b.append(back);
    });
  }

  $("profileBtn").onclick = profile;
  window.CSWelcome = { start: step1, profile, references };
  if (!store.get("welcomed", false)) step1();
})();
