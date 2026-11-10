(() => {
  // --- target routes ---
  const RX_TARGET = /^https:\/\/www\.linkedin\.com\/mynetwork\/(grow|invitation-manager\/received)\/?([?#].*)?$/i;
  const isTarget = () => RX_TARGET.test(location.href);

  // pacing
  const CLICK_DELAY_MS = 650, WAVE_PAUSE_MS = 1200, MAX_WAVES = 30;

  // DOM hooks (LinkedIn SDUI, Nov 2026). Classes are hashed, so only stable attributes are used.
  const SEL_ITEM = '[role="listitem"][componentkey^="urn:li:invitation:"]';
  const RX_ACCEPT = /^(accept|قبول)/i;
  const RX_IGNORE = /^(ignore|تجاهل)/i;

  // locale (EN/AR)
  const isAR = (document.documentElement.lang || '').toLowerCase().startsWith('ar');
  const T = isAR ? {
    acceptAll: 'قبول الكل', ignoreAll: 'تجاهل الكل',
    pending: (n) => `${n} دعوة معلقة`,
    confirm: (k, n) => `${k === 'accept' ? 'قبول' : 'تجاهل'} ${n} دعوة؟`,
    done: (k, n) => `تم ${k === 'accept' ? 'قبول' : 'تجاهل'} ${n} دعوة`,
    working: 'جارٍ المعالجة…'
  } : {
    acceptAll: 'Accept all', ignoreAll: 'Ignore all',
    pending: (n) => `${n} pending invitation${n === 1 ? '' : 's'}`,
    confirm: (k, n) => `${k === 'accept' ? 'Accept' : 'Ignore'} ${n} invitation${n === 1 ? '' : 's'}?`,
    done: (k, n) => `${n} invitation${n === 1 ? '' : 's'} ${k === 'accept' ? 'accepted' : 'ignored'}`,
    working: 'Working…'
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();

  // --- invitation discovery ---
  function getCards() {
    const cards = [];
    document.querySelectorAll(SEL_ITEM).forEach(node => {
      const btns = [...node.querySelectorAll('button')];
      const accBtn = btns.find(b => RX_ACCEPT.test(label(b)));
      const ignBtn = btns.find(b => RX_IGNORE.test(label(b)));
      if (accBtn && ignBtn && !accBtn.disabled) cards.push({ node, accBtn, ignBtn });
    });
    return cards;
  }

  // Grow page header says "Invitations (N)" — more accurate than rendered rows.
  function getCount() {
    const h2 = document.querySelector('#MyNetwork_InvitationsPreview h2, [componentkey="MyNetwork_InvitationsPreview"] h2');
    const m = h2?.textContent.match(/\((\d+)\)/);
    return Math.max(m ? +m[1] : 0, getCards().length);
  }

  // --- panel ---
  let running = false;

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'lih-panel';
    panel.innerHTML = `
      <span class="lih-summary"></span>
      <span class="lih-actions">
        <button type="button" class="lih-btn lih-btn--tertiary" data-kind="ignore">${T.ignoreAll}</button>
        <button type="button" class="lih-btn lih-btn--primary" data-kind="accept">${T.acceptAll}</button>
      </span>`;
    panel.addEventListener('click', (e) => {
      const kind = e.target.closest('button')?.dataset.kind;
      if (kind) bulkClick(kind);
    });
    return panel;
  }

  // One rule for both pages: sit right above the list that holds the invitations.
  function sync() {
    let panel = document.getElementById('lih-panel');
    if (!isTarget()) { panel?.remove(); return; }

    const list = document.querySelector(SEL_ITEM)?.closest('[data-testid="lazy-column"], [role="list"]');
    if (!list) { if (!running) panel?.remove(); return; }

    panel ||= buildPanel();
    if (panel.nextElementSibling !== list) list.parentNode.insertBefore(panel, list);

    if (!running) {
      const n = getCount();
      panel.hidden = n === 0;
      panel.querySelector('.lih-summary').textContent = T.pending(n);
    }
  }

  async function bulkClick(kind) {
    if (running) return;
    const n = getCount();
    if (!n || !confirm(T.confirm(kind, n))) return;

    running = true;
    const panel = document.getElementById('lih-panel');
    panel?.classList.add('lih-busy');
    panel?.querySelectorAll('button').forEach(b => b.disabled = true);

    let total = 0;
    for (let wave = 0; wave < MAX_WAVES; wave++) {
      const cards = getCards();
      if (!cards.length) break;
      for (const c of cards) {
        if (!c.node.isConnected) continue;
        c.node.scrollIntoView({ block: 'center' });
        await sleep(120);
        (kind === 'accept' ? c.accBtn : c.ignBtn).click();
        total++;
        const s = document.querySelector('#lih-panel .lih-summary');
        if (s) s.textContent = `${T.working} ${total}`;
        await sleep(CLICK_DELAY_MS);
      }
      await sleep(WAVE_PAUSE_MS);
    }

    running = false;
    const p = document.getElementById('lih-panel');
    p?.classList.remove('lih-busy');
    p?.querySelectorAll('button').forEach(b => b.disabled = false);
    sync();
    toast(T.done(kind, total));
  }

  function toast(msg) {
    document.querySelector('.lih-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'lih-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = `<span class="lih-toast-icon" aria-hidden="true">✓</span><span></span>`;
    t.lastChild.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // LinkedIn is an SPA that re-renders constantly; one throttled observer covers
  // route changes, late hydration and list updates.
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; sync(); }, 250);
  }).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
