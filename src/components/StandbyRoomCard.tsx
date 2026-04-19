import React from "react";

export type StandbyRoomCardData = {
  room_id: number;
  title: string;
  area_label: string;
  primary_image_url: string;
  description_short: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  website_label?: string;
  booking_url: string;
  price_per_night: {
    currency: string;
    amount: string;
  };
};

type Props = {
  room: StandbyRoomCardData;
};

export default function StandbyRoomCard({ room }: Props) {
  const price =
    room.price_per_night.currency === "EUR"
      ? `€${room.price_per_night.amount}`
      : `${room.price_per_night.currency} ${room.price_per_night.amount}`;

  const contactLine = [room.contact_phone, room.contact_email]
    .filter(Boolean)
    .join(" · ");

  const websiteLabel = room.website_label || "Advert website";

  return (
    <article className="standbyRoomCard">
      <div className="standbyRoomCard-top">
        <div className="standbyRoomCard-thumbWrap">
          <img
            src={room.primary_image_url}
            alt={room.title}
            className="standbyRoomCard-thumb"
          />
        </div>

        <div className="standbyRoomCard-topMain">
          <h2 className="standbyRoomCard-title">{room.title}</h2>
          <div className="standbyRoomCard-area">{room.area_label}</div>
        </div>
      </div>

      <div className="standbyRoomCard-divider" />

      <div className="standbyRoomCard-bottom">
        <div className="standbyRoomCard-bottomLeft">
          <div className="standbyRoomCard-description">{room.description_short}</div>

          <div className="standbyRoomCard-contactLabel">Contact</div>
          <div className="standbyRoomCard-contactName">{room.contact_name}</div>

          {contactLine ? (
            <div className="standbyRoomCard-contactLine">{contactLine}</div>
          ) : null}

          <a
            href={room.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="standbyRoomCard-link"
          >
            {websiteLabel}
          </a>
        </div>

        <div className="standbyRoomCard-priceCol">
          <div className="standbyRoomCard-priceTitle">Per night</div>

          <div className="standbyRoomCard-priceBox">
            <div className="standbyRoomCard-price">{price}</div>
          </div>

          <a
            href={room.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="standbyRoomCard-bookBtn"
          >
            Book
          </a>
        </div>
      </div>
    </article>
  );
}