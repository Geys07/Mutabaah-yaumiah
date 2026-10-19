const base = import.meta.env.BASE_URL || "/";
const publicRoot = base.endsWith("/") ? base : `${base}/`;
export const SCHOOL_LOGO_URL = `${publicRoot}logo-sekolah-loading.png`;

// Logo di Identitas Sekolah berupa URL publik yang diberikan oleh Storage.
// Aset lokal selalu menjadi cadangan ketika belum diisi Admin.
export function getSchoolLogoUrl(identity) {
  const value = String(identity?.logo_path || "").trim();
  if (!value) return SCHOOL_LOGO_URL;
  try {
    const url = new URL(value, window.location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) return SCHOOL_LOGO_URL;
    if (url.protocol === 'http:' && window.location.protocol === 'https:') return SCHOOL_LOGO_URL;
    return url.href;
  } catch {
    return SCHOOL_LOGO_URL;
  }
}
