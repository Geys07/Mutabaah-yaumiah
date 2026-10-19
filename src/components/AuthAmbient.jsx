
import TimeVideoBackground from "./TimeVideoBackground";
import "./AuthAmbient.css";

export default function AuthAmbient() {
  return (
    <div
      className="mut-auth-ambient"
      aria-hidden="true"
    >
      <TimeVideoBackground className="mut-login-background" />
    </div>
  );
}
