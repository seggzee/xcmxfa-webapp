
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/authStore";
import { CrewProvider } from "./app/crewStore";
import { PendingOnboardingGate, UseOnboardingBackOverride } from "./app/guards";
import AppRoutes from "./app/routes";

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

          {/* Render route table */}
          <AppRoutes />
        </BrowserRouter>
      </CrewProvider>
    </AuthProvider>
  );
}
