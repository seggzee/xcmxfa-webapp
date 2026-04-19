// src/pages/Hotels.tsx
//
// PURPOSE
// - Hotels page for Schiphol-area crew hotel offers
//
// THIS CHANGE ONLY
// - Keep StickyPageHeaderCard pattern, matching Crew Lockers header treatment
// - Remove old per-card onPress/detail-page flow
// - Feed the already-amended HotelTodayCard component with booking_url + website_label
// - Keep simple mock data for now until backend exists
// - Keep page scope limited to front-end presentation only
//
// NOTES
// - HotelTodayCard is assumed to already use this contract:
//   {
//     hotel_id,
//     hotel_name,
//     location_label,
//     primary_image_url,
//     badges,
//     website_label?,
//     booking_url,
//     today_rate: { currency, price_amount, room_type?, availability_note }
//   }
// - The icon key below uses UI_ICONS.hotel because that is what the current file used.
//   If your assets file uses a different key, swap that one line only.

import React from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import HotelTodayCard from "../components/HotelTodayCard";
import type { HotelTodayCardData } from "../components/HotelTodayCard";

import "../styles/hotels.css";

const MOCK_HOTELS: HotelTodayCardData[] = [
  {
    hotel_id: 1,
    hotel_name: "Hilton Amsterdam Airport Schiphol",
    location_label: "0.3 km from AMS",
    primary_image_url:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast", "Free cancellation"],
    website_label: "Hotel website",
    booking_url: "https://www.hilton.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "149",
      room_type: "Standard King",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 2,
    hotel_name: "Sheraton Amsterdam Airport Hotel",
    location_label: "Connected to Schiphol Plaza",
    primary_image_url:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast"],
    website_label: "Hotel website",
    booking_url: "https://www.marriott.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "165",
      room_type: "Classic Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 3,
    hotel_name: "NH Amsterdam Schiphol Airport",
    location_label: "Shuttle available to Schiphol",
    primary_image_url:
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast", "Shuttle"],
    website_label: "Hotel website",
    booking_url: "https://www.nh-hotels.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "119",
      room_type: "Standard Double",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 4,
    hotel_name: "ibis Schiphol Amsterdam Airport",
    location_label: "Free shuttle to Schiphol",
    primary_image_url:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    badges: ["Shuttle"],
    website_label: "Hotel website",
    booking_url: "https://all.accor.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "99",
      room_type: "Standard Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 5,
    hotel_name: "Radisson Blu Amsterdam Airport",
    location_label: "2.8 km from AMS · Shuttle available",
    primary_image_url:
      "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast", "Shuttle"],
    website_label: "Hotel website",
    booking_url: "https://www.radissonhotels.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "129",
      room_type: "Superior Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 6,
    hotel_name: "Corendon Amsterdam Schiphol Airport",
    location_label: "Near Schiphol airport",
    primary_image_url:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast", "Free cancellation"],
    website_label: "Hotel website",
    booking_url: "https://www.corendonhotels.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "109",
      room_type: "Deluxe Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 7,
    hotel_name: "Mercure Hotel Schiphol Terminal",
    location_label: "Inside Schiphol terminal",
    primary_image_url:
      "https://images.unsplash.com/photo-1451976426598-a7593bd6d0b2?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast"],
    website_label: "Hotel website",
    booking_url: "https://all.accor.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "179",
      room_type: "Standard Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 8,
    hotel_name: "YOTELAIR Amsterdam Schiphol",
    location_label: "Inside airport transit area",
    primary_image_url:
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80",
    badges: ["Free cancellation"],
    website_label: "Hotel website",
    booking_url: "https://www.yotel.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "139",
      room_type: "Cabin",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 9,
    hotel_name: "Moxy Amsterdam Schiphol Airport",
    location_label: "Shuttle available to Schiphol",
    primary_image_url:
      "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&q=80",
    badges: ["Shuttle", "Free cancellation"],
    website_label: "Hotel website",
    booking_url: "https://www.marriott.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "115",
      room_type: "Queen Room",
      availability_note: "Subject to availability",
    },
  },
  {
    hotel_id: 10,
    hotel_name: "Steigenberger Airport Hotel Amsterdam",
    location_label: "Free shuttle to Schiphol",
    primary_image_url:
      "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c?auto=format&fit=crop&w=1200&q=80",
    badges: ["Breakfast", "Shuttle", "Free cancellation"],
    website_label: "Hotel website",
    booking_url: "https://hrewards.com/",
    today_rate: {
      currency: "EUR",
      price_amount: "124",
      room_type: "Superior Room",
      availability_note: "Subject to availability",
    },
  },
];

export default function Hotels() {
  const navigate = useNavigate();

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
        subtitle="Hotels offering crew discount room rates"
        onBack={() => navigate(-1)}
        backAriaLabel="Back"
      />

      <div className="hotels-scroll app-container">
        <div className="hotels-topCard">
          <div className="hotels-topTitle">Crew discount bookings</div>

          <div className="hotels-topBody">
            These hotels offer discounted room rates to KLM and Transavia crew members. Valid ID will be required upon check-in.
          </div>

          <div className="hotels-topNote">
            Subject to availability. Rates shown valid for today only.
          </div>
        </div>

        <div className="hotelsList">
          {MOCK_HOTELS.map((hotel) => (
            <HotelTodayCard key={hotel.hotel_id} hotel={hotel} />
          ))}
        </div>
      </div>
    </div>
  );
}