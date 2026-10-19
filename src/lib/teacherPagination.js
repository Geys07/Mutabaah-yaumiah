import { fetchAll, searchFilter, BATCH_SIZE, PAGE_SIZE } from "./pagination";

// Profiles and roles have no direct PostgREST relationship. Scan only matching
// profiles in bounded batches, retain one UI page, and count eligible accounts.
// This preserves the existing inclusion of accounts with no assigned role.
export async function teacherPage(client, search, page, signal) {
  const rows = [];
  let count = 0;
  try {
    for (let offset = 0; ; offset += BATCH_SIZE) {
      let query = client.from("profiles").select("user_id,full_name,phone,account_status");
      if (search.trim()) query = query.or(searchFilter(["full_name", "phone"], search));
      const result = await query.order("full_name").order("user_id")
        .range(offset, offset + BATCH_SIZE - 1).abortSignal(signal);
      if (result.error) throw result.error;
      const profiles = result.data || [];
      const roles = [];
      for (let i = 0; i < profiles.length; i += 200) {
        const ids = profiles.slice(i, i + 200).map((p) => p.user_id);
        const result = await fetchAll(() => client.from("user_roles")
          .select("user_id,role").in("user_id", ids), ["user_id", "role"], signal);
        if (result.error) throw result.error;
        roles.push(...result.data);
      }
      const excluded = new Set(roles.filter((r) => ["admin", "parent", "principal"].includes(r.role)).map((r) => r.user_id));
      const teachers = new Set(roles.filter((r) => r.role === "homeroom_teacher").map((r) => r.user_id));
      for (const profile of profiles) {
        if (excluded.has(profile.user_id)) continue;
        if (count >= page * PAGE_SIZE && rows.length < PAGE_SIZE) rows.push({ ...profile, isTeacher: teachers.has(profile.user_id) });
        count += 1;
      }
      if (profiles.length < BATCH_SIZE) return { data: rows, count, error: null };
    }
  } catch (error) { return { data: null, count: 0, error }; }
}
