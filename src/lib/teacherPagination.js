import { fetchAll, searchFilter, BATCH_SIZE, PAGE_SIZE } from "./pagination";

// Menampilkan akun staf tanpa mengekspos akun admin atau orang tua.
// Akun guru lama tanpa penugasan peran tetap tampak pada daftar guru.
export async function staffPage(client, search, page, signal, role = "homeroom_teacher") {
  const rows = [];
  let count = 0;
  try {
    for (let offset = 0; ; offset += BATCH_SIZE) {
      let query = client.from("profiles").select("user_id,full_name,username,phone,account_status");
      if (search.trim()) query = query.or(searchFilter(["full_name","username","phone"], search));
      const result = await query.order("full_name").order("user_id")
        .range(offset, offset + BATCH_SIZE - 1).abortSignal(signal);
      if (result.error) throw result.error;
      const profiles = result.data || [];
      const roles = [];
      for (let i = 0; i < profiles.length; i += 200) {
        const ids = profiles.slice(i, i + 200).map((profile) => profile.user_id);
        const found = await fetchAll(() => client.from("user_roles")
          .select("user_id,role").in("user_id", ids), ["user_id", "role"], signal);
        if (found.error) throw found.error;
        roles.push(...found.data);
      }
      const map = new Map();
      for (const item of roles) {
        const set = map.get(item.user_id) || new Set();
        set.add(item.role);
        map.set(item.user_id, set);
      }
      for (const profile of profiles) {
        const assigned = map.get(profile.user_id) || new Set();
        if (assigned.has("admin") || assigned.has("parent")) continue;
        if (role === "principal" && (!assigned.has("principal") || assigned.has("homeroom_teacher"))) continue;
        if (role === "homeroom_teacher" && assigned.has("principal")) continue;
        if (count >= page * PAGE_SIZE && rows.length < PAGE_SIZE) {
          rows.push({ ...profile, isTeacher: assigned.has("homeroom_teacher") });
        }
        count += 1;
      }
      if (profiles.length < BATCH_SIZE) return { data: rows, count, error: null };
    }
  } catch(error) {
    return { data: null, count: 0, error };
  }
}
export const teacherPage = (client,search,page,signal) =>
  staffPage(client,search,page,signal,"homeroom_teacher");
