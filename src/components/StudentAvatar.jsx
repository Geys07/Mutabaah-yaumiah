
import {
  avatarVariantForId,
  AVATAR_VARIANT_COUNT,
  isFemaleGender,
} from "../lib/avatarVariants";

/**
 * Avatar 2D Mutabaah Yaumiah.
 * Menggunakan file WebP lokal.
 */
export default function StudentAvatar({
  student,
  variant,
  className = "",
}) {
  const genderPrefix = isFemaleGender(
    student?.gender
  )
    ? "siswi"
    : "siswa";

  const index = Number.isInteger(variant)
    ? (
        (
          variant % AVATAR_VARIANT_COUNT
        ) + AVATAR_VARIANT_COUNT
      ) % AVATAR_VARIANT_COUNT
    : avatarVariantForId(
        student?.id
      );

  const filename = `${
    genderPrefix
  }-${String(
    index + 1
  ).padStart(2, "0")}.webp`;

  const base =
    import.meta.env.BASE_URL || "/";

  const publicPath = base.endsWith("/")
    ? base
    : `${base}/`;

  return (
    <img
      className={
        `parent-student-avatar ${className}`
          .trim()
      }
      src={`${publicPath}avatars/${filename}`}
      alt={
        genderPrefix === "siswi"
          ? "Avatar siswi"
          : "Avatar siswa"
      }
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
