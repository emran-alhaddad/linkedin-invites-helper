// node test/sim.js — runs the real engine (core.js) against a fake LinkedIn on a virtual clock.
// Fake LinkedIn: real response shape, a strict rate limiter, random 999s, slow removal, 30k connection cap.
const assert = require('assert');
const { run, voyager } = require('../core.js');

function fakeLinkedIn({ pending, connections = 0, glitchRate = 0.005 }) {
  let t = Date.UTC(2026, 10, 10, 9);                // virtual clock
  const invs = Array.from({ length: pending }, (_, i) => ({ id: String(1e9 + i), secret: 's' + i }));
  const lagging = new Set();                         // acted on, still listed once (eventual consistency)
  const hits = [];                                   // action timestamps for the limiter
  let penaltyUntil = 0, penalties = 0, calls = 0;
  const WINDOW = 60000, MAX_PER_WINDOW = 25;         // stricter than our pace (~15/min peak)

  const res = (status, body = {}) => ({ ok: status < 300, status, json: async () => body });
  const fetch = async (url, opt = {}) => {
    calls++;
    if (t < penaltyUntil) return res(429);
    if (Math.random() < glitchRate) return res(999);
    if (url.includes('invitationsSummary')) return res(200, { data: { numPendingInvitations: invs.length } });
    if (url.includes('invitationViews')) {
      const [, s, c] = url.match(/start=(\d+)&count=(\d+)/).map(Number);
      const page = invs.slice(s, s + c);
      const body = page;
      for (const i of page) if (lagging.delete(i.id)) invs.splice(invs.indexOf(i), 1); // ghost shown once, then gone
      return res(200, { included: body.map(i => ({ $type: 'com.linkedin.voyager.relationships.invitation.Invitation', entityUrn: 'urn:li:fs_relInvitation:' + i.id, invitationType: 'PENDING', sharedSecret: i.secret })) });
    }
    const m = url.match(/invitations\/(\d+)\?action=(accept|ignore)/);
    if (m && opt.method === 'POST') {
      hits.push(t);
      while (hits[0] < t - WINDOW) hits.shift();
      if (hits.length > MAX_PER_WINDOW) { penaltyUntil = t + 15 * 60000; penalties++; return res(429); }
      const idx = invs.findIndex(i => i.id === m[1]);
      if (idx < 0 || lagging.has(m[1])) return res(400);
      if (JSON.parse(opt.body).invitationSharedSecret !== invs[idx].secret) return res(400);
      if (m[2] === 'accept' && connections >= 30000) return res(400);
      if (m[2] === 'accept') connections++;
      if (Math.random() < 0.05) lagging.add(m[1]); else invs.splice(idx, 1);
      return res(200);
    }
    return res(404);
  };
  return {
    fetch, left: () => invs.length - lagging.size, stats: () => ({ penalties, calls, connections }),
    now: () => t, sleep: async (ms) => { t += ms; }, advance: (ms) => { t += ms; }
  };
}

async function scenario(name, kind, opts, expect) {
  const li = fakeLinkedIn(opts);
  const src = voyager(li.fetch, 'csrf');
  const job = { kind, done: 0, failed: 0, day: '', doneToday: 0, skip: [] };
  const t0 = li.now(), stops = {};
  let why;
  for (let session = 0; session < 1000; session++) {     // user presses Continue each day / hour
    Object.assign(job, JSON.parse(JSON.stringify(job)));  // simulate localStorage round-trip
    why = await run({ src, job, sleep: li.sleep, now: li.now });
    stops[why] = (stops[why] || 0) + 1;
    if (why === 'daily-cap') li.advance(24 * 3600e3);
    else if (why === 'rate-limited') li.advance(3600e3);
    else break;
  }
  const days = ((li.now() - t0) / 864e5).toFixed(1);
  const s = li.stats();
  console.log(`${name.padEnd(34)} → ${why.padEnd(7)} done=${job.done} failed=${job.failed} left=${li.left()} penalties=${s.penalties} days≈${days} stops=${JSON.stringify(stops)}`);
  expect(job, li, why);
}

(async () => {
  for (const n of [5, 500, 50000]) {
    await scenario(`ignore ${n}`, 'ignore', { pending: n }, (job, li, why) => {
      assert.strictEqual(why, 'done');
      assert.strictEqual(li.left(), 0);
      assert.strictEqual(job.done, n);
      assert.strictEqual(job.failed, 0, 'successes re-acted after a pause');
      assert.strictEqual(li.stats().penalties, 0, 'pace tripped the rate limiter');
    });
    await scenario(`accept ${n} (4,557 connections)`, 'accept', { pending: n, connections: 4557 }, (job, li, why) => {
      const room = 30000 - 4557;
      if (n <= room) { assert.strictEqual(why, 'done'); assert.strictEqual(li.left(), 0); }
      else { assert.strictEqual(why, 'failing'); assert.strictEqual(job.done, room); }  // stops at LinkedIn's 30k cap
      assert.strictEqual(li.stats().penalties, 0);
    });
  }
  // Forced rate limiting: everything returns 429 for a while → engine backs off and recovers.
  await scenario('ignore 300, very noisy (10% 999s)', 'ignore', { pending: 300, glitchRate: 0.1 }, (job, li, why) => {
    assert.strictEqual(why, 'done'); assert.strictEqual(li.left(), 0);
  });
  console.log('ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
