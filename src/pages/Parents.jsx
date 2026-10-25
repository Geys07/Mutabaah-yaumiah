import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StudentFamily from "./StudentFamily";
import ActivationBatch from "./ActivationBatch";
import { groupParentStudents, groupParentsByClass, PARENT_PAGE_SIZE } from "../lib/parentDirectory";
import { listenStudentDataChanges } from "../lib/studentDataUpdates";
import "./Parents.css";

function ContactCell({ contact }) {
  if (!contact || (!contact.contact_name && !contact.phone)) {
    return <span className="parents-neutral">—</span>;
  }
  return (
    <div className="parents-contact">
      <strong>{contact.contact_name || "—"}</strong>
      {contact.phone ? <span>{contact.phone}</span> : null}
      {contact.account_linked ? <small className="parents-contact-linked">Akun terhubung</small> : null}
      {!contact.account_linked && contact.activation_status === "active" && contact.activation_code
        ? <small>Kode aktif: <span className="parents-code">{contact.activation_code}</span></small>
        : null}
    </div>
  );
}

export default function Parents() {
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [classFilter,setClassFilter]=useState("");
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [reload,setReload]=useState(0);
  const [selectedStudent,setSelectedStudent]=useState(null);

  const refresh=useCallback(()=>setReload(n=>n+1),[]);
  useEffect(()=>listenStudentDataChanges(refresh),[refresh]);
  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();
    async function read(){
      setLoading(true);setError("");
      try{
        const {data,error:problem}=await fetchAll(
          ()=>supabase.rpc("list_parent_contacts"),["student_id","relationship"],controller.signal
        );
        if(problem)throw problem;
        if(alive&&!controller.signal.aborted)setRows(data||[]);
      }catch(problem){
        if(alive&&!controller.signal.aborted)setError(problem?.message||"Daftar orang tua belum dapat dimuat.");
      }finally{
        if(alive&&!controller.signal.aborted)setLoading(false);
      }
    }
    void read();
    return()=>{alive=false;controller.abort()};
  },[reload]);

  const classes=useMemo(()=>{
    const names=[...new Set(rows.map(r=>r.class_name||"Tanpa Kelas"))];
    const collator=new Intl.Collator("id",{numeric:true,sensitivity:"base"});
    return names.sort(collator.compare);
  },[rows]);
  const students=useMemo(
    ()=>groupParentStudents(rows,{search,status,classId:classFilter}),
    [rows,search,status,classFilter]
  );
  const actualPage=Math.min(page,Math.max(0,Math.ceil(students.length/PARENT_PAGE_SIZE)-1));
  const visible=useMemo(()=>students.slice(actualPage*PARENT_PAGE_SIZE,(actualPage+1)*PARENT_PAGE_SIZE),
    [students,actualPage]);
  const groups=useMemo(()=>groupParentsByClass(visible),[visible]);

  function editStudent(student) {
    setSelectedStudent({id:student.id,full_name:student.student_name,linkedContacts:student.contacts});
  }
  function closeStudent() {
    // Simpan/kode sudah mengirim sinyal refresh; jangan melakukan query dua kali.
    setSelectedStudent(null);
  }
  return (
    <section className="parents-panel">
      <header className="parents-heading">
        <h2>Orang Tua / Wali</h2>
        <button type="button" disabled={loading} onClick={refresh}>Perbarui</button>
      </header>

      <ActivationBatch />

      <div className="parents-filters">
        <label>
          <span>Cari</span>
          <input type="search" value={search}
            placeholder="Siswa, ayah, ibu, wali, nomor HP"
            onChange={e=>{setPage(0);setSearch(e.target.value)}}/>
        </label>
        <label>
          <span>Kelas</span>
          <select value={classFilter} onChange={e=>{setPage(0);setClassFilter(e.target.value)}}>
            <option value="">Semua Kelas</option>
            {classes.map(name=><option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Status Akun</span>
          <select value={status} onChange={e=>{setPage(0);setStatus(e.target.value)}}>
            <option value="all">Semua</option>
            <option value="linked">Ada akun terhubung</option>
            <option value="unlinked">Belum terhubung</option>
          </select>
        </label>
      </div>

      {error&&<p className="parents-error" role="alert">{error}</p>}
      {loading&&!rows.length?(
        <div className="parents-empty" role="status">Memuat data orang tua…</div>
      ):!loading&&students.length===0?(
        <EmptyState kind="people" illustration="parent" title="Tidak ada data yang sesuai"
          description={search||classFilter||status!=="all"
            ?"Coba ubah pencarian atau filter kelas."
            :"Siswa akan tampil di sini setelah data wali tersedia."}/>
      ):(
        <div className="parents-class-groups">
          {groups.map(group=>(
            <section className="parents-class-group" key={group.name} aria-label={`Kelas ${group.name}`}>
              <div className="parents-class-heading">
                <h3>{group.name}</h3><span>{group.students.length} siswa</span>
              </div>
              <div className="parents-table-wrapper">
                <table aria-label={`Orang tua siswa kelas ${group.name}`}>
                  <thead><tr>
                    <th>No.</th><th>Siswa</th><th>Ayah</th><th>Ibu</th><th>Wali Lain</th>
                    <th>Akun</th><th>Tindakan</th>
                  </tr></thead>
                  <tbody>
                    {group.students.map((student,index)=>{
                      const linked=Object.values(student.contacts).some(c=>c?.account_linked);
                      return (
                        <tr key={student.id}>
                          <td className="parents-number">{index+1}</td>
                          <td className="parents-student-name" data-number={index+1}>{student.student_name}</td>
                          <td><ContactCell contact={student.contacts.father}/></td>
                          <td><ContactCell contact={student.contacts.mother}/></td>
                          <td><ContactCell contact={student.contacts.guardian}/></td>
                          <td><span className={linked?"parents-account-linked":"parents-account-neutral"}>
                            {linked?"Terhubung":"Belum terhubung"}
                          </span></td>
                          <td><button type="button" className="parents-edit"
                            onClick={()=>editStudent(student)}>Kelola</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      {loading&&rows.length>0?<p className="parents-syncing" role="status">Memperbarui data…</p>:null}
      {students.length>PARENT_PAGE_SIZE&&<Pagination
        page={actualPage} total={students.length} loading={loading} onChange={setPage}/>}
      {selectedStudent&&<StudentFamily student={selectedStudent} onClose={closeStudent}/>}
    </section>
  );
}
