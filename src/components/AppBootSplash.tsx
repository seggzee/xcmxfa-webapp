import { UI_ICONS } from "../assets";
import "../styles/appBootSplash.css";

export default function AppBootSplash() {
  return (
    <div className="appBootSplash">
      <div className="appBootSplash-inner">
        <div className="appBootSplash-brand">XCM/XFA</div>

        <div className="appBootSplash-planeTrack" aria-hidden="true">
          <img
            src={UI_ICONS.flight_blue}
            alt=""
            className="appBootSplash-plane"
          />
        </div>

        <div className="appBootSplash-text">Loading…</div>
      </div>
    </div>
  );
}

