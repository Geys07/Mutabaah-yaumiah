import {useState} from "react";
import PromotionManager from "./PromotionManager";
import SemesterBoundaryManager from "./SemesterBoundaryManager";
import AcademicYearsBase from "./AcademicYearsBase";
import "./SectionTabs.css";
const SECTIONS=[{"id":"years","title":"Tahun Ajaran"},{"id":"semester","title":"Semester"},{"id":"promotion","title":"Kenaikan & Kelulusan"}];
export default function AcademicYears(){const [section,setSection]=useState(SECTIONS[0].id);
return <div className="section-workspace"><nav className="section-tabs" aria-label="Bagian Tahun Ajaran">
{SECTIONS.map(item=><button key={item.id} type="button" className={section===item.id?"is-active":""} aria-current={section===item.id?"page":undefined} onClick={()=>setSection(item.id)}>{item.title}</button>)}</nav>
<div hidden={section!=="years"}><AcademicYearsBase/></div>
<div hidden={section!=="semester"}><SemesterBoundaryManager/></div>
<div hidden={section!=="promotion"}><PromotionManager/></div></div>}