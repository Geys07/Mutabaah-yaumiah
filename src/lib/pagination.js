// Factories return fresh queries on the original RLS-protected client.
export const BATCH_SIZE = 500;
export const PAGE_SIZE = 50;
export function literalPattern(value) {
  return "%" + String(value).trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
}
export function searchFilter(columns, value) {
  const literal = String(value).trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const text = literal.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return columns.map((column) => column + '.ilike."%' + text + '%"').join(",");
}
export async function fetchAll(factory, keys, signal) {
  const rows = [];
  try {
    for (let offset = 0; ; offset += BATCH_SIZE) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      let query = factory();
      for (const key of keys) query = query.order(key);
      query = query.range(offset, offset + BATCH_SIZE - 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Format daftar tidak valid.");
      rows.push(...data);
      if (data.length < BATCH_SIZE) return { data: rows, error: null };
    }
  } catch (error) { return { data: null, error }; }
}
