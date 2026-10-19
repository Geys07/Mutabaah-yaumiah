// Read-only notification requests: initial attempt plus at most two retries.
const DELAYS = [500, 1500];
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isNotificationAbort(error, signal) {
  return Boolean(signal?.aborted || error?.name === "AbortError" ||
    error?.code === "ABORT_ERR" ||
    /\bAbortError\b|request (?:was )?aborted|signal is aborted/i.test(error?.message || ""));
}

export function canRetryNotification(error) {
  if (isNotificationAbort(error)) return false;
  const status = Number(error?.status);
  if (status > 0) return RETRY_STATUS.has(status);
  if (["42501", "PGRST301", "PGRST302", "PGRST303", "P0001"].includes(error?.code)) return false;
  return error?.name === "TimeoutError" ||
    /failed to fetch|fetch failed|networkerror|network request failed|load failed|ERR_CONNECTION_|ERR_NETWORK_/i.test(error?.message || "");
}

function abortError() {
  return new DOMException("Request aborted", "AbortError");
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    function cancel() { window.clearTimeout(timer); reject(abortError()); }
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export async function readNotification(factory, signal) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal.aborted) throw abortError();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    let timedOut = false;
    signal.addEventListener("abort", cancel, { once: true });
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);
    try {
      // The SDK retries idempotent requests too; only this bounded policy owns retries.
      const result = await factory(controller.signal).retry(false);
      if (signal.aborted) throw abortError();
      if (timedOut) throw Object.assign(new Error("Notification read timed out"), { name: "TimeoutError" });
      if (result.error) {
        throw Object.assign(new Error(result.error.message || "Gagal membaca notifikasi."), {
          name: result.error.name || "Error",
          code: result.error.code,
          status: result.status,
        });
      }
      return result;
    } catch (caught) {
      const error = signal.aborted ? abortError() : timedOut
        ? Object.assign(new Error("Notification read timed out"), { name: "TimeoutError" })
        : caught;
      if (attempt >= DELAYS.length || !canRetryNotification(error)) throw error;
    } finally {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
    await pause(DELAYS[attempt], signal);
  }
}

export async function notificationGroup(readers) {
  const results = await Promise.allSettled(readers);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => result.value);
}
