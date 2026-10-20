import "./EmptyState.css";
export default function EmptyState({title,description,kind="document"}) {
  return <div className="my-empty-state" role="status">
    <svg viewBox="0 0 160 106" width="128" height="85" aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="96" rx="65" ry="8" fill="currentColor" opacity=".07"/>
      <path d="M30 82C14 58 31 19 61 17c14-21 49-7 58 9 32 0 36 45 10 60Z" fill="currentColor" opacity=".06"/>
      <path d="M52 17h45l18 18v47a7 7 0 0 1-7 7H52a7 7 0 0 1-7-7V24a7 7 0 0 1 7-7Z" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="2"/>
      <path d="M97 18v19h18" fill="none" stroke="currentColor" strokeWidth="2" opacity=".45"/>
      {kind==="people" ? <>
        <circle cx="72" cy="49" r="11" fill="currentColor" opacity=".6"/>
        <path d="M52 76c0-23 40-23 40 0" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".6"/>
        <circle cx="99" cy="57" r="7" fill="currentColor" opacity=".3"/>
      </> : <path d="M58 48h42M58 60h37M58 72h25" stroke="currentColor" opacity=".65" strokeWidth="5" strokeLinecap="round"/>}
      <path d="m21 42 4-7 4 7 7 4-7 4-4 7-4-7-7-4Z" fill="currentColor" opacity=".22"/>
      <path d="m128 63 3-5 3 5 5 3-5 3-3 5-3-5-5-3Z" fill="currentColor" opacity=".3"/>
    </svg>
    <strong>{title}</strong>
    {description && <p>{description}</p>}
  </div>;
}
