import { getSchoolIdentity } from "./supabase";
import { getCurrentAccount } from "./auth";

// Never infer an account/role from an offline cache. Late attempts cannot commit
// state: App also ignores results after its effect has been replaced.
export async function readAppStartup() {
  if (navigator.onLine === false) throw new Error("Perangkat sedang offline.");
  let timer;
  try {
    return await Promise.race([
      Promise.all([getSchoolIdentity(), getCurrentAccount({ rejectNetworkErrors: true })]),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Server belum dapat dihubungi.")), 15000);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}
