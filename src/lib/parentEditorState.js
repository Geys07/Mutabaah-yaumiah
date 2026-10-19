// UI state only: no account, student, answer, token, or persistent storage.
let open = false;
const listeners = new Set();
export function setParentEditorOpen(value) {
  if (open === value) return;
  open = value;
  listeners.forEach(listener => listener());
}
export function getParentEditorOpen() { return open; }
export function subscribeParentEditor(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
