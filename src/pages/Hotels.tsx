// src/pages/Hotels.tsx
//
// PURPOSE
// - Hotels page for Schiphol-area crew hotel offers
//
// THIS VERSION
// - Uses live backend data
// - Uses backend sorting
// - Keeps StickyPageHeaderCard pattern
// - Moves sort controls OUTSIDE the intro card
// - Makes the sort controls part of the sticky top section, matching Rooms
//
// NOTES
// - Card component is assumed to already support:
//   website_label
//   booking_url
//   blue price pill
//   green Book button

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import HotelTodayCard from "../components/HotelTodayCard";
import type { HotelTodayCardData } from "../components/HotelTodayCard";

import { getHotelsList, type HotelSort } from "../api/hotelsApi";

import "../styles/hotels.css";

const AIRPORT_CODE = "AMS";

const SORT_OPTIONS: Array<{ value: HotelSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "distance_asc", label: "Distance" },
];

export default function Hotels() {
  const navigate = useNavigate();

  const [sort, setSort] = useState<HotelSort>("recommended");
  const [hotels, setHotels] = useState<HotelTodayCardData[]>([]);
  const [rateDateLocal, setRateDateLocal] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorText("");

      try {
        const resp = await getHotelsList(AIRPORT_CODE, sort);
        if (!alive) return;

        setHotels(Array.isArray(resp.hotels) ? resp.hotels : []);
        setRateDateLocal(String(resp.rate_date_local || ""));
      } catch (e: any) {
        if (!alive) return;
        setHotels([]);
        setRateDateLocal("");
        setErrorText(e?.message || "Failed to load hotels");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [sort]);

  return (
    <div className="hotels-page">
      <StickyPageHeaderCard
        leftContent={
          <img
            src={UI_ICONS.hotel}
            alt="Hotels"
            style={{
              width: 42,
              height: 42,
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
        }
        title="Hotels"
        subtitle=""
        onBack={() => navigate(-1)}
        backAriaLabel="Back"
      />

      <div className="hotels-scroll app-container">
        <div className="hotelsStickyControls">
          <div className="hotels-topCard">
            <div className="hotels-topTitle">Schiphol hotels offering crew rates</div>

            <div className="hotels-topBody">
              These schiphol area hotels offer discounted room rates to KLM and Transavia crew
              members. Valid ID will be required upon check-in.
            </div>

            <div className="hotels-topNote">
              Subject to availability. Rates shown are generic rates. May vary with hotel occupancy. Contact hotel for todays rate.
              {rateDateLocal ? ` (${rateDateLocal})` : ""}
            </div>
          </div>

          <div className="hotels-sortRow" role="group" aria-label="Sort hotels">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  sort === option.value
                    ? "hotels-sortChip hotels-sortChip--active"
                    : "hotels-sortChip"
                }
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="hotels-inlineStatus">Loading hotels…</div>
        ) : errorText ? (
          <div className="hotels-inlineStatus hotels-inlineStatus--error">
            {errorText}
          </div>
        ) : null}

        {!loading && !errorText && hotels.length === 0 ? (
          <div className="hotels-emptyCard">
            <div className="hotels-emptyTitle">
              No hotel rates available today
            </div>
            <div className="hotels-emptyBody">
              Please check again later.
            </div>
          </div>
        ) : null}

        <div className="hotelsList">
          {hotels.map((hotel) => (
            <HotelTodayCard key={hotel.hotel_id} hotel={hotel} />
          ))}
        </div>
      </div>
    </div>
  );
}