// src/pages/StandbyRoomSubmit.tsx
//
// PURPOSE
// - Public standby room advert submission form
//
// IMPORTANT
// - Submissions are sent to backend review intake
// - This page does NOT publish adverts directly
// - Backend remains source of truth for validation and storage
//
// THIS VERSION
// - On successful submission, redirects back to /standby-rooms
// - Main standby rooms page then shows the confirmation message

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";

import "../styles/standbyRooms.css";

const SUBMIT_ROOM_ADVERT_URL =
  "https://apps-backend.xcmxfa.com/api/standby-rooms/submit_room_advert.php";

type SubmitStatus = "idle" | "submitting" | "error";

type FormState = {
  title: string;
  area_label: string;
  distance_km: string;
  description_short: string;
  price_currency: string;
  price_amount: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  website_label: string;
  booking_url: string;
  consent: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  area_label: "",
  distance_km: "",
  description_short: "",
  price_currency: "EUR",
  price_amount: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  website_label: "",
  booking_url: "",
  consent: false,
};

export default function StandbyRoomSubmit() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

  const isSubmitting = status === "submitting";

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function validateClientSide(): string {
    if (!form.title.trim()) return "Please enter an advert title.";
    if (!form.area_label.trim()) return "Please enter the area or location.";
    if (!form.distance_km.trim()) return "Please enter the approximate distance in km.";
    if (!form.description_short.trim()) return "Please enter a short description.";
    if (!form.price_amount.trim()) return "Please enter the price per night.";
    if (!form.contact_name.trim()) return "Please enter a contact name.";

    if (!form.contact_phone.trim() && !form.contact_email.trim()) {
      return "Please enter a valid contact email or phone number.";
    }

    if (!form.consent) {
      return "Please confirm that you have permission to submit this advert.";
    }

    return "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const clientError = validateClientSide();
    if (clientError) {
      setStatus("error");
      setMessage(clientError);
      return;
    }

    setStatus("submitting");
    setMessage("");

    const body = new FormData();

    body.append("title", form.title);
    body.append("area_label", form.area_label);
    body.append("distance_km", form.distance_km);
    body.append("description_short", form.description_short);

    body.append("price_currency", form.price_currency);
    body.append("price_amount", form.price_amount);

    body.append("contact_name", form.contact_name);
    body.append("contact_phone", form.contact_phone);
    body.append("contact_email", form.contact_email);

    body.append("website_label", form.website_label);
    body.append("booking_url", form.booking_url);

    body.append("consent", form.consent ? "1" : "0");

    if (image1) body.append("image_1", image1);
    if (image2) body.append("image_2", image2);

    try {
      const resp = await fetch(SUBMIT_ROOM_ADVERT_URL, {
        method: "POST",
        body,
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        throw new Error(data?.message || "Could not submit room advert.");
      }

      navigate("/standby-rooms", {
        replace: true,
        state: {
          standbyRoomSubmitSuccess: true,
        },
      });
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Could not submit room advert.");
    }
  }

  return (
    <div className="standbyRoomSubmit-page">
      <StickyPageHeaderCard
        leftContent={
          <img
            src={UI_ICONS.standby_room}
            alt="Submit room advert"
            style={{
              width: 62,
              height: 62,
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
        }
        title="Submit room advert"
        subtitle="Reviewed before publication"
        onBack={() => navigate(-1)}
        backAriaLabel="Back"
      />

      <div className="standbyRoomSubmit-scroll app-container">
        <div className="standbyRoomSubmit-introCard">
          <div className="standbyRoomSubmit-introTitle">
            Submit your room advert for review
          </div>
          <div className="standbyRoomSubmit-introBody">
            Your advert will not appear immediately. It will be checked before being published in the rooms list.
          </div>
        </div>

        <form className="standbyRoomSubmit-formCard" onSubmit={handleSubmit} noValidate>
          <div className="standbyRoomSubmit-sectionTitle">Room details</div>

          <label className="standbyRoomSubmit-field">
            <span>Advert title</span>
            <input
              type="text"
              value={form.title}
              maxLength={255}
              disabled={isSubmitting}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Room near Schiphol"
            />
          </label>

          <label className="standbyRoomSubmit-field">
            <span>Area / location</span>
            <input
              type="text"
              value={form.area_label}
              maxLength={255}
              disabled={isSubmitting}
              onChange={(e) => updateField("area_label", e.target.value)}
              placeholder="Hoofddorp, 8 km from Schiphol"
            />
          </label>

          <label className="standbyRoomSubmit-field">
            <span>Approx distance from Schiphol in km</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={form.distance_km}
              disabled={isSubmitting}
              onChange={(e) => updateField("distance_km", e.target.value)}
              placeholder="8"
            />
          </label>

          <label className="standbyRoomSubmit-field">
            <span>Short description</span>
            <textarea
              value={form.description_short}
              maxLength={500}
              disabled={isSubmitting}
              onChange={(e) => updateField("description_short", e.target.value)}
              placeholder="Short description of the room, access, transport, facilities, and availability."
              rows={5}
            />
          </label>

          <div className="standbyRoomSubmit-sectionTitle">Price</div>

          <div className="standbyRoomSubmit-grid2">
            <label className="standbyRoomSubmit-field">
              <span>Currency</span>
              <input
                type="text"
                value={form.price_currency}
                maxLength={3}
                disabled={isSubmitting}
                onChange={(e) => updateField("price_currency", e.target.value.toUpperCase())}
              />
            </label>

            <label className="standbyRoomSubmit-field">
              <span>Price per night</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.price_amount}
                disabled={isSubmitting}
                onChange={(e) => updateField("price_amount", e.target.value)}
                placeholder="75"
              />
            </label>
          </div>

          <div className="standbyRoomSubmit-sectionTitle">Contact</div>

          <label className="standbyRoomSubmit-field">
            <span>Contact name</span>
            <input
              type="text"
              value={form.contact_name}
              maxLength={120}
              disabled={isSubmitting}
              onChange={(e) => updateField("contact_name", e.target.value)}
              placeholder="Name"
            />
          </label>

          <div className="standbyRoomSubmit-grid2">
            <label className="standbyRoomSubmit-field">
              <span>Contact phone</span>
              <input
                type="tel"
                value={form.contact_phone}
                maxLength={80}
                disabled={isSubmitting}
                onChange={(e) => updateField("contact_phone", e.target.value)}
                placeholder="+31..."
              />
            </label>

            <label className="standbyRoomSubmit-field">
              <span>Contact email</span>
              <input
                type="email"
                value={form.contact_email}
                maxLength={255}
                disabled={isSubmitting}
                onChange={(e) => updateField("contact_email", e.target.value)}
                placeholder="name@example.com"
              />
            </label>
          </div>

          <div className="standbyRoomSubmit-helpText">
            Please provide at least one contact method.
          </div>

          <div className="standbyRoomSubmit-sectionTitle">Website / booking link</div>

          <div className="standbyRoomSubmit-grid2">
            <label className="standbyRoomSubmit-field">
              <span>Website label</span>
              <input
                type="text"
                value={form.website_label}
                maxLength={100}
                disabled={isSubmitting}
                onChange={(e) => updateField("website_label", e.target.value)}
                placeholder="Website"
              />
            </label>

            <label className="standbyRoomSubmit-field">
              <span>Booking / website URL</span>
              <input
                type="url"
                value={form.booking_url}
                maxLength={500}
                disabled={isSubmitting}
                onChange={(e) => updateField("booking_url", e.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="standbyRoomSubmit-sectionTitle">Photos</div>

          <div className="standbyRoomSubmit-grid2">
            <label className="standbyRoomSubmit-field">
              <span>Image 1</span>
              <input
                id="room-image-1"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isSubmitting}
                onChange={(e) => setImage1(e.target.files?.[0] || null)}
              />
            </label>

            <label className="standbyRoomSubmit-field">
              <span>Image 2</span>
              <input
                id="room-image-2"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isSubmitting}
                onChange={(e) => setImage2(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="standbyRoomSubmit-helpText">
            JPG, PNG, or WEBP only. Maximum 5 MB per image.
          </div>

          <label className="standbyRoomSubmit-consent">
            <input
              type="checkbox"
              checked={form.consent}
              disabled={isSubmitting}
              onChange={(e) => updateField("consent", e.target.checked)}
            />
            <span>
              I confirm that I have permission to submit this advert and understand it will be reviewed before publication.
            </span>
          </label>

          {message ? (
            <div className="standbyRoomSubmit-message standbyRoomSubmit-message--error">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            className="standbyRoomSubmit-submitBtn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit advert"}
          </button>
        </form>
      </div>
    </div>
  );
}