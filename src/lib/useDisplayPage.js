import { useState } from "react";
import { PAGE_SIZE } from "./pagination";
// Aggregates stay complete for totals/exports; only the displayed rows page.
export default function useDisplayPage(rows) {
  const [requested, setPage] = useState(0);
  const page = Math.min(requested, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  return { page, setPage, rows: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) };
}
