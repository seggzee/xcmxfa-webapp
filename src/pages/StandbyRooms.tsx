// src/pages/StandbyRooms.tsx
//
// PURPOSE
// - Standby rooms page for short crew-stay private room adverts near Schiphol
//
// THIS VERSION
// - Uses live backend data
// - Uses backend sorting
// - Keeps StickyPageHeaderCard pattern
// - Keeps sticky submission card
// - Keeps StandbyRoomCard as already amended

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../app/authStore";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import StandbyRoomCard from "../components/StandbyRoomCard";
import type { StandbyRoomCardData } from "../components/StandbyRoomCard";

import {
  getStandbyRoomsList,
  type StandbyRoomSort,
} from "../api/standbyRoomsApi";

import "../styles/standbyRooms.css";

const SORT_OPTIONS: Array<{ value: StandbyRoomSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "distance_asc", label: "Distance" },
];



export default function StandbyRooms() {
  const navigate = useNavigate();

  const [sort, setSort] = useState<StandbyRoomSort>("recommended");
  const [rooms, setRooms] = useState<StandbyRoomCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  
	const { auth } = useAuth();
	const isMember = auth?.mode === "member";

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorText("");

      try {
        const resp = await getStandbyRoomsList(sort);
        if (!alive) return;

        setRooms(Array.isArray(resp.rooms) ? resp.rooms : []);
      } catch (e: any) {
        if (!alive) return;
        setRooms([]);
        setErrorText(e?.message || "Failed to load standby rooms");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [sort]);

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
        subtitle=" "
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

          <div
            className="standbyRoomsSortRow"
            role="group"
            aria-label="Sort standby rooms"
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  sort === option.value
                    ? "standbyRoomsSortChip standbyRoomsSortChip--active"
                    : "standbyRoomsSortChip"
                }
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="standbyRooms-inlineStatus">
            Loading rooms…
          </div>
        ) : errorText ? (
          <div className="standbyRooms-inlineStatus standbyRooms-inlineStatus--error">
            {errorText}
          </div>
        ) : null}

        {!loading && !errorText && rooms.length === 0 ? (
          <div className="standbyRooms-emptyCard">
            <div className="standbyRooms-emptyTitle">
              No rooms available
            </div>
            <div className="standbyRooms-emptyBody">
              Please check again later.
            </div>
          </div>
        ) : null}

        <div className="standbyRoomsList">
          {rooms.map((room) => (
            <StandbyRoomCard key={room.room_id} room={room} isMember={isMember} />
          ))}
        </div>
      </div>
    </div>
  );
}