/* In-app back navigation.
   Every screen change registers how to undo it. The phone's Back button then steps back
   inside the app (close a panel → leave a section → return to the previous tab) and only
   closes the app from the start screen. */
(function () {
  "use strict";
  const stack = [];          // [{ id, kind, fn }]
  let restoring = false, seq = 0;

  function push(fn, kind) {
    if (restoring) return null;
    const top = stack[stack.length - 1];
    if (kind === "tab" && top && top.kind === "tab") { top.fn = fn; return top.id; } // keep one entry for tab hops
    const id = ++seq;
    stack.push({ id, kind: kind || "view", fn });
    try { history.pushState({ csnav: id }, ""); } catch (e) {}
    return id;
  }
  // Close something that registered with push(): go back through history so the entry is used up.
  function done(id) {
    const top = stack[stack.length - 1];
    if (id && top && top.id === id) { history.back(); return true; }
    return false;
  }
  window.addEventListener("popstate", () => {
    const top = stack.pop();
    if (!top) return;
    restoring = true;
    try { top.fn(); } finally { restoring = false; }
  });
  window.CSNav = { push, done, get restoring() { return restoring; } };
})();
