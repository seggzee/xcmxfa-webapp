// src/components/BackButton.tsx
import React from "react";
import { UI_ICONS } from "../assets";

type Props = {
  onClick: () => void;
  size?: number; // px (default 38)
  className?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
};

export default function BackButton({
  onClick,
  size = 38,
  className = "",
  ariaLabel = "Back",
  title = "Back",
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      className={`backBtn ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      style={{ width: size, height: size }}
    >
      <img
        src={UI_ICONS.BACK}
        alt=""
        className="backBtn-img"
        style={{ width: size, height: size }}
      />
    </button>
  );
}
