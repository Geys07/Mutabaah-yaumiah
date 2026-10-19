
import { useEffect, useState } from "react";
import { getJakartaClock } from "../lib/jakartaTheme";

export default function useJakartaClock() {
  const [clock, setClock] = useState(getJakartaClock);

  useEffect(() => {
    function refresh() {
      const next = getJakartaClock();

      setClock((previous) =>
        previous.date === next.date &&
        previous.hour === next.hour &&
        previous.minute === next.minute
          ? previous
          : next
      );
    }

    const timer = window.setInterval(
      refresh,
      15000
    );

    function onVisibility() {
      if (!document.hidden) {
        refresh();
      }
    }

    window.addEventListener("focus", refresh);

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    refresh();

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        refresh
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, []);

  return clock;
}
