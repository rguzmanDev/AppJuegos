"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";
import type { Room } from "./types";

const ROOM_KEY = "cuddle_room";

export function saveRoomToSession(room: Room) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(ROOM_KEY, JSON.stringify(room));
  }
}

function loadRoomFromSession(): Room | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ROOM_KEY);
  return raw ? (JSON.parse(raw) as Room) : null;
}

export function useRoom() {
  const [room, setRoom] = useState<Room | null>(() => loadRoomFromSession());
  const socket = getSocket();

  useEffect(() => {
    const handler = (r: Room) => {
      setRoom(r);
      saveRoomToSession(r);
    };
    socket.on("room:updated", handler);
    return () => { socket.off("room:updated", handler); };
  }, [socket]);

  const myId = socket.id ?? "";
  const me = room?.players.find((p) => p.id === myId);
  const opponent = room?.players.find((p) => p.id !== myId);
  const amHostRef = useRef(me?.isHost ?? false);

  useEffect(() => {
    amHostRef.current = me?.isHost ?? false;
  }, [me?.isHost]);

  return { room, me, opponent, myId, socket, amHostRef };
}
