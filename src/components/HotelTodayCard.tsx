import React from "react";

export type HotelTodayCardData = {
  hotel_id: number;
  hotel_name: string;
  location_label: string;
  primary_image_url: string;
  badges: string[];
  website_label?: string;
  booking_url: string;
  today_rate: {
    currency: string;
    price_amount: string;
    room_type?: string;
    availability_note: string;
  };
};

type Props = {
  hotel: HotelTodayCardData;
};

export default function HotelTodayCard({ hotel }: Props) {
  const price =
    hotel.today_rate.currency === "EUR"
      ? `€${hotel.today_rate.price_amount}`
      : `${hotel.today_rate.currency} ${hotel.today_rate.price_amount}`;

  const websiteLabel = hotel.website_label || "Hotel website";

  return (
    <article className="hotelCard">
      <div className="hotelCard-top">
        <div className="hotelCard-thumbWrap">
          <img
            src={hotel.primary_image_url}
            alt={hotel.hotel_name}
            className="hotelCard-thumb"
          />
        </div>

        <div className="hotelCard-topMain">
          <h2 className="hotelCard-title">{hotel.hotel_name}</h2>
          <div className="hotelCard-location">{hotel.location_label}</div>
        </div>
      </div>

      <div className="hotelCard-divider" />

      <div className="hotelCard-bottom">
        <div className="hotelCard-bottomLeft">
          {hotel.badges.length > 0 && (
            <div className="hotelCard-badges">
              {hotel.badges.slice(0, 3).map((badge) => (
                <span key={badge} className="hotelCard-badge">
                  {badge}
                </span>
              ))}
            </div>
          )}

          <div className="hotelCard-rateLabel">Crew rate today</div>

          {hotel.today_rate.room_type ? (
            <div className="hotelCard-roomType">{hotel.today_rate.room_type}</div>
          ) : null}

          <div className="hotelCard-note">{hotel.today_rate.availability_note}</div>

          <a
            href={hotel.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hotelCard-link"
          >
            {websiteLabel}
          </a>
        </div>

        <div className="hotelCard-priceCol">
          <div className="hotelCard-priceTitle">Rate</div>

          <div className="hotelCard-priceBox">
            <div className="hotelCard-price">{price}</div>
          </div>

          <a
            href={hotel.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hotelCard-bookBtn"
          >
            Book
          </a>
        </div>
      </div>
    </article>
  );
}