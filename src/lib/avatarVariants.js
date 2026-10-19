
/**
 * Pemilihan avatar Mutabaah Yaumiah.
 * 10 model siswa dan 10 model siswi.
 *
 * Pilihan stabil berdasarkan ID siswa.
 * Tidak menggunakan Math.random().
 */

export const AVATAR_VARIANT_COUNT = 10;

export function isFemaleGender(gender) {
  return [
    "female",
    "perempuan",
    "p",
  ].includes(
    String(gender || "")
      .trim()
      .toLowerCase()
  );
}

function normalizeIndex(value) {
  return (
    (
      value % AVATAR_VARIANT_COUNT
    ) + AVATAR_VARIANT_COUNT
  ) % AVATAR_VARIANT_COUNT;
}

export function avatarVariantForId(studentId) {
  const value = String(
    studentId || "siswa-tanpa-id"
  );

  let hash = 2166136261;

  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(
      hash,
      16777619
    );
  }

  return (
    hash >>> 0
  ) % AVATAR_VARIANT_COUNT;
}

/**
 * Menghindari avatar kembar untuk
 * anak dengan jenis kelamin sama
 * dalam satu akun orang tua.
 *
 * Urutan ditetapkan berdasarkan ID
 * agar stabil saat login ulang.
 */
export function createAvatarVariants(
  children = []
) {
  const result = new Map();

  const used = {
    siswa: new Set(),
    siswi: new Set(),
  };

  const sorted = [...children]
    .filter(
      (child) => child?.id
    )
    .sort(
      (a, b) =>
        String(a.id).localeCompare(
          String(b.id)
        )
    );

  for (const child of sorted) {
    const sex = isFemaleGender(
      child.gender
    )
      ? "siswi"
      : "siswa";

    const start = avatarVariantForId(
      child.id
    );

    let chosen = start;

    for (
      let offset = 0;
      offset < AVATAR_VARIANT_COUNT;
      offset += 1
    ) {
      const candidate = normalizeIndex(
        start + offset
      );

      if (!used[sex].has(candidate)) {
        chosen = candidate;
        break;
      }
    }

    used[sex].add(chosen);

    result.set(
      child.id,
      chosen
    );
  }

  return result;
}
