import {useState} from "react";
import StudentsBase from "./StudentsBase";
import StudentAdminTools from "./StudentAdminTools";
import StudentHistoryPanel from "./StudentHistoryPanel";
import "./SectionTabs.css";
const SECTIONS=[{"id":"list","title":"Data Siswa"},{"id":"admin","title":"Administrasi"},{"id":"history","title":"Riwayat"}];
export default function Students(){const [section,setSection]=useState(SECTIONS[0].id);const [revision,setRevision]=useState(0);
return <div className="section-workspace"><nav className="section-tabs" aria-label="Bagian Data Siswa">
{SECTIONS.map(item=><button key={item.id} type="button" className={section===item.id?"is-active":""} aria-current={section===item.id?"page":undefined} onClick={()=>setSection(item.id)}>{item.title}</button>)}</nav>
<div hidden={section!=="list"}><StudentsBase key={revision}/></div>
<div hidden={section!=="admin"}><StudentAdminTools onChanged={()=>setRevision(n=>n+1)}/></div>
<div hidden={section!=="history"}><StudentHistoryPanel/></div></div>}