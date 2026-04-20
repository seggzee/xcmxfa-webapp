// src/api/hotelsApi.ts
//
// PURPOSE
// - Fetch live hotels list from backend
//
// CONTRACT
// - POST /api/hotels/list.php
// - body: { airport_code, sort }

import { API_BASE_URL } from "../app/api";
import type { HotelTodayCardData } from "../components/HotelTodayCard";

export type HotelSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "distance_asc";

type HotelsListResponse = {
  ok: boolean;
  airport_code?: string;
  rate_date_local?: string;
  sort?: HotelSort;
  hotels?: HotelTodayCardData[];
  message?: string;
};

export async function getHotelsList(
  airportCode: string,
  sort: HotelSort
): Promise<HotelsListResponse> {
  const res = await fetch(`${API_BASE_URL}/api/hotels/list.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      airport_code: airportCode,
      sort,
    }),
  });

  const data = (await res.json()) as HotelsListResponse;

  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load hotels");
  }

  return data;
}