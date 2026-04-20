// src/api/standbyRoomsApi.ts
//
// PURPOSE
// - Fetch live standby rooms list from backend
//
// CONTRACT
// - POST /api/standby-rooms/list.php
// - body: { sort }

import { API_BASE_URL } from "../app/api";
import type { StandbyRoomCardData } from "../components/StandbyRoomCard";

export type StandbyRoomSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "distance_asc";

type StandbyRoomsListResponse = {
  ok: boolean;
  sort?: StandbyRoomSort;
  rooms?: StandbyRoomCardData[];
  message?: string;
};

export async function getStandbyRoomsList(
  sort: StandbyRoomSort
): Promise<StandbyRoomsListResponse> {
  const res = await fetch(`${API_BASE_URL}/api/standby-rooms/list.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sort,
    }),
  });

  const data = (await res.json()) as StandbyRoomsListResponse;

  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load standby rooms");
  }

  return data;
}