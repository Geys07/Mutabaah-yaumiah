
import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { searchFilter, PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StudentFamily from "./StudentFamily";
import ActivationBatch from "./ActivationBatch";
import "./Parents.css";

const RELATIONSHIPS = {
  father: "Ayah",
  mother: "Ibu",
  guardian: "Wali",
};

const STATUS = {
  none: "Belum Dibuat",
  active: "Kode Aktif",
  used: "Sudah Dipakai",
  expired: "Kedaluwarsa",
  changed: "Kontak Berubah",
};

export default function Parents() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");


  const [selectedStudent, setSelectedStudent] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback((signal) => {
    let query = supabase.rpc("list_parent_contacts", {}, { count: "exact" });
    if (status !== "all") query = query.eq("account_linked", status === "linked");
    if (search.trim()) query = query.or(searchFilter(["student_name", "class_name", "contact_name", "phone", "nis"], search));
    return query.order("student_name").order("student_id").order("relationship")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
  }, [search, status, page]);
  const { data: filtered, total, loading, error } = usePagedQuery(load, page, setPage, 200, 0, refresh);

  function openStudent(item) {
    setSelectedStudent({
      id: item.student_id,
      full_name: item.student_name,
    });
  }

  function closeStudent() {
    setSelectedStudent(null);
    setRefresh((previous) => previous + 1);
  }

  return (
    <section className="parents-panel">
      <header className="parents-heading">
        <h2>Orang Tua / Wali</h2>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
                    setRefresh((previous) => previous + 1);
          }}
        >
          Muat Ulang
        </button>
      </header>

      <ActivationBatch />

      <div className="parents-filters">
        <label>
          <span>Cari</span>

          <input
            type="search"
            value={search}
            placeholder="Siswa, orang tua, kelas, nomor HP"
            onChange={(event) =>
              { setPage(0); setSearch(event.target.value); }
            }
          />
        </label>

        <label>
          <span>Status Akun</span>

          <select
            value={status}
            onChange={(event) =>
              { setPage(0); setStatus(event.target.value); }
            }
          >
            <option value="all">Semua</option>
            <option value="linked">Terhubung</option>
            <option value="unlinked">
              Belum Terhubung
            </option>
          </select>
        </label>
      </div>

      {error && (
        <p className="parents-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="parents-empty">
          Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState kind="people" illustration="parent" title="Tidak ada data orang tua" description="Data orang tua atau wali akan ditampilkan di sini ketika tersedia." />
      ) : (
        <div className="parents-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Kelas</th>
                <th>Hubungan</th>
                <th>Nama Orang Tua</th>
                <th>Nomor HP</th>
                <th>Akun</th>
                <th>Kode Aktivasi</th>
                <th>Tindakan</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr
                  key={`${item.student_id}-${item.relationship}`}
                >
                  <td className="parents-student-name">
                    {item.student_name}
                  </td>

                  <td>
                    {item.class_name || "—"}
                  </td>

                  <td>
                    {RELATIONSHIPS[item.relationship] ||
                      item.relationship}
                  </td>

                  <td>
                    {item.contact_name}
                  </td>

                  <td>
                    {item.phone || "—"}
                  </td>

                  <td>
                    {item.account_linked
                      ? "Terhubung"
                      : "Belum Terhubung"}
                  </td>

                  <td>
                    {item.account_linked ? (
                      "—"
                    ) : item.activation_status === "active" &&
                      item.activation_code ? (
                      <span className="parents-code">
                        {item.activation_code}
                      </span>
                    ) : (
                      STATUS[item.activation_status] || "—"
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="parents-edit"
                      onClick={() => openStudent(item)}
                    >
                      Kelola
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} loading={loading} onChange={setPage} />

      {selectedStudent && (
        <StudentFamily
          student={selectedStudent}
          onClose={closeStudent}
        />
      )}
    </section>
  );
}
