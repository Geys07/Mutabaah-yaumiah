import { supabase } from "./supabase";

// Private session memory only; never put answers or credentials in public caches.
const pending = new Map();
const drafts = new Map();
const listeners = new Set();
let generation = 0;
let owner = null;
function changeOwner(next, force = false) {
  const changed = force || (owner !== null && owner !== next);
  owner = next;
  if (changed) {
    generation++;
    drafts.clear();
    pending.clear();
    listeners.forEach(listener => listener());
  }
}
supabase.auth.onAuthStateChange((event, session) => {
  changeOwner(session?.user?.id || null, event === "SIGNED_OUT");
});
function sessionError() { return new Error("Sesi akun sudah berubah. Buka kembali pengisian."); }
export function isParentDayOwnerCurrent(binding) {
  return Boolean(binding && binding.id === owner && binding.generation === generation);
}
export function subscribeParentDaySession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
async function accountId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Sesi akun belum dapat diperiksa.");
  const id = data?.session?.user?.id;
  if (!id) {
    if (owner !== null) changeOwner(null, true);
    throw sessionError();
  }
  changeOwner(id);
  return id;
}
export async function captureParentDayOwner() {
  const epoch = generation;
  const id = await accountId();
  if (epoch !== generation) throw sessionError();
  return Object.freeze({ id, generation });
}
async function checkOwner(binding) {
  if (!isParentDayOwnerCurrent(binding)) throw sessionError();
  const id = await accountId();
  if (!isParentDayOwnerCurrent(binding) || id !== binding.id) throw sessionError();
}
function scope(binding, studentId, date) { return binding.id + ":" + studentId + ":" + date; }

export function enqueueParentDaySave(payload, binding) {
  if (!isParentDayOwnerCurrent(binding)) return Promise.reject(sessionError());
  const snapshot = structuredClone(payload);
  const key = scope(binding, snapshot.p_student_id, snapshot.p_date);
  const record = { payload: snapshot };
  // Retain a failed draft even when a cached-session read temporarily fails.
  drafts.set(key, record);
  const previous = pending.get(key) || Promise.resolve();
  // Register synchronously: asynchronous session reads must not reorder writes.
  const task = previous.catch(() => {}).then(async () => {
    await checkOwner(binding);
    const { data, error } = await supabase.rpc("submit_parent_mutabaah_day", snapshot);
    if (error) throw error;
    if (data?.success !== true) throw new Error("Penyimpanan belum berhasil.");
    if (isParentDayOwnerCurrent(binding) && drafts.get(key) === record) drafts.delete(key);
    return data;
  });
  pending.set(key, task);
  const clear = () => { if (pending.get(key) === task) pending.delete(key); };
  void task.then(clear, clear);
  return task;
}
export async function waitForParentDaySave(studentId, date, binding) {
  await checkOwner(binding);
  const task = pending.get(scope(binding, studentId, date));
  if (task) await task.catch(() => {});
  await checkOwner(binding);
}
export async function readUnsavedParentDay(studentId, date, binding) {
  await checkOwner(binding);
  const record = drafts.get(scope(binding, studentId, date));
  return record ? structuredClone(record.payload) : null;
}
