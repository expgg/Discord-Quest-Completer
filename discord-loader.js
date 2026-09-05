/**
 * 🔗 LIVE HOT-RELOAD LOADER
 * Paste this into Discord Console (Ctrl + Shift + I) ONCE.
 * Any edits in this workspace will now update inside Discord automatically in real-time!
 */
(() => {
  let lastVersion = 0;
  console.log('%c[LiveSync]%c 🚀 Connected to localhost:5005! Watching for workspace changes...', 'color: #5865f2; font-weight: bold', '');

  setInterval(async () => {
    try {
      const res = await fetch('http://localhost:5005/version');
      const { v } = await res.json();
      if (v !== lastVersion) {
        lastVersion = v;
        const code = await fetch('http://localhost:5005/bundle.js').then(r => r.text());
        eval(code);
        console.log('%c[LiveSync]%c ⚡ Code changed in IDE — reloaded live in Discord!', 'color: #10b981; font-weight: bold', '');
      }
    } catch (e) {
      // Dev server waiting or offline
    }
  }, 1200);
})();
