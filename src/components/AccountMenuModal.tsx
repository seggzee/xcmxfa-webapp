// src/components/AccountMenuModal.tsx

import { UI_ICONS } from "../assets";

type Props = {
  open: boolean;
  onClose: () => void;

  onProfile(): void;
  onLegal(): void;
  onContact(): void;
  onLogout(): void;
};

export default function AccountMenuModal({
  open,
  onClose,
  onProfile,
  onLegal,
  onContact,
  onLogout,
}: Props) {
  if (!open) return null;

  const handleProfile = () => {
    onClose();
    onProfile();
  };

  const handleLegal = () => {
    onClose();
    onLegal();
  };

  const handleContact = () => {
    onClose();
    onContact();
  };

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account menu"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.35)",
        padding: 16,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 9999,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 48,
          background: "#fff",
          borderRadius: 18,
          padding: 20,
          border: "1px solid #e6e9ee",
          boxShadow: "0 10px 30px rgba(17,24,39,0.10)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="appHeader-sheetMediaBtn"
          onClick={handleProfile}
        >
          <span className="appHeader-sheetMedia appHeader-sheetMedia--profile">
            <img src={UI_ICONS.avatar} alt="" className="appHeader-sheetMediaImg" />
          </span>
          <span className="appHeader-sheetText">
            <span className="appHeader-sheetBtnTitle">My profile</span>
            <span className="appHeader-sheetBtnSub">Personal details</span>
          </span>
        </button>

        <button
          type="button"
          className="appHeader-sheetMediaBtn"
          onClick={handleLegal}
        >
          <span className="appHeader-sheetMedia">
            <img src={UI_ICONS.legal} alt="" className="appHeader-sheetMediaImg" />
          </span>
          <span className="appHeader-sheetText">
            <span className="appHeader-sheetBtnTitle">Legal stuff</span>
            <span className="appHeader-sheetBtnSub">
              Privacy policy, disclaimers and terms
            </span>
          </span>
        </button>

        <button
          type="button"
          className="appHeader-sheetMediaBtn"
          onClick={handleContact}
        >
          <span className="appHeader-sheetMedia">
            <img src={UI_ICONS.contact_us} alt="" className="appHeader-sheetMediaImg" />
          </span>
          <span className="appHeader-sheetText">
            <span className="appHeader-sheetBtnTitle">Contact us</span>
            <span className="appHeader-sheetBtnSub">
              Form, email and support details
            </span>
          </span>
        </button>

        <button
          type="button"
          className="appHeader-sheetMediaBtn appHeader-sheetMediaBtn--danger"
          onClick={handleLogout}
        >
          <span className="appHeader-sheetMedia appHeader-sheetMedia--danger">
            <img src={UI_ICONS.logout} alt="" className="appHeader-sheetMediaImg" />
          </span>
          <span className="appHeader-sheetText">
            <span className="appHeader-sheetBtnTitle">Log out</span>
            <span className="appHeader-sheetBtnSub">Switch to guest mode</span>
          </span>
        </button>

        <button
          type="button"
          className="appHeader-sheetCancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}