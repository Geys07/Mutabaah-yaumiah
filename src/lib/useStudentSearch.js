import { useCallback } from "react";
import { supabase } from "./supabase";
import { fetchAll, searchFilter } from "./pagination";
import usePagedQuery from "./usePagedQuery";
const ignorePage = () => {};
// Aggregated RPC reports are JSON, not pageable table responses. Search the
// complete class roster on the server, then intersect with the report period.
export default function useStudentSearch(search, classId) {
  const load = useCallback((signal) => {
    if (!search.trim() || !classId) return Promise.resolve({ data: [], count: 0 });
    return fetchAll(() => supabase.from("student_enrollments")
      .select("id,student_id,students!inner(id)").eq("class_id", classId)
      .or(searchFilter(["full_name", "nis"], search), { referencedTable: "students" }), ["id"], signal).then((result) => ({ ...result, count: result.data?.length || 0 }));
  }, [search, classId]);
  return usePagedQuery(load, 0, ignorePage);
}
