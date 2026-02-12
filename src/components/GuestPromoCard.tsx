import { useEffect, useState } from "react";

type GuestPromo = {
  title: string;
  body: string;
  link: string;
  label?: string;
  logo_url?: string;
  logo_text?: string;
};

type GuestPromoApiResponse = {
  ok?: boolean;
  enabled?: boolean;
  promos?: unknown;
};

export interface GuestPromoCardProps {
  apiBaseUrl: string;
  rotationMs?: number; // default 10000
  logoSize?: number; // default 22
}

export default function GuestPromoCard({
  apiBaseUrl,
  rotationMs = 10000,
  logoSize = 22,
}: GuestPromoCardProps) {
  const [enabled, setEnabled] = useState(false);
  const [promos, setPromos] = useState<GuestPromo[]>([]);
  const [index, setIndex] = useState(0);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/guest_promos.php`)
      .then((r) => r.json())
      .then((data: GuestPromoApiResponse) => {
        if (data?.ok && data.enabled && Array.isArray(data.promos)) {
          const clean = (data.promos as unknown[]).filter((p): p is GuestPromo => {
            const x = p as Partial<GuestPromo> | null;
            return !!(x && x.title && x.body && x.link);
          });

          setEnabled(true);
          setPromos(clean);
          setIndex(0);
        }
      })
      .catch(() => {
        // Silent fail — promo must NEVER break HomeScreen
      });
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!enabled || promos.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % promos.length);
    }, rotationMs);

    return () => window.clearInterval(timer);
  }, [enabled, promos, rotationMs]);

  if (!enabled || promos.length === 0) return null;

  const promo = promos[index] ?? promos[0];

  const logoUrl = typeof promo.logo_url === "string" ? promo.logo_url : "";
  const logoText = typeof promo.logo_text === "string" ? promo.logo_text : "";
  const logoFallbackText = (logoText || "AD").toUpperCase();

  const onPress = () => {
    window.open(promo.link, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: "#d9e2ee",
        borderRadius: 16,
        padding: 14,
		marginTop: 14,
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        opacity: pressed ? 0.92 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: "rgba(19,35,51,0.45)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {promo.label || "PARTNER"}
        </div>

        <div
          style={{
            height: logoSize,
            minWidth: logoSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{
                height: logoSize,
                width: logoSize * 2.2,
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                height: logoSize,
                minWidth: logoSize * 1.6,
                paddingLeft: 8,
                paddingRight: 8,
                borderRadius: 999,
                borderWidth: 2,
                borderStyle: "solid",
                borderColor: "rgba(19,35,51,0.12)",
                backgroundColor: "rgba(19,35,51,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: "rgba(19,35,51,0.65)",
                  letterSpacing: 0.6,
                }}
              >
                {logoFallbackText}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: "#132333",
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {promo.title}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "rgba(19,35,51,0.65)",
          lineHeight: "16px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {promo.body}
      </div>
    </button>
  );
}
