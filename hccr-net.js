/* Handwritten character recogniser (runs on the phone).
   Network: Melnyk-Net, a CNN trained on 2.6 million handwritten characters (CASIA-HWDB 1.0/1.1),
   97.6 % on the ICDAR-2013 benchmark. Weights: github.com/pavlo-melnyk/offline-HCCR (MIT licence).
   Knows the 3755 most common characters; the ~740 the app teaches (HSK 1–3 + app words) get a small head start. 8-bit numbers, 6.5 MB.
   Uses the phone's graphics chip (WebGL2) when it can; otherwise the processor.
   CSNet.load() → Promise; CSNet.classify([Float32Array(96*96), …]) → Promise<[Float32Array logits]>; CSNet.chars */
(function () {
  "use strict";
  const URL_ = "models/hccr2.bin";
  let M = null, loading = null, engine = null;

  function parse(buf) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "HCNN") throw new Error("bad model");
    const hl = dv.getUint32(4, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
    const base = 8 + hl;
    const i8 = ([o, n]) => new Int8Array(buf, base + o, n);
    const f32 = ([o, n]) => new Float32Array(buf.slice(base + o, base + o + n));
    const f16 = ([o, n]) => { const u = new Uint16Array(buf.slice(base + o, base + o + n)), out = new Float32Array(u.length); for (let i = 0; i < u.length; i++) out[i] = half(u[i]); return out; };
    const layers = hdr.layers.map(L => {
      const q = i8(L.w), s = f32(L.s), w = new Float32Array(q.length), co = L.cout;
      for (let i = 0; i < q.length; i++) w[i] = q[i] * s[i % co];
      return { cin: L.cin, cout: co, w, b: f32(L.b) };            // w: [9][cin][cout]
    });
    const fq = i8(hdr.fc.w), fs = f32(hdr.fc.s), V = hdr.fc.n, fw = new Float32Array(fq.length);
    for (let i = 0; i < fq.length; i++) fw[i] = fq[i] * fs[i % V];
    const fcB = f32(hdr.fc.b);
    // the characters the app teaches come first; they get a small head start (the reader knows all 3755 common characters)
    for (let k = 0; k < (hdr.core || 0); k++) fcB[k] += hdr.prior || 0;
    return { layers, gwap: f16(hdr.gwap), fcW: fw, fcB, V, chars: [...hdr.chars], plan: hdr.plan, core: hdr.core };
  }
  function half(h) {
    const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
    if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  }

  /* ---------- graphics-chip engine (WebGL2) ---------- */
  function makeGL() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const gl = cv.getContext("webgl2", { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;
    const VS = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const CONV = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D X;uniform sampler2D Wt;uniform sampler2D Bt;uniform int H,W,C4,CO4;out vec4 o;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);int x=p.x/CO4;int q=p.x-x*CO4;int b=p.y/H;int y=p.y-b*H;
vec4 s=texelFetch(Bt,ivec2(q,0),0);
for(int t=0;t<9;t++){int yy=y+t/3-1;int xx=x+t%3-1;if(yy<0||xx<0||yy>=H||xx>=W)continue;
int row=b*H+yy;int xb=xx*C4;int wr=t*C4;
for(int c=0;c<C4;c++){vec4 v=texelFetch(X,ivec2(xb+c,row),0);if(v==vec4(0.))continue;int wy=wr+c;
s.x+=dot(v,texelFetch(Wt,ivec2(q*4,wy),0));s.y+=dot(v,texelFetch(Wt,ivec2(q*4+1,wy),0));
s.z+=dot(v,texelFetch(Wt,ivec2(q*4+2,wy),0));s.w+=dot(v,texelFetch(Wt,ivec2(q*4+3,wy),0));}}
o=max(s,0.);}`;
    const POOL = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D X;uniform int H,W,C4,Ho;out vec4 o;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);int x=p.x/C4;int c=p.x-x*C4;int b=p.y/Ho;int y=p.y-b*Ho;
vec4 s=vec4(0.);float n=0.;
for(int dy=0;dy<3;dy++)for(int dx=0;dx<3;dx++){int yy=2*y+dy;int xx=2*x+dx;if(yy<H&&xx<W){s+=texelFetch(X,ivec2(xx*C4+c,b*H+yy),0);n+=1.;}}
o=s/n;}`;
    function prog(fs) {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      }
      gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; for (const n of ["X", "Wt", "Bt", "H", "W", "C4", "CO4", "Ho"]) u[n] = gl.getUniformLocation(p, n);
      return { p, u };
    }
    return { gl, cv, conv: prog(CONV), pool: prog(POOL) };
  }
  function tex(gl, w, h, data) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
    return t;
  }
  function glEngine(B) {
    const G = makeGL(); if (!G) return null;
    const { gl } = G;
    const maxT = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    B = Math.max(1, Math.min(B, Math.floor(maxT / 96)));
    // weights
    const W = M.layers.map(L => {
      const C4 = Math.ceil(L.cin / 4), CO4 = Math.ceil(L.cout / 4);
      const wd = new Float32Array(CO4 * 4 * 9 * C4 * 4);
      for (let t = 0; t < 9; t++) for (let c = 0; c < L.cin; c++) for (let co = 0; co < L.cout; co++) {
        const row = t * C4 + (c >> 2), col = co;   // texel (col,row), component c&3
        wd[(row * CO4 * 4 + col) * 4 + (c & 3)] = L.w[(t * L.cin + c) * L.cout + co];
      }
      const bd = new Float32Array(CO4 * 4); bd.set(L.b);
      return { C4, CO4, wt: tex(gl, CO4 * 4, 9 * C4, wd), bt: tex(gl, CO4, 1, bd) };
    });
    // activation buffers per step
    const steps = []; let S = 96, C4 = 1;
    for (const s of M.plan) {
      if (s === "p") { const So = Math.ceil(S / 2); steps.push({ kind: "p", H: S, W: S, C4, Ho: So, w: So * C4, h: So * B }); S = So; }
      else { const L = W[s - 1]; steps.push({ kind: "c", H: S, W: S, C4, L, w: S * L.CO4, h: S * B }); C4 = L.CO4; }
    }
    steps.forEach(st => { st.t = tex(gl, st.w, st.h); st.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, st.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.t, 0); });
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    const inTex = tex(gl, 96, 96 * B);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const va = gl.createVertexArray(); gl.bindVertexArray(va); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const lastS = S, lastC4 = C4;
    function runBatch(inputs) {
      const n = inputs.length, data = new Float32Array(96 * 96 * B * 4);
      inputs.forEach((x, b) => { for (let i = 0; i < 9216; i++) data[(b * 9216 + i) * 4] = x[i]; });
      gl.bindTexture(gl.TEXTURE_2D, inTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 96, 96 * B, gl.RGBA, gl.FLOAT, data);
      let src = inTex;
      for (const st of steps) {
        const P = st.kind === "c" ? G.conv : G.pool; gl.useProgram(P.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, st.fb); gl.viewport(0, 0, st.w, st.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(P.u.X, 0);
        gl.uniform1i(P.u.H, st.H); gl.uniform1i(P.u.W, st.W); gl.uniform1i(P.u.C4, st.C4);
        if (st.kind === "c") {
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st.L.wt); gl.uniform1i(P.u.Wt, 1);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, st.L.bt); gl.uniform1i(P.u.Bt, 2);
          gl.uniform1i(P.u.CO4, st.L.CO4);
        } else gl.uniform1i(P.u.Ho, st.Ho);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        src = st.t;
      }
      const last = steps[steps.length - 1], out = new Float32Array(last.w * lastS * n * 4);
      gl.readPixels(0, 0, last.w, lastS * n, gl.RGBA, gl.FLOAT, out);
      const feats = [];
      for (let b = 0; b < n; b++) {
        const f = new Float32Array(lastC4 * 4);
        for (let y = 0; y < lastS; y++) for (let x = 0; x < lastS; x++) for (let c = 0; c < 448; c++) {
          f[c] += out[((b * lastS + y) * last.w + x * lastC4) * 4 + c] * M.gwap[(y * lastS + x) * 448 + c];
        }
        feats.push(f);
      }
      return feats;
    }
    return { name: "gpu", B, run: runBatch };
  }

  /* ---------- processor engine (fallback) ---------- */
  function cpuConv(inp, S, C, L) {
    const CO = L.cout, out = new Float32Array(S * S * CO), acc = new Float32Array(CO), w = L.w;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      acc.set(L.b);
      for (let t = 0; t < 9; t++) {
        const yy = y + ((t / 3) | 0) - 1, xx = x + (t % 3) - 1;
        if (yy < 0 || xx < 0 || yy >= S || xx >= S) continue;
        const ib = (yy * S + xx) * C, wb = t * C * CO;
        for (let c = 0; c < C; c++) {
          const v = inp[ib + c]; if (v === 0) continue;
          const wo = wb + c * CO;
          for (let o = 0; o < CO; o++) acc[o] += v * w[wo + o];
        }
      }
      const ob = (y * S + x) * CO;
      for (let o = 0; o < CO; o++) out[ob + o] = acc[o] > 0 ? acc[o] : 0;
    }
    return out;
  }
  function cpuPool(inp, S, C) {
    const So = Math.ceil(S / 2), out = new Float32Array(So * So * C);
    for (let y = 0; y < So; y++) for (let x = 0; x < So; x++) {
      let n = 0; const ob = (y * So + x) * C;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const yy = 2 * y + dy, xx = 2 * x + dx; if (yy >= S || xx >= S) continue; n++;
        const ib = (yy * S + xx) * C; for (let c = 0; c < C; c++) out[ob + c] += inp[ib + c];
      }
      for (let c = 0; c < C; c++) out[ob + c] /= n;
    }
    return out;
  }
  const cpuEngine = {
    name: "cpu", B: 1,
    run(inputs) {
      return inputs.map(x => {
        let a = x, S = 96, C = 1;
        for (const s of M.plan) {
          if (s === "p") { a = cpuPool(a, S, C); S = Math.ceil(S / 2); }
          else { const L = M.layers[s - 1]; a = cpuConv(a, S, C, L); C = L.cout; }
        }
        const f = new Float32Array(C);
        for (let i = 0; i < S * S; i++) for (let c = 0; c < C; c++) f[c] += a[i * C + c] * M.gwap[i * C + c];
        return f;
      });
    }
  };

  function fc(f) {
    const V = M.V, out = Float32Array.from(M.fcB);
    for (let c = 0; c < 448; c++) { const v = f[c]; if (!v) continue; const o = c * V; for (let k = 0; k < V; k++) out[k] += v * M.fcW[o + k]; }
    return out;
  }

  function load(onProgress) {
    if (M) return Promise.resolve(M);
    if (loading) return loading;
    loading = (async () => {
      const res = await fetch(URL_);
      if (!res.ok) throw new Error("model " + res.status);
      let buf;
      const total = +res.headers.get("content-length") || 5.2e6;
      if (res.body && onProgress) {
        const rd = res.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(Math.min(1, got / total)); }
        const all = new Uint8Array(got); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; }); buf = all.buffer;
      } else buf = await res.arrayBuffer();
      M = parse(buf);
      try { engine = glEngine(16); } catch (e) { engine = null; }
      if (!engine) engine = cpuEngine;
      return M;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  // classify a list of 96×96 inputs (ink bright, 0–255). Returns logits per input (in CSNet.chars order).
  async function classify(inputs, onProgress) {
    await load();
    const out = [];
    for (let i = 0; i < inputs.length; i += engine.B) {
      const part = inputs.slice(i, i + engine.B);
      let feats;
      try { feats = engine.run(part); }
      catch (e) { if (engine !== cpuEngine) { engine = cpuEngine; feats = engine.run(part); } else throw e; }
      feats.forEach(f => out.push(fc(f)));
      if (onProgress) onProgress(Math.min(1, (i + part.length) / inputs.length));
      await new Promise(r => setTimeout(r, 0));
    }
    return out;
  }
  function logSoftmax(l) {
    let m = -Infinity; for (const v of l) if (v > m) m = v;
    let s = 0; for (const v of l) s += Math.exp(v - m);
    const ls = Math.log(s) + m; return Float32Array.from(l, v => v - ls);
  }
  window.CSNet = { load, classify, logSoftmax, get chars() { return M ? M.chars : []; }, get engine() { return engine ? engine.name : null }, index: c => M ? M.chars.indexOf(c) : -1, useCPU() { engine = cpuEngine; } };
})();
