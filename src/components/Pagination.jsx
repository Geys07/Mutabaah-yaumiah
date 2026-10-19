import "./Pagination.css";
export default function Pagination({ page, total, pageSize = 50, loading, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="data-pagination" aria-label="Pagination daftar">
    <span role="status">{total} data · Halaman {page + 1} dari {pages}</span>
    <button type="button" disabled={loading || page === 0} onClick={() => onChange(0)}>Pertama</button>
    <button type="button" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Sebelumnya</button>
    <button type="button" disabled={loading || page + 1 >= pages} onClick={() => onChange(page + 1)}>Berikutnya</button>
    <button type="button" disabled={loading || page + 1 >= pages} onClick={() => onChange(pages - 1)}>Terakhir</button>
  </nav>;
}
