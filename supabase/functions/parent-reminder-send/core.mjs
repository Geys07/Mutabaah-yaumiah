// Dependency-injected policy; no credentials or live network in fixture tests.
export function jakartaTime(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(x => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour), minute: Number(p.minute) };
}
export function inWindow(now) { const t = jakartaTime(now); return t.hour === 20 && t.minute <= 15; }
export async function runReminders(io, options = {}) {
  const clock = options.clock || (() => new Date());
  const started = clock();
  const date = jakartaTime(started).date;
  const budget = options.budgetMs ?? 100000;
  const result = { reminder_date: date, sent: 0, failed: 0, skipped: 0, uncertain: 0, errors: 0, processed: 0, deferred: false };
  if (!inWindow(started)) return { ...result, outside_window: true };
  // Keyset cursor, not OFFSET: a finalized child can remove a target mid-run.
  // The DB wrapper has the same guardian_id order and a hard page cap of 500.
  let cursor = null;
  const seen = new Set();
  for (;;) {
    if (!inWindow(clock()) || clock() - started >= budget) { result.deferred = true; break; }
    const targets = await io.targets(date, cursor, 500);
    if (!targets.length) break;
    for (const target of targets) {
      if (!inWindow(clock()) || clock() - started >= budget) { result.deferred = true; return result; }
      cursor = target.guardian_id;
      if (seen.has(cursor)) continue;
      seen.add(cursor);
      result.processed++;
      let claim;
      let sending = false;
      try {
        claim = await io.claim(cursor, date);
        if (!claim) { result.skipped++; continue; }
        const devices = await io.devices(cursor);
        if (!devices.length) {
          await io.finish(cursor, date, claim, "failed", false, "no_devices");
          result.skipped++; continue;
        }
        // Recheck eligibility immediately before the irreversible phase.
        const pending = await io.pending(cursor, date);
        if (pending <= 0 || !inWindow(clock())) {
          await io.finish(cursor, date, claim, "failed", false, "no_longer_eligible");
          result.skipped++; continue;
        }
        if (!await io.begin(cursor, date, claim)) { result.skipped++; continue; }
        sending = true;
        // No child name, identifier, activation code, password or URL to a child.
        const payload = JSON.stringify({ title: "Mutabaah Yaumiah — MTs Al-Khairiyah", body: pending === 1 ? "Pengisian Mutabaah ananda hari ini belum selesai. Silakan lengkapi dan finalisasi." : "Pengisian Mutabaah " + pending + " anak hari ini belum selesai. Silakan lengkapi dan finalisasi.", tag: "mutabaah-" + date, url: "/" });
        let accepted = false;
        let ambiguous = false;
        for (const device of devices) {
          if (!inWindow(clock())) { ambiguous = true; break; }
          try {
            await io.send(device, payload);
            accepted = true;
          } catch (error) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              try { await io.expire(device); } catch { result.errors++; }
            } else ambiguous = true; // Network loss may follow successful acceptance.
          }
        }
        await io.finish(cursor, date, claim, accepted ? "sent" : "failed", false,
          ambiguous ? "delivery_uncertain" : accepted ? null : "expired_devices");
        if (accepted) result.sent++; else result.failed++;
        if (ambiguous) result.uncertain++;
      } catch {
        // Log only a fixed category; never raw exceptions, endpoints or keys.
        result.failed++; result.errors++;
        if (sending) result.uncertain++;
        if (claim) {
          try { await io.finish(cursor, date, claim, "failed", !sending, sending ? "delivery_uncertain" : "read_failed"); }
          catch { result.errors++; } // Existing sending marker forbids an unsafe retry.
        }
      }
    }
    if (targets.length < 500) break;
  }
  return result;
}
