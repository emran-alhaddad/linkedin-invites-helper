// core.js — no DOM. The engine that pages through invitations and paces actions.
// Loaded before content.js in the browser; required by test/sim.js in Node.
(function (root) {
  const CFG = {
    pageSize: 50,
    delayMs: [2000, 5000],          // random gap between two actions
    breakEvery: 50,                 // after this many actions…
    breakMs: [60000, 120000],       // …take a 1–2 min break
    dailyCap: 1500,                 // actions per calendar day, then pause until tomorrow
    backoffMs: 60000,               // first wait after a rate-limit answer, doubles each time
    backoffMaxMs: 30 * 60000,
    maxBackoffs: 6,                 // ~1h of backing off in a row → give up for now
    maxFailStreak: 5                // 5 non-rate-limit errors in a row → stop (e.g. connection cap)
  };
  const RATE_LIMIT = new Set([429, 999, 503, 0]); // 999 = LinkedIn's bot wall, 0 = network error
  const AUTH = new Set([401, 403]);
  const rand = ([a, b]) => Math.round(a + Math.random() * (b - a));

  // --- LinkedIn internal API (same calls the web app makes) ---
  const parseInvitations = (j) => (j.included || [])
    .filter(i => /\.Invitation$/.test(i.$type) && i.invitationType === 'PENDING' && i.sharedSecret)
    .map(i => ({ id: String(i.entityUrn).split(':').pop(), secret: i.sharedSecret }));

  function voyager(fetchFn, csrf) {
    const H = {
      'csrf-token': csrf,
      'x-restli-protocol-version': '2.0.0',
      accept: 'application/vnd.linkedin.normalized+json+2.1'
    };
    const get = async (url) => {
      const r = await fetchFn(url, { headers: H, credentials: 'include' });
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
      return r.json();
    };
    return {
      name: 'api',
      async count() {
        const j = await get('/voyager/api/relationships/invitationsSummary');
        return (j.data || j).numPendingInvitations ?? 0;
      },
      async list(start, count) {
        return parseInvitations(await get(`/voyager/api/relationships/invitationViews?q=receivedInvitation&start=${start}&count=${count}`));
      },
      async act(kind, inv) {
        try {
          const r = await fetchFn(`/voyager/api/relationships/invitations/${inv.id}?action=${kind}`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...H, 'content-type': 'application/json' },
            body: JSON.stringify({ invitationId: inv.id, invitationSharedSecret: inv.secret, isGenericInvitation: false })
          });
          return r.status;
        } catch { return 0; }
      }
    };
  }

  // --- runner ---
  // job: { kind, done, failed, day, doneToday, skip: [ids], recent: [ids] } — plain JSON, persisted by the caller.
  // Returns why it stopped: 'done' | 'stopped' | 'daily-cap' | 'rate-limited' | 'auth' | 'failing'.
  async function run({ src, job, sleep, now, onTick = () => {}, shouldStop = () => false }) {
    const skip = new Set(job.skip);         // failed ids: still listed, never retried
    const recent = job.recent || [];        // last successes, persisted: LinkedIn can list them again briefly
    const seen = new Set([...skip, ...recent]);
    let failStreak = 0, backoffs = 0, sinceBreak = 0;

    const newDay = () => {
      const d = new Date(now()).toISOString().slice(0, 10);
      if (job.day !== d) { job.day = d; job.doneToday = 0; }
    };
    const rateLimited = async (status) => {
      if (++backoffs > CFG.maxBackoffs) return true;
      const ms = Math.min(CFG.backoffMs * 2 ** (backoffs - 1), CFG.backoffMaxMs);
      onTick({ phase: 'backoff', status, waitMs: ms });
      await sleep(ms);
      return false;
    };

    while (true) {
      if (shouldStop()) return 'stopped';
      newDay();
      if (job.doneToday >= CFG.dailyCap) return 'daily-cap';

      // next page that has something we haven't touched; failed ones stay listed, so page past them
      let batch = [], start = 0;
      try {
        while (true) {
          const page = await src.list(start, CFG.pageSize);
          if (!page.length) break;
          batch = page.filter(i => !seen.has(i.id));
          if (batch.length) break;
          start += page.length;
        }
      } catch (e) {
        if (AUTH.has(e.status)) return 'auth';
        if (RATE_LIMIT.has(e.status ?? 0)) { if (await rateLimited(e.status)) return 'rate-limited'; continue; }
        throw e;
      }
      if (!batch.length) return 'done';

      for (const inv of batch) {
        if (shouldStop()) return 'stopped';
        newDay();
        if (job.doneToday >= CFG.dailyCap) return 'daily-cap';

        const s = await src.act(job.kind, inv);
        if (s >= 200 && s < 300) {
          seen.add(inv.id); job.done++; job.doneToday++;
          recent.push(inv.id); job.recent = recent.slice(-200);
          failStreak = 0; backoffs = 0;
        } else if (AUTH.has(s)) {
          return 'auth';
        } else if (RATE_LIMIT.has(s)) {
          if (await rateLimited(s)) return 'rate-limited';
          break; // re-list after waiting
        } else {
          seen.add(inv.id); skip.add(inv.id); job.skip = [...skip]; job.failed++;
          if (++failStreak >= CFG.maxFailStreak) return 'failing';
        }
        onTick({ phase: 'working' });

        const ms = ++sinceBreak >= CFG.breakEvery ? (sinceBreak = 0, rand(CFG.breakMs)) : rand(CFG.delayMs);
        if (sinceBreak === 0) onTick({ phase: 'break', waitMs: ms });
        await sleep(ms);
      }
    }
  }

  const LIH = { CFG, run, voyager, parseInvitations };
  if (typeof module !== 'undefined') module.exports = LIH; else root.LIH = LIH;
})(globalThis);
