/* In-app camera: take a photo directly (live view + shutter), used by Homework and Paper practice.
   CSCamera.take() resolves with a JPEG Blob, or null if cancelled.
   If the phone's browser can't open the camera here, it falls back to the phone's own camera app. */
(function () {
  "use strict";
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

  function nativeCamera() {
    return new Promise(res => {
      const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.setAttribute("capture", "environment");
      inp.style.display = "none"; document.body.appendChild(inp);
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); res(f || null); };
      window.addEventListener("focus", () => setTimeout(() => { if (inp.isConnected && !inp.files.length) { inp.remove(); res(null); } }, 1200), { once: true });
      inp.click();
    });
  }

  function take(opts) {
    opts = opts || {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return nativeCamera();
    return new Promise(resolve => {
      let stream = null, facing = "environment", navTok = null, finished = false;
      const ov = el("div", "cam"); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Camera");
      const video = el("video"); video.playsInline = true; video.muted = true; video.setAttribute("playsinline", "");
      const shot = el("img", "cam-shot"); shot.hidden = true; shot.alt = "Your photo";
      const guide = el("div", "cam-guide"); guide.textContent = opts.hint || "Hold the phone straight above the page, in good light";
      const msg = el("p", "cam-msg");
      const bar = el("div", "cam-bar");
      const close = el("button", "cam-btn", "✕"); close.setAttribute("aria-label", "Close camera");
      const snap = el("button", "cam-snap"); snap.setAttribute("aria-label", "Take photo");
      const flip = el("button", "cam-btn", "⟲"); flip.setAttribute("aria-label", "Switch camera");
      const retake = el("button", "cam-pill ghost", "↺ Retake"); retake.hidden = true;
      const use = el("button", "cam-pill primarybtn", "✓ Use photo"); use.hidden = true;
      bar.append(close, snap, flip, retake, use);
      ov.append(video, shot, guide, msg, bar);
      document.body.appendChild(ov); document.body.classList.add("noscroll");
      let blob = null;

      const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
      const finish = val => {
        if (finished) return; finished = true;
        stop(); ov.remove(); document.body.classList.remove("noscroll");
        if (shot.src) URL.revokeObjectURL(shot.src);
        if (navTok && window.CSNav && !CSNav.restoring) { const t = navTok; navTok = null; CSNav.done(t); }
        resolve(val);
      };
      if (window.CSNav) navTok = CSNav.push(() => { navTok = null; finish(null); });

      async function start() {
        stop(); msg.textContent = "Opening the camera…";
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
          video.srcObject = stream; await video.play().catch(() => {});
          msg.textContent = "";
        } catch (e) {
          stop();
          // camera blocked or not available here – use the phone's camera app instead
          msg.textContent = "";
          finished = true; ov.remove(); document.body.classList.remove("noscroll");
          if (navTok && window.CSNav) { const t = navTok; navTok = null; CSNav.done(t); }
          resolve(await nativeCamera());
        }
      }
      snap.onclick = () => {
        if (!video.videoWidth) return;
        const c = document.createElement("canvas"); c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext("2d").drawImage(video, 0, 0);
        c.toBlob(b => {
          if (!b) return;
          blob = b; shot.src = URL.createObjectURL(b); shot.hidden = false; video.hidden = true; guide.hidden = true;
          snap.hidden = true; flip.hidden = true; retake.hidden = false; use.hidden = false;
          stop();
        }, "image/jpeg", 0.9);
      };
      retake.onclick = () => {
        if (shot.src) URL.revokeObjectURL(shot.src);
        shot.hidden = true; shot.removeAttribute("src"); video.hidden = false; guide.hidden = false;
        snap.hidden = false; flip.hidden = false; retake.hidden = true; use.hidden = true; blob = null; start();
      };
      use.onclick = () => finish(blob);
      close.onclick = () => finish(null);
      flip.onclick = () => { facing = facing === "environment" ? "user" : "environment"; start(); };
      start();
    });
  }
  window.CSCamera = { take };
})();
