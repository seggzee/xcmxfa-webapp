// src/components/StickyPageHeaderCard.tsx
//
// =====================================================================================
// STICKY PAGE HEADER CARD
// =====================================================================================
//
// PURPOSE
// - Reusable sticky page header for selected pages.
// - Keeps a back button visible while page content scrolls underneath.
// - Replaces page-specific copies of the same sticky header-card pattern.
//
// DESIGN RULES
// - Owns its own CSS via: src/styles/stickyPageHeaderCard.css
// - Does NOT depend on week.css
// - Uses global app primitives where appropriate (e.g. app-container)
// - Presentational only
// - No page data logic
// - No route logic beyond receiving an onBack handler from the caller
//
// SUPPORTED LAYOUTS
// - Standard title + subtitle
// - Custom centered content (e.g. Donate icon / logo)
// - Optional left content
// - Default back button on the right
// - Optional custom right content override
//
// NOTES
// - Subtitle renders on its own row below the top row.
// - If centerContent is provided, it takes priority over title.
// =====================================================================================

import React from "react";
import BackButton from "../components/BackButton";
import "../styles/stickyPageHeaderCard.css";

type StickyPageHeaderCardProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  centerContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  backAriaLabel?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function StickyPageHeaderCard({
  title,
  subtitle,
  centerContent,
  leftContent,
  rightContent,
  onBack,
  showBack = true,
  backAriaLabel = "Back",
  className,
}: StickyPageHeaderCardProps) {
  const resolvedRightContent =
    rightContent !== undefined ? (
      rightContent
    ) : showBack ? (
      <BackButton
        onClick={() => {
          if (typeof onBack === "function") onBack();
        }}
        ariaLabel={backAriaLabel}
        size={38}
      />
    ) : null;

  return (
    <div className={cx("stickyPageHeaderCard-sticky", className)}>
      <div className="app-container">
        <section className="stickyPageHeaderCard-card">
          <div className="stickyPageHeaderCard-topRow">
            <div className="stickyPageHeaderCard-left">{leftContent || null}</div>

            <div className="stickyPageHeaderCard-center">
              {centerContent ? (
                centerContent
              ) : title ? (
                <div className="stickyPageHeaderCard-title">{title}</div>
              ) : null}
            </div>

            <div className="stickyPageHeaderCard-right">{resolvedRightContent}</div>
          </div>

          {subtitle ? <div className="stickyPageHeaderCard-subtitle">{subtitle}</div> : null}
        </section>
      </div>
    </div>
  );
}