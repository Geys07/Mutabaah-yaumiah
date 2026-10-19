
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Konfigurasi Supabase belum lengkap. Periksa file .env.local."
  );
}

let pending = 0;
let revision = 0;
let changedAt = performance.now();

const listeners = new Set();

function announce() {
  revision += 1;
  changedAt = performance.now();

  for (const listener of listeners) {
    listener();
  }
}

export function getDataRequestState() {
  return {
    pending,
    revision,
    changedAt,
  };
}

export function watchDataRequests(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function trackedFetch(input, init) {
  pending += 1;
  announce();

  try {
    return await fetch(input, init);
  } finally {
    pending = Math.max(0, pending - 1);
    announce();
  }
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    global: {
      fetch: trackedFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export async function getSchoolIdentity() {
  const { data, error } = await supabase
    .from("school_identity")
    .select(
      "school_name, app_name, logo_path, address"
    )
    .eq("id", true)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
