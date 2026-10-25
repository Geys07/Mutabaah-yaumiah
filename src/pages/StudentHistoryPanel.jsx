
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { PAGE_SIZE } from "../lib/pagination";
import { useLiveDataRevision } from "../lib/studentDataUpdates";
import Pagination from "../components/Pagination";
import "./StudentHistoryPanel.css";

const STATUS = {
  active: "Aktif",
  exited: "Keluar",
  graduated: "Lulus",
};

function formatDate(value) {
  if (!value) return "Sekarang / belum ditutup";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function StudentHistoryPanel() {
  const requestId = useRef(0);
  const controllerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => () => { requestId.current += 1; controllerRef.current?.abort(); }, []);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [student, setStudent] = useState(null);

  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const liveRevision = useLiveDataRevision();
  const liveHistoryRef = useRef({ selectedId: "", page: 0, openHistory: null });

  async function findStudent(event) {
    event.preventDefault();

    const keyword = search.trim();

    if (keyword.length < 2) {
      setError(
        "Masukkan sedikitnya dua karakter nama, NIS, atau NISN."
      );
      return;
    }

    const id = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setSearching(true);
    setResults([]);
    setStudent(null);
    setError("");

    try {
      const { data, error: queryError } =
        await supabase.rpc(
          "search_mutabaah_student_history",
          { p_query: keyword }
        ).abortSignal(controller.signal);

      if (queryError) throw queryError;

      if (id === requestId.current) {
        const found=Array.isArray(data)?data:[];
        // Hanya hasil pencarian (maks. 40), bukan pemuatan seluruh sekolah.
        // Pilih riwayat kelas terbaru untuk siswa yang sudah keluar/lulus.
        let enriched=found;
        if(found.length){
          const {data:placements,error:placementError}=await supabase
            .from("student_enrollments")
            .select("student_id,starts_on,classes(name)")
            .in("student_id",found.map(item=>item.id))
            .order("starts_on",{ascending:false})
            .limit(300)
            .abortSignal(controller.signal);
          if(!placementError&&Array.isArray(placements)){
            const lastClass=new Map();
            for(const place of placements)
              if(!lastClass.has(place.student_id))
                lastClass.set(place.student_id,place.classes?.name||"");
            enriched=found.map(item=>({...item,class_name:lastClass.get(item.id)||"Tanpa Kelas"}));
          }
        }
        if(id===requestId.current&&!controller.signal.aborted)setResults(enriched);
      }
    } catch (caught) {
      if (id === requestId.current) {
        setError(
          caught.message || "Pencarian gagal."
        );
      }
    } finally {
      if (id === requestId.current) {
        setSearching(false);
      }
    }
  }

  async function openHistory(studentId, pageIndex = 0) {
    setSelectedId(studentId);
    const id = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setStudent(null);
    setError("");

    try {
      const [identity, placements] = await Promise.all([
        supabase.from("students").select("id,full_name,nis,nisn,status,enrolled_on,exited_on")
          .eq("id", studentId).single().abortSignal(controller.signal),
        supabase.from("student_enrollments")
          .select("id,class_id,starts_on,ends_on,classes!inner(id,name,grade,academic_years!inner(start_year,starts_on,ends_on))", { count: "exact" })
          .eq("student_id", studentId).order("starts_on", { ascending: false }).order("id")
          .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1).abortSignal(controller.signal),
      ]);
      if (identity.error || placements.error) throw identity.error || placements.error;
      if (!Number.isFinite(placements.count)) throw new Error("Jumlah riwayat tidak tersedia.");
      if (id === requestId.current) {
        if (pageIndex > 0 && pageIndex * PAGE_SIZE >= placements.count) {
          return openHistory(studentId, Math.max(0, Math.ceil(placements.count / PAGE_SIZE) - 1));
        }
        setPage(pageIndex); setTotal(placements.count);
        setStudent({ ...identity.data, name: identity.data.full_name,
          placements: placements.data.map((entry) => ({
            enrollment_id: entry.id, class_id: entry.class_id, class_name: entry.classes.name,
            grade: entry.classes.grade, starts_on: entry.starts_on, ends_on: entry.ends_on,
            academic_year: entry.classes.academic_years.start_year + "/" + (entry.classes.academic_years.start_year + 1),
            year_starts_on: entry.classes.academic_years.starts_on, year_ends_on: entry.classes.academic_years.ends_on,
          })),
        });
      }

    } catch (caught) {
      if (id === requestId.current) {
        setError(
          caught.message || "Riwayat gagal dimuat."
        );
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    liveHistoryRef.current = { selectedId, page, openHistory };
  });

  useEffect(() => {
    const current = liveHistoryRef.current;
    if (current.selectedId && current.openHistory) {
      void current.openHistory(current.selectedId, current.page);
    }
  }, [liveRevision]);

  const groupedResults=useMemo(()=>{
    const map=new Map();
    for(const item of results){
      const cls=item.class_name||"Tanpa Kelas";
      if(!map.has(cls))map.set(cls,[]);
      map.get(cls).push(item);
    }
    const sort=new Intl.Collator("id",{numeric:true,sensitivity:"base"});
    return [...map.entries()].sort((a,b)=>sort.compare(a[0],b[0]));
  },[results]);

  return (
    <section
      className="sh-panel"
      aria-label="Riwayat penempatan siswa"
    >
      <div className="sh-heading">
        <div>
          <h2>Riwayat Kelas Siswa</h2>
        </div>

      </div>

      <form
        className="sh-search"
        onSubmit={findStudent}
      >
        <label htmlFor="sh-keyword">
          Cari siswa
        </label>

        <div>
          <input
            id="sh-keyword"
            value={search}
            maxLength={100}
            placeholder="Nama, NIS, atau NISN"
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <button
            type="submit"
            disabled={searching}
          >
            {searching ? "Mencari…" : "Cari"}
          </button>
        </div>
      </form>

      {error && (
        <p className="sh-error" role="alert">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="sh-results" aria-label="Hasil pencarian siswa per kelas">
          {groupedResults.map(([className,items])=>(
            <section className="sh-class-group" key={className}>
              <header className="sh-class-heading">
                <h3>{className}</h3>
                <span>{items.length} siswa</span>
              </header>
              <div className="sh-class-list">
                {items.map((entry,index)=>(
                  <button type="button" key={entry.id}
                    onClick={()=>void openHistory(entry.id)}
                    className={student?.id===entry.id?"is-selected":""}>
                    <strong><span className="sh-row-number">{index+1}.</span> {entry.name}</strong>
                    <small>NIS: {entry.nis||"—"} · {STATUS[entry.status]||entry.status}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {loading && (
        <p className="sh-hint" role="status">
          Memuat riwayat…
        </p>
      )}

      {student && (
        <div className="sh-detail">
          <Pagination page={page} total={total} loading={loading} onChange={(next) => void openHistory(selectedId, next)} />
          <div className="sh-student">
            <div>
              <h3>{student.name}</h3>

              <p>
                NIS: {student.nis || "—"} ·
                NISN: {student.nisn || "—"}
              </p>
            </div>

            <span className="sh-status">
              {STATUS[student.status] ||
                student.status}
            </span>
          </div>

          {student.placements?.length ? (
            <ol className="sh-timeline">
              {student.placements.map(
                (place) => (
                  <li key={place.enrollment_id}>
                    <div>
                      <strong>
                        {place.class_name}
                      </strong>

                      <span>
                        {place.academic_year}
                      </span>
                    </div>

                    <p>
                      {formatDate(
                        place.starts_on
                      )}
                      {" — "}
                      {formatDate(
                        place.ends_on
                      )}
                    </p>
                  </li>
                )
              )}
            </ol>
          ) : (
            <p className="sh-hint">
              Belum ada keanggotaan kelas
              yang tercatat.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
