
import { useEffect, useRef, useState } from "react";
import "./TimeVideoBackground.css";

const MOBILE_QUERY = "(max-width: 740px)";
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const THEMES = new Set(["pagi", "siang", "sore", "malam"]);

function readTheme() {
  const theme = document.documentElement.dataset.timeTheme;
  return THEMES.has(theme) ? theme : "pagi";
}

export default function TimeVideoBackground({ className = "" }) {
  const videoRef = useRef(null);
  const [theme, setTheme] = useState(readTheme);

  const [mobile, setMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches
  );

  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia(REDUCE_MOTION_QUERY).matches
  );

  const [saveData] = useState(
    () => navigator.connection?.saveData === true
  );

  const [failedSource, setFailedSource] = useState("");
  const [playingSource, setPlayingSource] = useState("");

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(readTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-time-theme"],
    });

    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    const motionQuery = window.matchMedia(REDUCE_MOTION_QUERY);

    const onMobile = (event) => setMobile(event.matches);
    const onMotion = (event) => setReduceMotion(event.matches);

    mobileQuery.addEventListener("change", onMobile);
    motionQuery.addEventListener("change", onMotion);

    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener("change", onMobile);
      motionQuery.removeEventListener("change", onMotion);
    };
  }, []);

  const fileName = `${theme}-${mobile ? "mobile" : "desktop"}`;
  const base = `${import.meta.env.BASE_URL || "/"}ambient/videos/`;

  const poster = `${base}${fileName}.webp`;
  const source = `${base}${fileName}.mp4`;

  const shouldPlay =
    !reduceMotion &&
    !saveData &&
    failedSource !== source;

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !shouldPlay) {
      return undefined;
    }

    let active = true;

    function resumeOrPause() {
      if (document.hidden) {
        video.pause();
      } else {
        const promise = video.play();

        if (promise?.catch) {
          promise.catch(() => {
            if (active) {
              setFailedSource(source);
            }
          });
        }
      }
    }

    document.addEventListener(
      "visibilitychange",
      resumeOrPause
    );

    resumeOrPause();

    return () => {
      active = false;

      document.removeEventListener(
        "visibilitychange",
        resumeOrPause
      );

      video.pause();
    };
  }, [source, shouldPlay]);

  return (
    <div
      className={`${className} mut-time-video`}
      aria-hidden="true"
    >
      <img
        className="mut-time-video-poster"
        src={poster}
        alt=""
        draggable="false"
      />

      {shouldPlay && (
        <video
          key={source}
          ref={videoRef}
          className={`mut-time-video-element${
            playingSource === source ? " is-playing" : ""
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          disablePictureInPicture
          onPlaying={() => setPlayingSource(source)}
          onError={() => setFailedSource(source)}
        >
          <source src={source} type="video/mp4" />
        </video>
      )}

      <div className="mut-time-video-soften" />
    </div>
  );
}
