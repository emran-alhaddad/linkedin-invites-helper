(() => {
  const { run, voyager, CFG } = globalThis.LIH;

  const RX_TARGET = /^https:\/\/www\.linkedin\.com\/mynetwork\/(grow|invitation-manager\/received)\/?([?#].*)?$/i;
  const isTarget = () => RX_TARGET.test(location.href);
  const JOB_KEY = 'lih-job';

  // --- i18n (EN/AR) ---
  const isAR = (document.documentElement.lang || '').toLowerCase().startsWith('ar');
  const nf = (n) => n.toLocaleString(isAR ? 'ar' : 'en');
  const mins = (ms) => Math.max(1, Math.round(ms / 60000));
  const T = isAR ? {
    acceptAll: 'قبول الكل', ignoreAll: 'تجاهل الكل', stop: 'إيقاف', cont: 'متابعة', discard: 'إلغاء',
    pending: (n) => `${nf(n)} دعوة معلقة`,
    confirm: (k, n) => `${k === 'accept' ? 'قبول' : 'تجاهل'} ${nf(n)} دعوة؟\nسيتم ذلك بهدوء (حوالي ${nf(CFG.dailyCap)} يومياً) لتجنب حظر لينكدإن. أبقِ هذه الصفحة مفتوحة.`,
    working: (k, d, l) => `${k === 'accept' ? 'جارٍ القبول' : 'جارٍ التجاهل'}… ${nf(d)} تم · ${nf(l)} متبقٍ — أبقِ الصفحة مفتوحة`,
    brk: (ms) => `استراحة قصيرة (${nf(mins(ms))} د) لتجنب حدود لينكدإن`,
    backoff: (ms) => `لينكدإن طلب التمهل — انتظار ${nf(mins(ms))} د`,
    paused: (k, d) => `متوقف مؤقتاً: ${nf(d)} ${k === 'accept' ? 'تم قبولها' : 'تم تجاهلها'}`,
    why: {
      'daily-cap': `تم الوصول للحد اليومي (${nf(CFG.dailyCap)}). تابع غداً.`,
      'rate-limited': 'لينكدإن يحدّ الطلبات. حاول بعد ساعة.',
      auth: 'انتهت الجلسة. سجّل الدخول ثم تابع.',
      failing: 'لينكدإن رفض 5 طلبات متتالية (ربما وصلت لحد 30,000 اتصال).',
      stopped: ''
    },
    done: (k, n) => `تم ${k === 'accept' ? 'قبول' : 'تجاهل'} ${nf(n)} دعوة`
  } : {
    acceptAll: 'Accept all', ignoreAll: 'Ignore all', stop: 'Stop', cont: 'Continue', discard: 'Discard',
    pending: (n) => `${nf(n)} pending invitation${n === 1 ? '' : 's'}`,
    confirm: (k, n) => `${k === 'accept' ? 'Accept' : 'Ignore'} ${nf(n)} invitation${n === 1 ? '' : 's'}?\nIt runs at a human pace (up to ${nf(CFG.dailyCap)} a day) so LinkedIn doesn't block you. Keep this tab open.`,
    working: (k, d, l) => `${k === 'accept' ? 'Accepting' : 'Ignoring'}… ${nf(d)} done · ${nf(l)} left — keep this tab open`,
    brk: (ms) => `Short break (${nf(mins(ms))} min) to stay under LinkedIn's limits`,
    backoff: (ms) => `LinkedIn asked to slow down — waiting ${nf(mins(ms))} min`,
    paused: (k, d) => `Paused: ${nf(d)} ${k === 'accept' ? 'accepted' : 'ignored'}`,
    why: {
      'daily-cap': `Daily limit reached (${nf(CFG.dailyCap)}). Continue tomorrow.`,
      'rate-limited': 'LinkedIn is limiting requests. Try again in an hour.',
      auth: 'Your LinkedIn session expired. Sign in, then Continue.',
      failing: 'LinkedIn rejected 5 in a row (you may be at the 30,000-connection limit).',
      stopped: ''
    },
    done: (k, n) => `${nf(n)} invitation${n === 1 ? '' : 's'} ${k === 'accept' ? 'accepted' : 'ignored'}`
  };

  // --- persisted job (survives reloads, so 50k invitations can span days) ---
  const loadJob = () => { try { return JSON.parse(localStorage.getItem(JOB_KEY)); } catch { return null; } };
  const saveJob = (j) => { try { j ? localStorage.setItem(JOB_KEY, JSON.stringify(j)) : localStorage.removeItem(JOB_KEY); } catch { } };

  // --- sources: LinkedIn's API first, page buttons as fallback ---
  const SEL_ITEM = '[role="listitem"][componentkey^="urn:li:invitation:"]';
  const RX_ACCEPT = /^(accept|قبول)/i, RX_IGNORE = /^(ignore|تجاهل)/i;
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();

  function getCards() {
    const cards = [];
    document.querySelectorAll(SEL_ITEM).forEach(node => {
      const btns = [...node.querySelectorAll('button')];
      const acc = btns.find(b => RX_ACCEPT.test(label(b)));
      const ign = btns.find(b => RX_IGNORE.test(label(b)));
      if (acc && ign) cards.push({ id: node.getAttribute('componentkey'), node, acc, ign });
    });
    return cards;
  }

  const dom = {
    name: 'dom',
    async count() {
      const m = document.querySelector('#MyNetwork_InvitationsPreview h2')?.textContent.match(/\((\d+)\)/);
      return Math.max(m ? +m[1] : 0, getCards().length);
    },
    async list(start, count) {
      const cards = getCards();
      cards.at(-1)?.node.scrollIntoView({ block: 'end' }); // nudges LinkedIn to lazy-load more
      return cards.slice(start, start + count);
    },
    async act(kind, c) {
      if (!c.node.isConnected) return 200;
      c.node.scrollIntoView({ block: 'center' });
      (kind === 'accept' ? c.acc : c.ign).click();
      return 200;
    }
  };

  const csrf = () => (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1];
  const api = () => voyager(fetch.bind(window), csrf());

  // Use the API unless it's clearly broken (changed shape or endpoint); then click the page.
  async function pickSource() {
    const a = api();
    try {
      const page = await a.list(0, 1);
      if (page.length || !getCards().length) return a;
    } catch (e) {
      if ([401, 403, 429, 999, 0].includes(e.status ?? 0)) return a; // runner handles these
    }
    return dom;
  }

  // --- panel ---
  let busy = false, stopFlag = false;

  function panelEl() {
    let p = document.getElementById('lih-panel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'lih-panel';
      p.setAttribute('role', 'region');
      p.setAttribute('aria-live', 'polite');
      p.innerHTML = '<span class="lih-summary"></span><span class="lih-actions"></span>';
      p.addEventListener('click', onClick);
    }
    return p;
  }

  function render(text, buttons) {
    const p = panelEl();
    p.querySelector('.lih-summary').textContent = text;
    const key = buttons.map(b => b[0]).join();
    if (p.dataset.btns !== key) {
      p.dataset.btns = key;
      p.querySelector('.lih-actions').innerHTML = buttons
        .map(([k, txt, cls]) => `<button type="button" class="lih-btn lih-btn--${cls}" data-k="${k}">${txt}</button>`).join('');
    }
    p.classList.toggle('lih-busy', busy);
    p.hidden = false;
    place();
  }

  // Inline above the invitation list when we can find it; floating card otherwise.
  function place() {
    const p = panelEl();
    const list = document.querySelector(SEL_ITEM)?.closest('[data-testid="lazy-column"], [role="list"]');
    if (list) {
      p.classList.remove('lih-floating');
      if (p.nextElementSibling !== list) list.parentNode.insertBefore(p, list);
    } else if (!p.isConnected || !p.classList.contains('lih-floating')) {
      p.classList.add('lih-floating');
      document.body.appendChild(p);
    }
  }

  let lastCount = -1, counting = false;
  async function refreshIdle() {
    if (busy || counting) return;
    counting = true;
    try {
      const job = loadJob();
      if (job) {
        render(`${T.paused(job.kind, job.done)}. ${T.why[job.why] || ''}`.trim(),
          [['discard', T.discard, 'tertiary'], ['continue', T.cont, 'primary']]);
        return;
      }
      let n;
      try { n = await api().count(); } catch { n = await dom.count(); }
      lastCount = n;
      if (!n) { document.getElementById('lih-panel')?.remove(); return; }
      render(T.pending(n), [['ignore', T.ignoreAll, 'tertiary'], ['accept', T.acceptAll, 'primary']]);
    } finally { counting = false; }
  }

  async function onClick(e) {
    const k = e.target.closest('button')?.dataset.k;
    if (!k) return;
    if (k === 'stop') { stopFlag = true; return; }
    if (k === 'discard') { saveJob(null); return refreshIdle(); }
    if (k === 'continue') return start(loadJob());
    if (lastCount > 0 && confirm(T.confirm(k, lastCount))) {
      start({ kind: k, done: 0, failed: 0, day: '', doneToday: 0, skip: [], total: lastCount });
    }
  }

  async function start(job) {
    if (busy || !job) return;
    busy = true; stopFlag = false;
    saveJob(job);
    const left = () => Math.max(0, (job.total || 0) - job.done - job.failed);
    const stopBtn = [['stop', T.stop, 'tertiary']];
    render(T.working(job.kind, job.done, left()), stopBtn);

    let why;
    try {
      const src = await pickSource();
      why = await run({
        src, job,
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        now: Date.now,
        shouldStop: () => stopFlag,
        onTick: ({ phase, waitMs }) => {
          saveJob(job);
          render(phase === 'break' ? T.brk(waitMs) : phase === 'backoff' ? T.backoff(waitMs) : T.working(job.kind, job.done, left()), stopBtn);
        }
      });
    } catch (err) {
      console.warn('[LIH]', err);
      why = 'failing';
    }
    busy = false;

    if (why === 'done') {
      saveJob(null);
      toast(T.done(job.kind, job.done));
      setTimeout(() => location.reload(), 1500); // LinkedIn's list is stale after API actions
    } else {
      job.why = why;
      saveJob(job);
      refreshIdle();
    }
  }

  function toast(msg) {
    document.querySelector('.lih-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'lih-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span class="lih-toast-icon" aria-hidden="true">✓</span><span></span>';
    t.lastChild.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // LinkedIn is an SPA that re-renders constantly; one throttled observer handles
  // route changes, late hydration and list updates.
  let lastHref = '', pending = false;
  function sync() {
    if (!isTarget()) { if (!busy) document.getElementById('lih-panel')?.remove(); return; }
    if (location.href !== lastHref) { lastHref = location.href; refreshIdle(); }
    if (document.getElementById('lih-panel')) place();
  }
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; sync(); }, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
