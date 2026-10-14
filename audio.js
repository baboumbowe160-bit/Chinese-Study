/* One shared sound engine for the whole app.
   Uses Web Audio: clips are decoded once and kept in memory, so they start instantly,
   and sequences of clips are scheduled back-to-back on the audio clock (no gaps, no lag).
   Falls back to a plain <audio> element on very old phones.                                  */
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  const buffers = new Map();   // url -> AudioBuffer (most recently used last)
  const pending = new Map();   // url -> Promise<AudioBuffer>
  const MAX_SECONDS = 420;     // keep about 7 minutes of decoded sound in memory
  let cachedSeconds = 0;
  let job = null;              // what is playing now
  const fallback = new Audio(); fallback.preload = "auto";

  function ensure() {
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } } }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  // Phones only allow sound after a tap: wake the engine on the very first touch.
  const unlock = () => {
    const c = ensure(); if (!c) return;
    try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {}
  };
  ["pointerdown", "touchstart", "keydown"].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  // resume after the phone was locked / the app was in the background
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx && ctx.state !== "running") ctx.resume().catch(() => {}); });

  function remember(url, b) {
    buffers.delete(url); buffers.set(url, b); cachedSeconds += b.duration;
    for (const [u, old] of buffers) {           // forget the oldest when memory is full
      if (cachedSeconds <= MAX_SECONDS || u === url) break;
      buffers.delete(u); cachedSeconds -= old.duration;
    }
  }
  function load(url) {
    if (buffers.has(url)) { const b = buffers.get(url); buffers.delete(url); buffers.set(url, b); return Promise.resolve(b); }
    if (pending.has(url)) return pending.get(url);
    const c = ensure(); if (!c) return Promise.reject(new Error("no web audio"));
    const p = fetch(url)
      .then(r => { if (!r.ok) throw new Error("http " + r.status); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => { const q = c.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); }))
      .then(b => { pending.delete(url); remember(url, b); return b; }, e => { pending.delete(url); throw e; });
    pending.set(url, p);
    return p;
  }
  // Load in the background so the next tap is instant.
  function prefetch(urls) {
    (Array.isArray(urls) ? urls : [urls]).filter(Boolean).forEach(u => { if (!buffers.has(u)) load(u).catch(() => {}); });
  }

  function stop() {
    if (!job) return;
    const j = job; job = null; j.cancelled = true;
    j.sources.forEach(s => { try { s.onended = null; s.stop(); } catch (e) {} });
    if (j.btn) j.btn.classList.remove("playing");
    try { fallback.pause(); } catch (e) {}
    if (j.resolve) j.resolve(false);
  }

  /* Play several clips one after another, perfectly joined.
     opts: { btn, gap (seconds between clips), offset, until (for one long clip), onstart(t0) }
     Resolves true when finished, false if stopped, null if it could not play. */
  function playSeq(urls, opts) {
    opts = opts || {};
    stop();
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    const my = { sources: [], cancelled: false, btn: opts.btn || null };
    job = my;
    if (my.btn) my.btn.classList.add("playing");
    const c = ensure();
    const finish = ok => { if (job === my) job = null; if (my.btn) my.btn.classList.remove("playing"); return ok; };
    if (!c) return playFallback(urls, my).then(finish);
    return Promise.all(urls.map(load)).then(bufs => new Promise(res => {
      if (my.cancelled) return res(false);
      my.resolve = res;
      const gap = opts.gap == null ? 0.02 : opts.gap;
      let t = c.currentTime + 0.01;
      my.t0 = t;
      bufs.forEach((b, i) => {
        const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination);
        const off = i === 0 && opts.offset ? Math.max(0, opts.offset) : 0;
        const dur = opts.until != null && urls.length === 1 ? Math.max(0.05, opts.until - off) : b.duration - off;
        s.start(t, off, dur);
        my.sources.push(s);
        t += dur + gap;
      });
      my.end = t;
      if (opts.onstart) opts.onstart(my.t0 - (opts.offset || 0));
      const last = my.sources[my.sources.length - 1];
      last.onended = () => { if (!my.cancelled) res(true); };
    })).then(finish, () => finish(null));   // null = could not play (missing / no network)
  }
  function playFallback(urls, my) {
    return urls.reduce((p, u) => p.then(ok => ok && !my.cancelled && new Promise(res => {
      fallback.src = u; fallback.onended = () => res(true); fallback.onerror = () => res(false);
      const q = fallback.play(); if (q && q.catch) q.catch(() => res(false));
    })), Promise.resolve(true));
  }

  window.CSAudio = {
    play: (url, opts) => playSeq([url], opts),
    playSeq, stop, load, prefetch, ensure,
    now: () => (ctx ? ctx.currentTime : 0),
    get playing() { return !!job; }
  };
})();
