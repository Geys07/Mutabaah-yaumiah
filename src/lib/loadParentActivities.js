
import { supabase } from "./supabase";

// Kegiatan biasa tetap digunakan.
// Kegiatan Ramadan disisipkan hanya pada tanggal yang
// ditetapkan Admin dan ditampilkan lebih dahulu.

export async function loadParentActivities(selectedDate) {
  const [regular, ramadan] = await Promise.all([
    supabase
      .from("mutabaah_activities")
      .select(
        "id, code, title, category, sort_order, haid_rule, allowed_weekdays, scoring_mode"
      )
      .eq("is_active", true)
      .neq("category", "ramadan")
      .order("sort_order")
      .order("title"),

    supabase.rpc(
      "get_parent_ramadan_day_activities",
      {
        p_date: selectedDate,
      }
    ),
  ]);

  if (regular.error) {
    return {
      data: null,
      error: regular.error,
    };
  }

  if (ramadan.error) {
    return {
      data: null,
      error: ramadan.error,
    };
  }

  const extra = Array.isArray(ramadan.data)
    ? ramadan.data
    : [];

  return {
    data: [
      ...extra,
      ...(regular.data || []),
    ],
    error: null,
  };
}
