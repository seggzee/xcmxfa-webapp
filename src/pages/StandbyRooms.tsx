// src/pages/StandbyRooms.tsx
//
// PURPOSE
// - Standby rooms page for short crew-stay private room adverts near Schiphol
//
// THIS CHANGE ONLY
// - Keep StickyPageHeaderCard pattern
// - Keep sticky submission card under the page header
// - Remove old per-card onPress/detail-page flow
// - Feed the already-amended StandbyRoomCard component with booking_url + website_label
// - Keep simple mock data for now until backend exists
//
// NOTES
// - StandbyRoomCard is assumed to already use this contract:
//   {
//     room_id,
//     title,
//     area_label,
//     primary_image_url,
//     description_short,
//     contact_name,
//     contact_phone?,
//     contact_email?,
//     website_label?,
//     booking_url,
//     price_per_night: { currency, amount }
//   }
// - The icon key below uses UI_ICONS.standby_room because that is what the current file uses.
//   If your assets file uses a different key, swap that one line only.

import React from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import StandbyRoomCard from "../components/StandbyRoomCard";
import type { StandbyRoomCardData } from "../components/StandbyRoomCard";

import "../styles/standbyRooms.css";

const MOCK_ROOMS: StandbyRoomCardData[] = [
  {
    room_id: 1,
    title: "Private room near Schiphol",
    area_label: "Hoofddorp · 12 mins from AMS",
    primary_image_url:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    description_short:
      "Furnished private room with Wi-Fi, shared kitchen, quiet residential area, suitable for short crew stays.",
    contact_name: "Maria",
    contact_phone: "+31 6 1234 5678",
    contact_email: "maria@example.com",
    website_label: "Advert website",
    booking_url: "https://example.com/room-maria",
    price_per_night: {
      currency: "EUR",
      amount: "65",
    },
  },
  {
    room_id: 2,
    title: "Crew room with own bathroom",
    area_label: "Aalsmeer · 15 mins from AMS",
    primary_image_url:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    description_short:
      "Single occupancy room with private bathroom, desk, and parking. Ideal for overnight airport standby.",
    contact_name: "Jeroen",
    contact_phone: "+31 6 9876 5432",
    contact_email: "jeroen@example.com",
    website_label: "Advert website",
    booking_url: "https://example.com/room-jeroen",
    price_per_night: {
      currency: "EUR",
      amount: "72",
    },
  },
  {
    room_id: 3,
    title: "Short-stay room close to bus link",
    area_label: "Badhoevedorp · 10 mins from AMS",
    primary_image_url:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    description_short:
      "Compact clean room with fast bus access to Schiphol, flexible late arrival, and shared lounge access.",
    contact_name: "Aisha",
    contact_phone: "+31 6 2468 1357",
    contact_email: "aisha@example.com",
    website_label: "Advert website",
    booking_url: "https://example.com/room-aisha",
    price_per_night: {
      currency: "EUR",
      amount: "59",
    },
  },
];

export default function StandbyRooms() {
  const navigate = useNavigate();

  function handlePostAdvert() {
    navigate("/standby-rooms/submit");
  }

  return (
    <div className="standbyRooms-page">
      <StickyPageHeaderCard
        leftContent={
          <img
            src={UI_ICONS.standby_room}
            alt="Standby rooms"
            style={{
              width: 62,
              height: 62,
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
        }
        title="Rooms"
        subtitle="Private rooms offered for standby / short crew stays"
        onBack={() => navigate(-1)}
        backAriaLabel="Back"
      />

      <div className="standbyRooms-scroll app-container">
        <div className="standbyRoomsStickyPromo">
          <div className="standbyRoomsSubmissionCard">
            <div className="standbyRoomsSubmissionText">
              <div className="standbyRoomsSubmissionTitle">
                Have a room to rent, or know someone who does?
              </div>
              <div className="standbyRoomsSubmissionBody">
                Owners can post room adverts here
              </div>
            </div>

            <button
              type="button"
              className="standbyRoomsSubmissionCta"
              onClick={handlePostAdvert}
            >
              Post advert
            </button>
          </div>
        </div>

        <div className="standbyRoomsList">
          {MOCK_ROOMS.map((room) => (
            <StandbyRoomCard key={room.room_id} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}