import { UI_ICONS } from "../assets";

export interface SecureLockedCardProps {
  title: string;
  description: string;
  onUnlock: () => void;
}

const styles = {
  h1: { fontSize: 20, fontWeight: "900", color: "#111827" },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "red",
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 34,
    paddingBottom: 34,
    alignItems: "center",
    marginTop: 50,
  },

  stopSign: {
    width: 80,
    height: 80,
    marginBottom: 30,
    objectFit: "contain" as const, // RN resizeMode="contain"
  },
} as const;

export default function SecureLockedCard({
  title,
  description,
  onUnlock,
}: SecureLockedCardProps) {
  return (
    <div style={styles.card}>
      <img src={UI_ICONS.STOP_SIGN} style={styles.stopSign} alt="" />

      <div style={{ fontWeight: 600, fontSize: 20 }}>{title}</div>

      <div style={{ marginTop: 18, marginBottom: 18 }}>{description}</div>

      <button
        type="button"
        onClick={onUnlock}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 18, color: "#007AFF", fontWeight: 600 }}>
          Unlock to continue
        </span>
      </button>
    </div>
  );
}
