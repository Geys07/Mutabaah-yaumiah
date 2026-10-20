import "./Pagination.css";
export default function Pagination({page,total,pageSize=50,loading,onChange}) {
const pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(Math.max(page,0),pages-1);
return <nav className="data-pagination" aria-label="Navigasi halaman data"><span className="data-pagination-total">{total} data</span>
<div className="data-pagination-controls">
<button type="button" aria-label="Halaman sebelumnya" disabled={loading||current===0} onClick={()=>onChange(current-1)}><span aria-hidden="true">‹</span></button>
<span className="data-pagination-count" role="status" aria-live="polite">{current+1} / {pages}</span>
<button type="button" aria-label="Halaman berikutnya" disabled={loading||current+1>=pages} onClick={()=>onChange(current+1)}><span aria-hidden="true">›</span></button>
</div></nav>}