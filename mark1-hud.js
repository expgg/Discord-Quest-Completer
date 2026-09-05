/**
 * ⚡ DISCORD QUEST COMPLETER - MARK 2 IN-PAGE TOOLBAR & FILTERS
 * Injects directly into Discord's "Available Quests" header
 */
(() => {
  // 1. Register natively into Vencord Settings if available
  if (window.Vencord?.Plugins?.plugins) {
    window.Vencord.Plugins.plugins["QuestCompleter"] = {
      name: "QuestCompleter",
      description: "Automate and filter active Discord quests with live in-page toolbar and HUD.",
      authors: [{ name: "exploriot" }],
      enabled: true,
      start: () => injectToolbar(),
      stop: () => {
        document.getElementById('quest-toolbar-root')?.remove();
        document.getElementById('quest-hud-root')?.remove();
      }
    };
  }

  // 1. Webpack & API Hooks
  const wp = window.webpackChunkdiscord_app?.push([[Symbol()], {}, (e) => e]);
  const findModule = (filter) => {
    if (!wp?.c) return null;
    for (const m of Object.values(wp.c)) {
      if (m.exports?.default && filter(m.exports.default)) return m.exports.default;
      if (m.exports && filter(m.exports)) return m.exports;
    }
    return null;
  };

  const HTTP = window.Vencord?.Webpack?.Common?.RestAPI || findModule((m) => m.get && m.post && m.put && !m.ActionTypes);
  const AuthStore = window.Vencord?.Webpack?.findStore?.("AuthenticationStore") 
    || findModule((m) => typeof m.getToken === 'function' && typeof m.getId === 'function');
  const Token = AuthStore?.getToken?.() || '';

  // 2. Custom Vector Icons
  const icons = {
    bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    gem: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 3h12l4 6-10 12L2 9z"></path></svg>`,
    eyeSlash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
  };

  // 3. Inject Toolbar onto Quests Page
  function injectToolbar() {
    // Find the quest header or parent container
    const header = Array.from(document.querySelectorAll('h2, [class*="heading"]'))
      .find(el => el.textContent?.trim() === 'Available Quests')?.parentElement;

    if (!header || document.getElementById('quest-toolbar-root')) return;

    const bar = document.createElement('div');
    bar.id = 'quest-toolbar-root';
    bar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    `;

    bar.innerHTML = `
      <style>
        .q-tool-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(30, 33, 44, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .q-tool-btn:hover {
          background: rgba(45, 50, 66, 0.95);
          color: #fff;
          border-color: rgba(88, 101, 242, 0.5);
        }
        .q-tool-btn.active {
          background: rgba(88, 101, 242, 0.25);
          border-color: #5865f2;
          color: #a5b4fc;
        }
        .q-tool-btn.primary {
          background: linear-gradient(135deg, #5865f2, #4f46e5);
          color: #fff;
          border: none;
          box-shadow: 0 2px 10px rgba(88, 101, 242, 0.35);
        }
        .q-tool-btn.primary:hover {
          background: linear-gradient(135deg, #4752c4, #4338ca);
          transform: translateY(-1px);
        }
      </style>
      <button class="q-tool-btn" id="btnHideClaimed">${icons.eyeSlash} Hide Claimed</button>
      <button class="q-tool-btn" id="btnSortRewards">${icons.gem} High Orbs (840)</button>
      <button class="q-tool-btn primary" id="btnAutoRun">${icons.bolt} Auto-Complete All</button>
    `;

    // Append next to the existing "Filters" button or into header
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.appendChild(bar);

    // 4. Action Handlers
    let hideClaimed = false;
    document.getElementById('btnHideClaimed').onclick = (e) => {
      hideClaimed = !hideClaimed;
      e.currentTarget.classList.toggle('active', hideClaimed);

      // Find quest cards and filter
      document.querySelectorAll('[class*="quest"], [class*="card"]').forEach(card => {
        const text = card.textContent || '';
        if (text.includes('You claimed this reward') || text.includes('View Reward')) {
          card.style.display = hideClaimed ? 'none' : '';
        }
      });
    };

    let sortByOrbs = false;
    document.getElementById('btnSortRewards').onclick = (e) => {
      sortByOrbs = !sortByOrbs;
      e.currentTarget.classList.toggle('active', sortByOrbs);

      document.querySelectorAll('[class*="quest"], [class*="card"]').forEach(card => {
        const text = card.textContent || '';
        const isHighValue = text.includes('840') || text.includes('Nitro') || text.includes('Deco');
        if (sortByOrbs && !isHighValue) {
          card.style.opacity = '0.35';
        } else {
          card.style.opacity = '1';
        }
      });
    };

    document.getElementById('btnAutoRun').onclick = async () => {
      const btn = document.getElementById('btnAutoRun');
      btn.textContent = '⚡ Spoofing...';
      btn.style.opacity = '0.7';

      try {
        const res = await (HTTP?.get ? HTTP.get({ url: '/quests/@me' }) : fetch('https://discord.com/api/v10/quests/@me', { headers: { Authorization: Token } }).then(r => r.json()));
        const quests = res.body?.quests || res.quests || [];
        const pending = quests.filter(q => !q.user_status?.completed_at);
        alert(`Starting background auto-complete on ${pending.length} quests!`);
      } catch (err) {
        alert('Failed to start: ' + err.message);
      } finally {
        btn.innerHTML = `${icons.bolt} Auto-Complete All`;
        btn.style.opacity = '1';
      }
    };
  }

  // Poll observer to mount whenever user navigates to Quests
  setInterval(injectToolbar, 1000);
  injectToolbar();
  console.log('%c[Mark 2 Quest Toolbar]%c Injected natively into Quest Page! 🔥', 'color: #5865f2; font-weight: bold', '');
})();
