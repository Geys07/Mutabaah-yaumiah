import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./ViewportPopover.css";

/**
 * Popup yang dipasang langsung pada <body>, bukan di dalam header/card.
 * Menjaga menu tetap terlihat saat header menggunakan backdrop-filter,
 * container mempunyai overflow, atau layar HP sempit.
 */
export default function ViewportPopover({
  anchorRef,
  className = "",
  label,
  onClose,
  children,
  theme = "",
}) {
  const popupRef = useRef(null);

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef?.current;
      const popup = popupRef.current;
      if (!anchor || !popup) return;

      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft || 0;
      const topEdge = viewport?.offsetTop || 0;
      const availableWidth = viewport?.width || window.innerWidth;
      const availableHeight = viewport?.height || window.innerHeight;
      const inset = 12;
      const width = Math.min(340, Math.max(240, availableWidth - 2 * inset));
      const left = Math.max(
        leftEdge + inset,
        Math.min(rect.right - width, leftEdge + availableWidth - inset - width)
      );
      const bottomEdge = topEdge + availableHeight - inset;
      const belowTop = rect.bottom + 9;
      const aboveAvailable = Math.max(0, rect.top - topEdge - 2 * inset);
      const belowAvailable = Math.max(0, bottomEdge - belowTop);
      const maxHeight = Math.min(440, Math.max(140, availableHeight - 2 * inset));
      const placeAbove = belowAvailable < Math.min(popup.scrollHeight, maxHeight)
        && aboveAvailable > belowAvailable;
      const height = Math.min(maxHeight, placeAbove ? aboveAvailable : belowAvailable);
      const top = placeAbove
        ? Math.max(topEdge + inset, rect.top - 9 - Math.min(popup.scrollHeight, height))
        : Math.max(topEdge + inset, Math.min(belowTop, bottomEdge - height));

      popup.style.left = `${Math.round(left)}px`;
      popup.style.top = `${Math.round(top)}px`;
      popup.style.width = `${Math.round(width)}px`;
      popup.style.maxHeight = `${Math.round(Math.max(100, height))}px`;
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchorRef, children]);

  useEffect(() => {
    function outside(event) {
      if (popupRef.current?.contains(event.target)
        || anchorRef?.current?.contains(event.target)) return;
      onClose?.();
    }
    function escape(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anchorRef, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <section
      ref={popupRef}
      role="dialog"
      aria-label={label || "Menu pemberitahuan"}
      className={`viewport-popover ${className}`.trim()}
      data-theme={theme}
    >
      {children}
    </section>,
    document.body
  );
}
