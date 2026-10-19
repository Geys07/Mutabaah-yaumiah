// Khusus ilustrasi loading & autentikasi, tidak memakai header panel.
const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
export const loadingScenes = Object.freeze({
  pagi: { desktop: `${base}loading/loading-pagi-desktop.webp`, mobile: `${base}loading/loading-pagi-mobile.webp` },
  siang: { desktop: `${base}loading/loading-siang-desktop.webp`, mobile: `${base}loading/loading-siang-mobile.webp` },
  sore: { desktop: `${base}loading/loading-sore-desktop.webp`, mobile: `${base}loading/loading-sore-mobile.webp` },
  malam: { desktop: `${base}loading/loading-malam-desktop.webp`, mobile: `${base}loading/loading-malam-mobile.webp` },
});
export function getLoadingScene(key) { return loadingScenes[key] || loadingScenes.pagi; }
