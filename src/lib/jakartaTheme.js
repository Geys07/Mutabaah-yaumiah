
export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getJakartaClock(now = new Date()) {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function getTimeTheme(hour) {
  if (hour >= 4 && hour < 11) {
    return {
      key: "pagi",
      greeting: "Selamat pagi",
    };
  }

  if (hour >= 11 && hour < 15) {
    return {
      key: "siang",
      greeting: "Selamat siang",
    };
  }

  if (hour >= 15 && hour < 18) {
    return {
      key: "sore",
      greeting: "Selamat sore",
    };
  }

  return {
    key: "malam",
    greeting: "Selamat malam",
  };
}
