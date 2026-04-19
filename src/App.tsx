import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/authStore";
import { CrewProvider } from "./app/crewStore";
import { PendingOnboardingGate, UseOnboardingBackOverride } from "./app/guards";
import AppRoutes from "./app/routes";
import PopupNoticeHost from "./components/PopupNoticeHost";
import OfflineBanner from "./components/OfflineBanner";

/**
 * Idiot-guide:
 * This is the web equivalent of RN AppRoot.
 *
 * AppRoot responsibilities:
 * - keep auth state
 * - keep crew cache
 * - enforce onboarding resume
 * - enforce onboarding back routing rules
 * - render exactly one screen at a time (web does this via routes)
 *
 * Phase 0 offline shell support:
 * - app shell can boot offline via PWA
 * - global offline banner lives here at app-shell level
 * - no offline data persistence is implemented here
 */
export default function App() {
  return (
    <AuthProvider>
      <CrewProvider>
        <BrowserRouter>
          {/* Auto-resume onboarding if pendingUsername exists */}
          <PendingOnboardingGate />

          {/* Override browser back during locked onboarding */}
          <UseOnboardingBackOverride />

          {/* Global app-shell offline banner */}
          <OfflineBanner />

          {/* Global messaging popup host */}
          <PopupNoticeHost />

          {/* Render route table */}
          <AppRoutes />
        </BrowserRouter>
      </CrewProvider>
    </AuthProvider>
  );
}